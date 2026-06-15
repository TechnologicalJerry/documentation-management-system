import axios, { AxiosInstance, AxiosError } from 'axios';
import { ExportableDocument } from '../exporters/exporter.interface';
import { config } from '../config';
import { logger } from '../lib/logger';

export class DocumentFetcherService {
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.services.documentServiceUrl,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Fetch a single document by ID from the document-service.
   */
  async fetchDocument(documentId: string, token: string): Promise<ExportableDocument> {
    logger.debug('Fetching document', { documentId });

    try {
      const response = await this.httpClient.get<{ data: RawDocument }>(`/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return this.mapToExportable(response.data.data);
    } catch (error) {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 404) {
        throw new Error(`Document not found: ${documentId}`);
      }
      if (status === 403) {
        throw new Error(`Access denied for document: ${documentId}`);
      }
      if (status === 401) {
        throw new Error('Unauthorised: invalid or expired token');
      }

      const message = axiosErr.message ?? 'Failed to fetch document';
      logger.error('Document fetch failed', { documentId, error: message, status });
      throw new Error(`Failed to fetch document ${documentId}: ${message}`);
    }
  }

  /**
   * Fetch all documents belonging to a project.
   */
  async fetchDocuments(projectId: string, token: string): Promise<ExportableDocument[]> {
    logger.debug('Fetching project documents', { projectId });

    try {
      const response = await this.httpClient.get<{ data: { data: RawDocument[] } }>(
        '/documents',
        {
          params: { projectId, limit: 200 },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const rawDocs = response.data.data.data ?? [];

      return rawDocs.map((d) => this.mapToExportable(d));
    } catch (error) {
      const axiosErr = error as AxiosError;
      const message = axiosErr.message ?? 'Failed to fetch project documents';
      logger.error('Project documents fetch failed', { projectId, error: message });
      throw new Error(`Failed to fetch documents for project ${projectId}: ${message}`);
    }
  }

  /**
   * Fetch multiple documents by their IDs in parallel (with concurrency limit).
   */
  async fetchDocumentsByIds(
    documentIds: string[],
    token: string,
    concurrency = 5,
  ): Promise<ExportableDocument[]> {
    const results: ExportableDocument[] = [];
    const errors: { id: string; error: string }[] = [];

    // Process in batches to limit concurrency
    for (let i = 0; i < documentIds.length; i += concurrency) {
      const batch = documentIds.slice(i, i + concurrency);
      const settled = await Promise.allSettled(
        batch.map((id) => this.fetchDocument(id, token)),
      );

      for (let j = 0; j < settled.length; j++) {
        const result = settled[j];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({ id: batch[j], error: result.reason?.message ?? 'Unknown error' });
        }
      }
    }

    if (errors.length > 0) {
      logger.warn('Some documents failed to fetch', { errors });
      if (results.length === 0) {
        throw new Error(`All document fetches failed: ${errors.map((e) => e.error).join('; ')}`);
      }
    }

    return results;
  }

  // ── Private helpers ────────────────────────────────────

  private mapToExportable(raw: RawDocument): ExportableDocument {
    return {
      id: raw.id,
      title: raw.title,
      content: raw.content ?? '',
      contentType: raw.contentType ?? 'MARKDOWN',
      author: raw.authorId,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : undefined,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
      tags: raw.tags ?? [],
      metadata: raw.metadata
        ? {
            wordCount: raw.metadata.wordCount,
            readingTimeMinutes: raw.metadata.readingTimeMinutes,
            excerpt: raw.metadata.excerpt,
          }
        : undefined,
    };
  }
}

// ── Raw shape from document-service API ───────────────────

interface RawDocument {
  id: string;
  title: string;
  content?: string;
  contentType?: string;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  metadata?: {
    wordCount?: number;
    readingTimeMinutes?: number;
    excerpt?: string;
    [key: string]: unknown;
  };
}
