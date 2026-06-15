import archiver from 'archiver';
import { PassThrough } from 'stream';
import { IMultiExporter, ExportableDocument } from './exporter.interface';
import { ExportOptions } from '../models/exportJob.model';
import { ExporterFactory } from './exporter.factory';
import { logger } from '../lib/logger';

export class ZipExporter implements IMultiExporter {
  /**
   * Export multiple documents into a single ZIP archive.
   * Each document is exported individually using the provided `format`
   * exporter, then stored in the ZIP with a sanitised filename.
   */
  async exportMultiple(
    documents: ExportableDocument[],
    format: string,
    options: ExportOptions,
  ): Promise<Buffer> {
    logger.debug('ZipExporter.exportMultiple called', {
      documentCount: documents.length,
      format,
    });

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Create a passthrough stream to collect archiver output
      const passThrough = new PassThrough();
      passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('warning', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          logger.warn('Archiver warning', { message: err.message });
        } else {
          reject(err);
        }
      });

      archive.on('error', reject);

      archive.pipe(passThrough);

      // Export each document and append to archive
      (async () => {
        try {
          const exporter = ExporterFactory.createExporter(format);
          const extension = this.getExtension(format);

          for (const doc of documents) {
            const buffer = await exporter.export(doc, options);
            const filename = `${this.sanitiseFilename(doc.title)}.${extension}`;

            archive.append(buffer, { name: filename });
            logger.debug(`Added ${filename} to ZIP`, { documentId: doc.id });
          }

          // Add a manifest JSON
          const manifest = {
            exportedAt: new Date().toISOString(),
            format,
            documentCount: documents.length,
            documents: documents.map((d) => ({
              id: d.id,
              title: d.title,
              filename: `${this.sanitiseFilename(d.title)}.${extension}`,
            })),
          };

          archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

          await archive.finalize();
        } catch (err) {
          reject(err);
        }
      })();
    });
  }

  // ── Helpers ────────────────────────────────────────────

  private sanitiseFilename(name: string): string {
    return name
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_')
      .replace(/-{2,}/g, '-')
      .slice(0, 100);
  }

  private getExtension(format: string): string {
    const map: Record<string, string> = {
      DOCX: 'docx',
      PDF: 'pdf',
      HTML: 'html',
      MARKDOWN: 'md',
    };

    return map[format.toUpperCase()] ?? 'bin';
  }
}
