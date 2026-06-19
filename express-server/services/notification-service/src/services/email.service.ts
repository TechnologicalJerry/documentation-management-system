import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import { config } from '../config';
import { logger } from '../lib/logger';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isReady = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    if (!config.smtp.user || !config.smtp.pass) {
      logger.warn('SMTP credentials not configured — email sending disabled');

      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
      });

      this.transporter.verify((error) => {
        if (error) {
          logger.warn('SMTP connection verification failed', { error: error.message });
          this.isReady = false;
        } else {
          logger.info('SMTP connection verified successfully');
          this.isReady = true;
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to initialize email transporter', { error: err.message });
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      logger.warn('Email sending skipped — transporter not initialized', { to: options.to });

      return { success: false, error: 'Email transporter not initialized' };
    }

    const mailOptions = {
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
      attachments: options.attachments,
    };

    try {
      const info: SentMessageInfo = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId as string,
      });

      return { success: true, messageId: info.messageId as string };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: err.message,
      });

      return { success: false, error: err.message };
    }
  }

  interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return variables[key] ?? match;
    });
  }

  async sendDocumentPublishedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    documentTitle: string;
    projectName: string;
    publisherName: string;
    documentUrl: string;
  }): Promise<EmailResult> {
    const subject = `Document Published: ${params.documentTitle}`;
    const text = `Hello ${params.recipientName},\n\nThe document "${params.documentTitle}" in project "${params.projectName}" has been published by ${params.publisherName}.\n\nView it here: ${params.documentUrl}\n\nBest,\n${config.smtp.fromName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Document Published</h2>
        <p>Hello ${params.recipientName},</p>
        <p>The document <strong>${params.documentTitle}</strong> in project <strong>${params.projectName}</strong> has been published by ${params.publisherName}.</p>
        <p><a href="${params.documentUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Document</a></p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">You're receiving this because you're a member of the project. Manage your notification preferences in your account settings.</p>
      </div>
    `;

    return this.sendEmail({ to: params.recipientEmail, subject, text, html });
  }

  async sendExportCompletedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    exportName: string;
    downloadUrl: string;
  }): Promise<EmailResult> {
    const subject = `Your Export is Ready: ${params.exportName}`;
    const text = `Hello ${params.recipientName},\n\nYour export "${params.exportName}" has been completed successfully.\n\nDownload it here: ${params.downloadUrl}\n\nThis link will expire in 24 hours.\n\nBest,\n${config.smtp.fromName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Export Ready</h2>
        <p>Hello ${params.recipientName},</p>
        <p>Your export <strong>${params.exportName}</strong> has been completed successfully.</p>
        <p><a href="${params.downloadUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Export</a></p>
        <p style="color: #666; font-size: 12px;">This link will expire in 24 hours.</p>
      </div>
    `;

    return this.sendEmail({ to: params.recipientEmail, subject, text, html });
  }

  async sendAiGenerationCompletedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    documentTitle: string;
    documentUrl: string;
  }): Promise<EmailResult> {
    const subject = `AI Content Generation Complete`;
    const text = `Hello ${params.recipientName},\n\nYour AI content generation for "${params.documentTitle}" has completed.\n\nReview the results: ${params.documentUrl}\n\nBest,\n${config.smtp.fromName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">AI Generation Complete</h2>
        <p>Hello ${params.recipientName},</p>
        <p>Your AI content generation for <strong>${params.documentTitle}</strong> has completed.</p>
        <p><a href="${params.documentUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Results</a></p>
      </div>
    `;

    return this.sendEmail({ to: params.recipientEmail, subject, text, html });
  }

  async sendProjectMemberAddedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    projectName: string;
    inviterName: string;
    role: string;
    projectUrl: string;
  }): Promise<EmailResult> {
    const subject = `You've been added to project: ${params.projectName}`;
    const text = `Hello ${params.recipientName},\n\nYou have been added to the project "${params.projectName}" by ${params.inviterName} with the role of ${params.role}.\n\nVisit the project: ${params.projectUrl}\n\nBest,\n${config.smtp.fromName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Added to Project</h2>
        <p>Hello ${params.recipientName},</p>
        <p>You have been added to the project <strong>${params.projectName}</strong> by ${params.inviterName} with the role of <strong>${params.role}</strong>.</p>
        <p><a href="${params.projectUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visit Project</a></p>
      </div>
    `;

    return this.sendEmail({ to: params.recipientEmail, subject, text, html });
  }

  getTransporterStatus(): { ready: boolean; configured: boolean } {
    return {
      ready: this.isReady,
      configured: !!this.transporter,
    };
  }
}

export const emailService = new EmailService();
