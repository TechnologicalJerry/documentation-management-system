import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  UnderlineType,
  Footer,
  Header,
  PageNumber,
  NumberFormat,
} from 'docx';
import { IExporter, ExportableDocument } from './exporter.interface';
import { ExportOptions } from '../models/exportJob.model';
import { logger } from '../lib/logger';

// ── Simple Markdown token types for internal parsing ──────

interface MdToken {
  type:
    | 'heading'
    | 'paragraph'
    | 'code'
    | 'blockquote'
    | 'bullet_list'
    | 'ordered_list'
    | 'hr'
    | 'text';
  level?: number;
  text: string;
  items?: string[];
}

export class DocxExporter implements IExporter {
  async export(document: ExportableDocument, options: ExportOptions): Promise<Buffer> {
    logger.debug('DocxExporter.export called', { documentId: document.id });

    const children: Paragraph[] = [];

    // ── Watermark paragraph (if requested) ───────────────
    if (options.watermark) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: options.watermark,
              color: 'AAAAAA',
              size: 16,
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      );
    }

    // ── Title ─────────────────────────────────────────────
    children.push(
      new Paragraph({
        text: document.title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      }),
    );

    // ── Metadata ──────────────────────────────────────────
    if (options.includeMetadata) {
      const metaItems: string[] = [];
      if (document.author) {metaItems.push(`Author: ${document.author}`);}
      if (document.createdAt) {
        metaItems.push(`Created: ${document.createdAt.toLocaleDateString()}`);
      }
      if (document.updatedAt) {
        metaItems.push(`Updated: ${document.updatedAt.toLocaleDateString()}`);
      }
      if (document.tags && document.tags.length > 0) {
        metaItems.push(`Tags: ${document.tags.join(', ')}`);
      }
      if (document.metadata?.wordCount !== undefined) {
        metaItems.push(`Word count: ${document.metadata.wordCount}`);
      }
      if (document.metadata?.readingTimeMinutes !== undefined) {
        metaItems.push(`Reading time: ${document.metadata.readingTimeMinutes} min`);
      }

      for (const item of metaItems) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: item, size: 18, color: '666666' })],
            spacing: { after: 80 },
          }),
        );
      }

      // Separator
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD', space: 1 } },
          spacing: { after: 200 },
        }),
      );
    }

    // ── Table of Contents (basic) ─────────────────────────
    if (options.includeTableOfContents) {
      children.push(...this.buildToc(document.content));
    }

    // ── Body content ──────────────────────────────────────
    const tokens = this.tokenise(document.content);
    for (const token of tokens) {
      children.push(...this.tokenToParagraphs(token));
    }

    // ── Assemble document ─────────────────────────────────
    const doc = new Document({
      title: document.title,
      description: document.metadata?.excerpt,
      creator: document.author ?? 'DevDocs Studio',
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: document.title, size: 18, color: '888888' })],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Page ', size: 18, color: '888888' }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                      color: '888888',
                    }),
                    new TextRun({ text: ' of ', size: 18, color: '888888' }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                      color: '888888',
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return Buffer.from(buffer);
  }

  // ── Private helpers ────────────────────────────────────

  private buildToc(content: string): Paragraph[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const paragraphs: Paragraph[] = [];

    paragraphs.push(
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
      }),
    );

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const indent = (level - 1) * 360; // 360 twips per indent level

      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: title, size: 20 })],
          indent: { left: indent },
          spacing: { after: 80 },
        }),
      );
    }

    paragraphs.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    return paragraphs;
  }

  private tokenise(content: string): MdToken[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const tokens: MdToken[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block
      if (line.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        tokens.push({ type: 'code', text: codeLines.join('\n') });
        i++;
        continue;
      }

      // Heading
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headingMatch) {
        tokens.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
        });
        i++;
        continue;
      }

      // HR
      if (/^---+$/.test(line.trim())) {
        tokens.push({ type: 'hr', text: '' });
        i++;
        continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        tokens.push({ type: 'blockquote', text: quoteLines.join('\n') });
        continue;
      }

      // Bullet list
      if (/^[-*+]\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^[-*+]\s+/, ''));
          i++;
        }
        tokens.push({ type: 'bullet_list', text: '', items });
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s+/, ''));
          i++;
        }
        tokens.push({ type: 'ordered_list', text: '', items });
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Paragraph – collect until blank line
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        tokens.push({ type: 'paragraph', text: paraLines.join(' ') });
      }
    }

    return tokens;
  }

  private tokenToParagraphs(token: MdToken): Paragraph[] {
    switch (token.type) {
      case 'heading':
        return [
          new Paragraph({
            text: token.text,
            heading: this.levelToHeading(token.level ?? 1),
            spacing: { before: 240, after: 120 },
          }),
        ];

      case 'code':
        return [
          new Paragraph({
            children: [
              new TextRun({
                text: token.text,
                font: 'Courier New',
                size: 18,
                color: '333333',
              }),
            ],
            shading: { fill: 'F3F4F6', type: 'clear', color: 'auto' },
            spacing: { before: 120, after: 120 },
            indent: { left: 360 },
          }),
        ];

      case 'blockquote':
        return [
          new Paragraph({
            children: [
              new TextRun({ text: token.text, italics: true, color: '555555' }),
            ],
            indent: { left: 720 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: '2563EB', space: 8 },
            },
            spacing: { before: 120, after: 120 },
          }),
        ];

      case 'bullet_list':
        return (token.items ?? []).map(
          (item) =>
            new Paragraph({
              children: this.inlineTextRuns(item),
              bullet: { level: 0 },
              spacing: { after: 80 },
            }),
        );

      case 'ordered_list':
        return (token.items ?? []).map(
          (item, idx) =>
            new Paragraph({
              children: [new TextRun({ text: `${idx + 1}. ` }), ...this.inlineTextRuns(item)],
              spacing: { after: 80 },
            }),
        );

      case 'hr':
        return [
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 },
            },
            spacing: { before: 240, after: 240 },
          }),
        ];

      case 'paragraph':
      default:
        return [
          new Paragraph({
            children: this.inlineTextRuns(token.text),
            spacing: { after: 160 },
          }),
        ];
    }
  }

  private inlineTextRuns(text: string): TextRun[] {
    const runs: TextRun[] = [];
    // Process inline formatting: bold, italic, inline code, links
    const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // Plain text before this match
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
      }

      if (match[1] || match[2]) {
        // Bold: **text** or __text__
        runs.push(new TextRun({ text: match[2] ?? match[4], bold: true }));
      } else if (match[5] || match[6]) {
        // Italic: *text* or _text_
        runs.push(new TextRun({ text: match[6] ?? match[8], italics: true }));
      } else if (match[9]) {
        // Inline code: `text`
        runs.push(
          new TextRun({ text: match[10], font: 'Courier New', size: 18, color: 'DC2626' }),
        );
      } else if (match[11]) {
        // Link: [label](url)
        runs.push(
          new TextRun({
            text: match[12],
            color: '2563EB',
            underline: { type: UnderlineType.SINGLE, color: '2563EB' },
          }),
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Remaining plain text
    if (lastIndex < text.length) {
      runs.push(new TextRun({ text: text.slice(lastIndex) }));
    }

    return runs.length > 0 ? runs : [new TextRun({ text })];
  }

  private levelToHeading(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
    const map: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };

    return map[level] ?? HeadingLevel.HEADING_1;
  }
}
