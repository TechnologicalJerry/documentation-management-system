import { GenerationType } from '../models/generation.model';
import { PromptTemplateModel } from '../models/promptTemplate.model';
import { logger } from '../lib/logger';

export interface BuildPromptInput {
  content: string;
  context?: string;
  options?: Record<string, unknown>;
}

export interface BuiltPrompt {
  userPrompt: string;
  systemPrompt: string;
}

// ---------------------------------------------------------------------------
// Default system prompts for each generation type
// ---------------------------------------------------------------------------
const DEFAULT_SYSTEM_PROMPTS: Record<GenerationType, string> = {
  [GenerationType.FULL_DOCS]: `You are an expert technical writer specialised in creating comprehensive, well-structured documentation.
Your goal is to produce clear, accurate, and complete documentation that covers all aspects of the provided content.
Format output in clean Markdown with appropriate headings, code blocks, tables, and lists.
Focus on clarity, completeness, and usability for developers and end-users.`,

  [GenerationType.SUMMARY]: `You are an expert at distilling complex technical content into concise, accurate summaries.
Capture all key concepts, important details, and critical information without losing meaning.
Format output in clear, readable Markdown — use bullet points or short paragraphs as appropriate.
Aim for brevity while ensuring completeness.`,

  [GenerationType.IMPROVE]: `You are an expert technical editor and writer.
Your task is to improve the clarity, readability, structure, and completeness of the provided documentation.
Correct grammar and style issues, improve sentence structure, add missing context, and ensure consistent terminology.
Preserve the original meaning and intent — enhance, do not rewrite.
Return the full improved document in Markdown.`,

  [GenerationType.Q_AND_A]: `You are an expert at generating comprehensive Q&A content from technical documentation.
Create clear, thoughtful questions that cover key concepts, and provide accurate, detailed answers.
Questions should range from basic to advanced to serve different knowledge levels.
Format output as a numbered list of Q&A pairs in Markdown.`,

  [GenerationType.CODE_DOCS]: `You are an expert software developer and technical writer specialised in code documentation.
Generate detailed, accurate documentation for the provided code: describe purpose, parameters, return values, side effects, exceptions, and usage examples.
Follow standard documentation conventions (JSDoc/TSDoc style).
Format output in clean Markdown with code blocks where appropriate.`,

  [GenerationType.TRANSLATE]: `You are a professional technical translator with expertise in software documentation.
Translate the provided documentation accurately while preserving technical terms, code snippets, and formatting.
Maintain the original structure, heading hierarchy, and Markdown formatting.
If the target language is not specified, translate to English.`,

  [GenerationType.CUSTOM]: `You are an expert technical writer and software developer.
Complete the requested task accurately and professionally.
Format output in clean, well-structured Markdown.`,
};

// ---------------------------------------------------------------------------
// Default user prompt templates (use {{content}}, {{context}} as placeholders)
// ---------------------------------------------------------------------------
const DEFAULT_USER_TEMPLATES: Record<GenerationType, string> = {
  [GenerationType.FULL_DOCS]: `Please create comprehensive documentation for the following content:

{{content}}
{{#if context}}

Additional context:
{{context}}
{{/if}}

Generate full documentation including overview, detailed explanations, usage examples, and any relevant notes.`,

  [GenerationType.SUMMARY]: `Please create a concise summary of the following content:

{{content}}
{{#if context}}

Additional context:
{{context}}
{{/if}}

Provide a clear, comprehensive summary that captures all key points.`,

  [GenerationType.IMPROVE]: `Please improve the following documentation:

{{content}}
{{#if context}}

Improvement focus / additional context:
{{context}}
{{/if}}

Return the full improved version of the document.`,

  [GenerationType.Q_AND_A]: `Please generate a comprehensive Q&A from the following documentation:

{{content}}
{{#if context}}

Focus areas:
{{context}}
{{/if}}

Create questions and detailed answers that cover the material thoroughly.`,

  [GenerationType.CODE_DOCS]: `Please generate documentation for the following code:

{{content}}
{{#if context}}

Additional context:
{{context}}
{{/if}}

Include purpose, parameters, return values, examples, and any edge cases or warnings.`,

  [GenerationType.TRANSLATE]: `Please translate the following documentation:

{{content}}
{{#if context}}

Target language / instructions:
{{context}}
{{/if}}

Maintain all technical terms, code snippets, and Markdown formatting.`,

  [GenerationType.CUSTOM]: `{{content}}
{{#if context}}

Additional context:
{{context}}
{{/if}}`,
};

export interface IPromptBuilderService {
  buildPrompt(
    type: GenerationType,
    input: BuildPromptInput,
    variables?: Record<string, string>,
  ): Promise<BuiltPrompt>;
  getSystemPrompt(type: GenerationType): Promise<string>;
}

export class PromptBuilderService implements IPromptBuilderService {
  /**
   * Build a prompt by first checking for a database template, then falling back
   * to the built-in defaults.
   */
  async buildPrompt(
    type: GenerationType,
    input: BuildPromptInput,
    variables: Record<string, string> = {},
  ): Promise<BuiltPrompt> {
    // Try to load the default active template from the database
    let systemPrompt: string;
    let userPromptTemplate: string;

    try {
      const dbTemplate = await PromptTemplateModel.findOne({
        type,
        isDefault: true,
        isActive: true,
      }).lean();

      if (dbTemplate !== null) {
        systemPrompt = dbTemplate.systemPrompt;
        userPromptTemplate = dbTemplate.userPromptTemplate;
        logger.debug('Using DB prompt template', { type, templateName: dbTemplate.name });
      } else {
        systemPrompt = DEFAULT_SYSTEM_PROMPTS[type];
        userPromptTemplate = DEFAULT_USER_TEMPLATES[type];
        logger.debug('Using built-in prompt template', { type });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to fetch prompt template from DB, using defaults', {
        type,
        error: err.message,
      });
      systemPrompt = DEFAULT_SYSTEM_PROMPTS[type];
      userPromptTemplate = DEFAULT_USER_TEMPLATES[type];
    }

    // Replace template variables
    const allVars: Record<string, string> = {
      content: input.content,
      context: input.context ?? '',
      ...variables,
    };

    let userPrompt = userPromptTemplate;

    // Handle simple {{#if context}}...{{/if}} blocks
    userPrompt = userPrompt.replace(
      /\{\{#if context\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match, block: string) => {
        return input.context && input.context.trim() !== '' ? block : '';
      },
    );

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(allVars)) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return { userPrompt: userPrompt.trim(), systemPrompt };
  }

  /**
   * Get only the system prompt for a given generation type.
   */
  async getSystemPrompt(type: GenerationType): Promise<string> {
    try {
      const dbTemplate = await PromptTemplateModel.findOne({
        type,
        isDefault: true,
        isActive: true,
      }).lean();

      if (dbTemplate !== null) {
        return dbTemplate.systemPrompt;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to fetch system prompt from DB', { type, error: err.message });
    }

    return DEFAULT_SYSTEM_PROMPTS[type];
  }
}
