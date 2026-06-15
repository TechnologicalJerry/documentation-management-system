import { StatusCodes } from 'http-status-codes';
import { IDocumentRepository } from '../repositories/document.repository';
import { IDocumentVersionRepository } from '../repositories/documentVersion.repository';
import { IDocumentVersion } from '../models/documentVersion.model';
import { DocumentStatus } from '../models/document.model';
import {
  DocumentVersionResponseDto,
  VersionDiffResponseDto,
  DocumentServiceError,
} from '../types/document.types';
import { logger } from '../lib/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IVersionService {
  getVersions(documentId: string): Promise<DocumentVersionResponseDto[]>;
  getVersion(documentId: string, version: number): Promise<DocumentVersionResponseDto>;
  restoreVersion(documentId: string, version: number, userId: string): Promise<DocumentVersionResponseDto>;
  compareVersions(
    documentId: string,
    v1: number,
    v2: number,
  ): Promise<VersionDiffResponseDto>;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toDto(v: IDocumentVersion): DocumentVersionResponseDto {
  return {
    id: String(v._id),
    documentId: v.documentId,
    version: v.version,
    title: v.title,
    content: v.content,
    contentHtml: v.contentHtml,
    editorId: v.editorId,
    changeDescription: v.changeDescription,
    createdAt: v.createdAt.toISOString(),
  };
}

/**
 * Compute a simple line-level diff between two texts.
 * Returns a JSON-serialisable array of change hunks.
 */
function computeDiff(fromText: string, toText: string): string {
  const fromLines = fromText.split('\n');
  const toLines = toText.split('\n');

  const hunks: Array<{ type: 'equal' | 'remove' | 'add'; line: string }> = [];

  const fromSet = new Map<string, number>();
  fromLines.forEach((l, i) => fromSet.set(l, i));

  let fi = 0;
  let ti = 0;

  while (fi < fromLines.length || ti < toLines.length) {
    const fl = fromLines[fi];
    const tl = toLines[ti];

    if (fl === tl) {
      hunks.push({ type: 'equal', line: fl ?? '' });
      fi++;
      ti++;
    } else if (fl !== undefined && (tl === undefined || !fromSet.has(tl ?? ''))) {
      hunks.push({ type: 'remove', line: fl });
      fi++;
    } else {
      hunks.push({ type: 'add', line: tl ?? '' });
      ti++;
    }
  }

  return JSON.stringify(hunks);
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class VersionService implements IVersionService {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly versionRepo: IDocumentVersionRepository,
  ) {}

  async getVersions(documentId: string): Promise<DocumentVersionResponseDto[]> {
    // Verify document exists
    const doc = await this.documentRepo.findById(documentId);
    if (doc === null) {
      throw new DocumentServiceError(
        'DOCUMENT_NOT_FOUND',
        `Document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const versions = await this.versionRepo.findByDocument(documentId);

    return versions.map(toDto);
  }

  async getVersion(documentId: string, version: number): Promise<DocumentVersionResponseDto> {
    const doc = await this.documentRepo.findById(documentId);
    if (doc === null) {
      throw new DocumentServiceError(
        'DOCUMENT_NOT_FOUND',
        `Document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const versionDoc = await this.versionRepo.findByVersion(documentId, version);
    if (versionDoc === null) {
      throw new DocumentServiceError(
        'VERSION_NOT_FOUND',
        `Version ${version} of document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    return toDto(versionDoc);
  }

  async restoreVersion(
    documentId: string,
    version: number,
    userId: string,
  ): Promise<DocumentVersionResponseDto> {
    const doc = await this.documentRepo.findById(documentId);
    if (doc === null) {
      throw new DocumentServiceError(
        'DOCUMENT_NOT_FOUND',
        `Document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const targetVersion = await this.versionRepo.findByVersion(documentId, version);
    if (targetVersion === null) {
      throw new DocumentServiceError(
        'VERSION_NOT_FOUND',
        `Version ${version} of document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    // Apply the historical version's content back to the document
    const updated = await this.documentRepo.update(documentId, {
      title: targetVersion.title,
      content: targetVersion.content,
      contentHtml: targetVersion.contentHtml,
      lastEditorId: userId,
      // Restoring a version re-sets it to DRAFT if it was archived
      status: doc.status === DocumentStatus.ARCHIVED ? DocumentStatus.DRAFT : doc.status,
    });

    if (updated === null) {
      throw new DocumentServiceError(
        'DOCUMENT_NOT_FOUND',
        `Document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    // Snapshot the restoration as a new version
    const restoredVersion = await this.versionRepo.createVersion(
      updated,
      `Restored from version ${version}`,
    );

    logger.info('Document version restored', { documentId, restoredFromVersion: version, userId });

    return toDto(restoredVersion);
  }

  async compareVersions(
    documentId: string,
    v1: number,
    v2: number,
  ): Promise<VersionDiffResponseDto> {
    const doc = await this.documentRepo.findById(documentId);
    if (doc === null) {
      throw new DocumentServiceError(
        'DOCUMENT_NOT_FOUND',
        `Document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const [version1Doc, version2Doc] = await Promise.all([
      this.versionRepo.findByVersion(documentId, v1),
      this.versionRepo.findByVersion(documentId, v2),
    ]);

    if (version1Doc === null) {
      throw new DocumentServiceError(
        'VERSION_NOT_FOUND',
        `Version ${v1} not found`,
        StatusCodes.NOT_FOUND,
      );
    }
    if (version2Doc === null) {
      throw new DocumentServiceError(
        'VERSION_NOT_FOUND',
        `Version ${v2} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const diff = computeDiff(version1Doc.content, version2Doc.content);

    return {
      documentId,
      fromVersion: v1,
      toVersion: v2,
      fromContent: version1Doc.content,
      toContent: version2Doc.content,
      diff,
    };
  }
}
