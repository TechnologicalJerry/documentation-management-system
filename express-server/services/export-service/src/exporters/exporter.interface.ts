import { ExportOptions } from '../models/exportJob.model';

// ──────────────────────────────────────────────────────────
// Document shape used by exporters
// ──────────────────────────────────────────────────────────

export interface ExportableDocument {
  id: string;
  title: string;
  content: string;
  contentType: string;
  author?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  metadata?: {
    wordCount?: number;
    readingTimeMinutes?: number;
    excerpt?: string;
  };
}

// ──────────────────────────────────────────────────────────
// Exporter interface
// ──────────────────────────────────────────────────────────

export interface IExporter {
  export(document: ExportableDocument, options: ExportOptions): Promise<Buffer>;
}

export interface IMultiExporter {
  exportMultiple(
    documents: ExportableDocument[],
    format: string,
    options: ExportOptions,
  ): Promise<Buffer>;
}
