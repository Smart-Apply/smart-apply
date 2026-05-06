import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../config/config.service';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template:
    | 'verification-email'
    | 'password-reset-email'
    | 'auto-apply-digest'
    | 'application-status-changed';
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
    const templateNames = [
      'verification-email',
      'password-reset-email',
      'auto-apply-digest',
      'application-status-changed',
    ];

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

    // Guard: missing template at runtime (e.g. .hbs file not copied to the
    // production image). Don't throw — log loudly so monitoring catches it.
    if (!this.templates.has(template)) {
      this.logger.error(
        `Cannot send email to ${to}: template '${template}' was not loaded at startup. ` +
          `Check that .hbs files are present in the production image.`,
      );
      return false;
    }

    let html: string;
    try {
      html = this.compileTemplate(template, context);
    } catch (error) {
      this.logger.error(`Template compilation failed for '${template}'`, error as Error);
      return false;
    }

    if (!this.resend) {
      // No Resend client configured (RESEND_API_KEY missing) — log only.
      // This keeps dev / preview environments quiet while making it visible
      // in production logs that a user-triggered email was dropped.
      this.logger.warn(
        `[email-not-sent] No RESEND_API_KEY configured. Would have sent to ${to}: "${subject}"`,
      );
      this.logger.debug(`[email-not-sent] context=${JSON.stringify(context)}`);
      return true; // Don't fail the user-facing flow — they were never promised an email
    }

    try {
      const result = await this.resend.emails.send({
        from: this.configService.emailFrom,
        to,
        subject,
        html,
      });

      if (result.error) {
        // Common Resend errors:
        //   "The from address is not verified" → verify domain in Resend dashboard
        //   "Domain not found" → EMAIL_FROM uses an unconfigured sender domain
        //   "Invalid `to` email address" → user-entered email is malformed
        this.logger.error(
          `Resend rejected email to ${to}: ${result.error.message ?? JSON.stringify(result.error)}`,
        );
        return false;
      }

      this.logger.log(`Email sent successfully to ${to} (id=${result.data?.id ?? 'unknown'})`);
      return true;
    } catch (error) {
      // Network / transport errors (Resend API unreachable, timeout, etc.)
      this.logger.error(`Network error sending email to ${to}`, error as Error);
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

  /**
   * Sent when the inbox-tracking agent detected a status change for one of
   * the user's applications. Skipped on user-initiated changes (the
   * orchestrator only calls this when `statusSource === EMAIL_TRACKING`
   * AND `userPreferences.emailTrackingNotify === true`).
   */
  async sendApplicationStatusChangedEmail(opts: {
    to: string;
    firstName?: string | null;
    applicationId: string;
    applicationTitle: string;
    jobTitle: string;
    company: string;
    previousStatusLabel: string;
    newStatusLabel: string;
    /** Tailwind-ish hex pair for the new-status pill in the template. */
    newStatusBg: string;
    newStatusFg: string;
    fromAddress: string;
    subject: string;
    receivedAtLabel: string;
  }): Promise<boolean> {
    const applicationUrl = `${this.configService.appUrl}/applications/${opts.applicationId}`;
    const settingsUrl = `${this.configService.appUrl}/settings?tab=notifications`;

    return this.sendEmail({
      to: opts.to,
      subject: `Status-Update: ${opts.applicationTitle} → ${opts.newStatusLabel}`,
      template: 'application-status-changed',
      context: {
        firstName: opts.firstName || 'da',
        applicationTitle: opts.applicationTitle,
        jobTitle: opts.jobTitle,
        company: opts.company,
        previousStatusLabel: opts.previousStatusLabel,
        newStatusLabel: opts.newStatusLabel,
        newStatusBg: opts.newStatusBg,
        newStatusFg: opts.newStatusFg,
        fromAddress: opts.fromAddress,
        subject: opts.subject,
        receivedAtLabel: opts.receivedAtLabel,
        applicationUrl,
        settingsUrl,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  /**
   * Send a plain HTML email without going through the template registry.
   *
   * Used by flows that don't have a pre-registered Handlebars template,
   * e.g. forwarding a contact-form submission to support. Same logging
   * and "no API key configured → log-only" semantics as `sendEmail`.
   */
  async sendRawHtml(options: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    /**
     * Optional Resend tags. Useful for filtering / priority routing in the
     * Resend dashboard (e.g. `[{ name: 'priority', value: 'premium' }]`).
     */
    tags?: Array<{ name: string; value: string }>;
  }): Promise<boolean> {
    const { to, subject, html, replyTo, tags } = options;

    if (!this.resend) {
      this.logger.warn(
        `[email-not-sent] No RESEND_API_KEY configured. Would have sent raw email to ${to}: "${subject}"`,
      );
      return true;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.configService.emailFrom,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
        ...(tags && tags.length > 0 ? { tags } : {}),
      });

      if (result.error) {
        this.logger.error(
          `Resend rejected raw email to ${to}: ${result.error.message ?? JSON.stringify(result.error)}`,
        );
        return false;
      }

      this.logger.log(`Raw email sent to ${to} (id=${result.data?.id ?? 'unknown'})`);
      return true;
    } catch (error) {
      this.logger.error(`Network error sending raw email to ${to}`, error as Error);
      return false;
    }
  }
}
