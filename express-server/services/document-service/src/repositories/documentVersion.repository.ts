import { DocumentVersionModel, IDocumentVersion } from '../models/documentVersion.model';
import { IDocument } from '../models/document.model';
import { logger } from '../lib/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IDocumentVersionRepository {
  findByDocument(documentId: string): Promise<IDocumentVersion[]>;
  findByVersion(documentId: string, version: number): Promise<IDocumentVersion | null>;
  createVersion(doc: IDocument, changeDescription?: string): Promise<IDocumentVersion>;
  getVersionCount(documentId: string): Promise<number>;
  getLatestVersion(documentId: string): Promise<IDocumentVersion | null>;
  deleteByDocumentId(documentId: string): Promise<number>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class DocumentVersionRepository implements IDocumentVersionRepository {
  async findByDocument(documentId: string): Promise<IDocumentVersion[]> {
    try {
      return await DocumentVersionModel.find({ documentId })
        .sort({ version: -1 })
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentVersionRepository.findByDocument error', { documentId, error });
      throw error;
    }
  }

  async findByVersion(documentId: string, version: number): Promise<IDocumentVersion | null> {
    try {
      return await DocumentVersionModel.findOne({ documentId, version }).lean().exec();
    } catch (error) {
      logger.error('DocumentVersionRepository.findByVersion error', {
        documentId,
        version,
        error,
      });
      throw error;
    }
  }

  async createVersion(doc: IDocument, changeDescription?: string): Promise<IDocumentVersion> {
    try {
      const currentCount = await this.getVersionCount(String(doc._id));
      const nextVersion = currentCount + 1;

      const versionDoc = new DocumentVersionModel({
        documentId: String(doc._id),
        version: nextVersion,
        title: doc.title,
        content: doc.content,
        contentHtml: doc.contentHtml,
        editorId: doc.lastEditorId,
        changeDescription,
      });

      const saved = await versionDoc.save();

      return saved;
    } catch (error) {
      logger.error('DocumentVersionRepository.createVersion error', {
        documentId: doc._id,
        error,
      });
      throw error;
    }
  }

  async getVersionCount(documentId: string): Promise<number> {
    try {
      return await DocumentVersionModel.countDocuments({ documentId }).exec();
    } catch (error) {
      logger.error('DocumentVersionRepository.getVersionCount error', { documentId, error });
      throw error;
    }
  }

  async getLatestVersion(documentId: string): Promise<IDocumentVersion | null> {
    try {
      return await DocumentVersionModel.findOne({ documentId })
        .sort({ version: -1 })
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentVersionRepository.getLatestVersion error', { documentId, error });
      throw error;
    }
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    try {
      const result = await DocumentVersionModel.deleteMany({ documentId }).exec();

      return result.deletedCount;
    } catch (error) {
      logger.error('DocumentVersionRepository.deleteByDocumentId error', { documentId, error });
      throw error;
    }
  }
}
