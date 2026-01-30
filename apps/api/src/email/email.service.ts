import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../config/config.service';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: 'verification-email' | 'password-reset-email';
  context: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.resendApiKey;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email service initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not configured - emails will be logged but not sent');
    }
    this.loadTemplates();
  }

  private loadTemplates(): void {
    const templateDir = path.join(__dirname, 'templates');
    const templateNames = ['verification-email', 'password-reset-email'];

    for (const name of templateNames) {
      try {
        const templatePath = path.join(templateDir, `${name}.hbs`);
        if (fs.existsSync(templatePath)) {
          const templateSource = fs.readFileSync(templatePath, 'utf-8');
          this.templates.set(name, Handlebars.compile(templateSource));
          this.logger.debug(`Loaded email template: ${name}`);
        } else {
          this.logger.warn(`Email template not found: ${templatePath}`);
        }
      } catch (error) {
        this.logger.error(`Failed to load template ${name}:`, error);
      }
    }
  }

  private compileTemplate(templateName: string, context: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Email template not found: ${templateName}`);
    }
    return template(context);
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, template, context } = options;

    try {
      const html = this.compileTemplate(template, context);

      if (!this.resend) {
        // In development without API key, log the email
        this.logger.log(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
        this.logger.debug(`[DEV EMAIL] Context: ${JSON.stringify(context)}`);
        return true;
      }

      const result = await this.resend.emails.send({
        from: this.configService.emailFrom,
        to,
        subject,
        html,
      });

      if (result.error) {
        this.logger.error(`Failed to send email to ${to}:`, result.error);
        return false;
      }

      this.logger.log(`Email sent successfully to ${to} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending email to ${to}:`, error);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    userName?: string,
  ): Promise<boolean> {
    const verificationUrl = `${this.configService.appUrl}/verify-email/${token}`;

    return this.sendEmail({
      to: email,
      subject: 'Verify your email address - Smart Apply',
      template: 'verification-email',
      context: {
        userName: userName || 'there',
        verificationUrl,
        expiresIn: '24 hours',
        currentYear: new Date().getFullYear(),
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    userName?: string,
  ): Promise<boolean> {
    const resetUrl = `${this.configService.appUrl}/reset-password/${token}`;

    return this.sendEmail({
      to: email,
      subject: 'Reset your password - Smart Apply',
      template: 'password-reset-email',
      context: {
        userName: userName || 'there',
        resetUrl,
        expiresIn: '1 hour',
        currentYear: new Date().getFullYear(),
      },
    });
  }
}
