import { IExporter } from './exporter.interface';
import { MarkdownExporter } from './markdown.exporter';
import { HtmlExporter } from './html.exporter';
import { DocxExporter } from './docx.exporter';
import { PdfExporter } from './pdf.exporter';
import { ExportFormat } from '../models/exportJob.model';

export class ExporterFactory {
  private static cache: Map<string, IExporter> = new Map();

  /**
   * Returns the appropriate exporter for the given format.
   * Exporters are cached (singleton per format) to avoid recreating
   * stateless instances on every call.
   */
  static createExporter(format: string): IExporter {
    const normalised = format.toUpperCase();

    if (ExporterFactory.cache.has(normalised)) {
      return ExporterFactory.cache.get(normalised) as IExporter;
    }

    let exporter: IExporter;

    switch (normalised) {
      case ExportFormat.MARKDOWN:
        exporter = new MarkdownExporter();
        break;
      case ExportFormat.HTML:
        exporter = new HtmlExporter();
        break;
      case ExportFormat.DOCX:
        exporter = new DocxExporter();
        break;
      case ExportFormat.PDF:
        exporter = new PdfExporter();
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    ExporterFactory.cache.set(normalised, exporter);

    return exporter;
  }

  /**
   * Returns the MIME type for a given export format.
   */
  static getMimeType(format: string): string {
    const map: Record<string, string> = {
      [ExportFormat.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      [ExportFormat.PDF]: 'application/pdf',
      [ExportFormat.HTML]: 'text/html; charset=utf-8',
      [ExportFormat.MARKDOWN]: 'text/markdown; charset=utf-8',
      [ExportFormat.ZIP]: 'application/zip',
    };

    return map[format.toUpperCase()] ?? 'application/octet-stream';
  }

  /**
   * Returns the file extension for a given export format.
   */
  static getFileExtension(format: string): string {
    const map: Record<string, string> = {
      [ExportFormat.DOCX]: 'docx',
      [ExportFormat.PDF]: 'pdf',
      [ExportFormat.HTML]: 'html',
      [ExportFormat.MARKDOWN]: 'md',
      [ExportFormat.ZIP]: 'zip',
    };

    return map[format.toUpperCase()] ?? 'bin';
  }

  /**
   * Returns a list of all supported formats.
   */
  static getSupportedFormats(): string[] {
    return Object.values(ExportFormat);
  }

  /**
   * Clears the cached exporter instances (useful for testing).
   */
  static clearCache(): void {
    ExporterFactory.cache.clear();
  }
}
