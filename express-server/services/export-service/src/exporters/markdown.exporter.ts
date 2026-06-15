import { IExporter, ExportableDocument } from './exporter.interface';
import { ExportOptions } from '../models/exportJob.model';
import { logger } from '../lib/logger';

export class MarkdownExporter implements IExporter {
  /**
   * Export a document to Markdown format.
   * If the content is already Markdown it is cleaned up and returned.
   * If the content appears to be HTML it is converted to basic Markdown.
   */
  async export(document: ExportableDocument, options: ExportOptions): Promise<Buffer> {
    logger.debug('MarkdownExporter.export called', { documentId: document.id });

    const lines: string[] = [];

    // ── Front-matter / metadata ───────────────────────────
    if (options.includeMetadata) {
      lines.push('---');
      lines.push(`title: "${this.escapeFrontMatter(document.title)}"`);
      if (document.author) {
        lines.push(`author: "${this.escapeFrontMatter(document.author)}"`);
      }
      if (document.createdAt) {
        lines.push(`date: ${document.createdAt.toISOString()}`);
      }
      if (document.updatedAt) {
        lines.push(`updated: ${document.updatedAt.toISOString()}`);
      }
      if (document.tags && document.tags.length > 0) {
        lines.push(`tags: [${document.tags.map((t) => `"${t}"`).join(', ')}]`);
      }
      if (document.metadata?.wordCount !== undefined) {
        lines.push(`wordCount: ${document.metadata.wordCount}`);
      }
      if (document.metadata?.readingTimeMinutes !== undefined) {
        lines.push(`readingTime: ${document.metadata.readingTimeMinutes} min`);
      }
      lines.push('---');
      lines.push('');
    }

    // ── Title heading ─────────────────────────────────────
    lines.push(`# ${document.title}`);
    lines.push('');

    // ── Table of Contents ─────────────────────────────────
    if (options.includeTableOfContents) {
      const toc = this.generateTableOfContents(document.content);
      if (toc.length > 0) {
        lines.push('## Table of Contents');
        lines.push('');
        lines.push(...toc);
        lines.push('');
      }
    }

    // ── Body content ──────────────────────────────────────
    const body = this.processContent(document.content);
    lines.push(body);

    // ── Watermark ─────────────────────────────────────────
    if (options.watermark) {
      lines.push('');
      lines.push('---');
      lines.push(`*${options.watermark}*`);
    }

    const markdown = lines.join('\n');

    return Buffer.from(markdown, 'utf-8');
  }

  // ── Private helpers ────────────────────────────────────

  private escapeFrontMatter(value: string): string {
    return value.replace(/"/g, '\\"');
  }

  private processContent(content: string): string {
    if (this.isHtml(content)) {
      return this.htmlToMarkdown(content);
    }

    return this.cleanMarkdown(content);
  }

  private isHtml(content: string): boolean {
    return /<[a-z][\s\S]*>/i.test(content);
  }

  private cleanMarkdown(content: string): string {
    // Normalise line endings
    let cleaned = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Collapse 3+ blank lines to 2
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    // Remove trailing whitespace from lines
    cleaned = cleaned
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n');

    return cleaned.trim();
  }

  private htmlToMarkdown(html: string): string {
    let md = html;

    // Remove HTML comments
    md = md.replace(/<!--[\s\S]*?-->/g, '');

    // Block elements – headings
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
    md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
    md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

    // Paragraphs
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

    // Bold / strong
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');

    // Italic / em
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

    // Strikethrough
    md = md.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~');
    md = md.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');

    // Inline code
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // Code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Images
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

    // Unordered lists
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, inner: string) => {
      return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    });

    // Ordered lists
    let olCounter = 0;
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, inner: string) => {
      olCounter = 0;

      return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => {
        olCounter++;

        return `${olCounter}. $1\n`;
      });
    });

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => {
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    });

    // Horizontal rules
    md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n');

    // Line breaks
    md = md.replace(/<br[^>]*\/?>/gi, '\n');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    md = md
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Clean up extra blank lines
    md = md.replace(/\n{3,}/g, '\n\n').trim();

    return md;
  }

  private generateTableOfContents(content: string): string[] {
    const toc: string[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      const indent = '  '.repeat(level - 1);
      toc.push(`${indent}- [${title}](#${anchor})`);
    }

    return toc;
  }
}
