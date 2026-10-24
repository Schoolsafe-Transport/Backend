import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface EmailDispatchResult {
  delivered: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
  verificationUrl?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      try {
        const port = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 465;
        const cleanPass = env.SMTP_PASS.replace(/\s+/g, '');

        if (env.SMTP_HOST.toLowerCase().includes('gmail')) {
          this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: env.SMTP_USER,
              pass: cleanPass,
            },
          });
        } else {
          this.transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port,
            secure: port === 465,
            auth: {
              user: env.SMTP_USER,
              pass: cleanPass,
            },
          });
        }
      } catch (err: any) {
        console.error('[EmailService] Failed to initialize SMTP transporter:', err.message);
        this.transporter = null;
      }
    } else {
      this.transporter = null;
    }
  }

  /**
   * Returns true if valid SMTP credentials are configured in environment.
   */
  public isConfigured(): boolean {
    return Boolean(this.transporter && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  }

  /**
   * Verifies live SMTP transporter connection.
   */
  public async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured() || !this.transporter) {
      return {
        ok: false,
        error: 'SMTP host, user, or password environment variables are not configured.',
      };
    }
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Dispatches a single-use cryptographically secure email verification link.
   * Never claims delivery occurred if SMTP configuration is absent or delivery fails.
   */
  public async sendVerificationEmail(
    toEmail: string,
    recipientName: string,
    rawToken: string,
    sixDigitCode?: string
  ): Promise<EmailDispatchResult> {
    const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

    if (!this.isConfigured()) {
      const errMsg = 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured. Outbound email delivery could not be performed.';
      console.warn(`[EmailService] ${errMsg}`);
      return {
        delivered: false,
        error: errMsg,
        simulated: env.NODE_ENV !== 'production',
        verificationUrl,
      };
    }

    try {
      const info = await this.transporter!.sendMail({
        from: `"SchoolSafe Smart Transit" <${env.EMAIL_FROM}>`,
        to: toEmail,
        subject: 'Verify your SchoolSafe email address',
        text: `Welcome to SchoolSafe!\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\n${
          sixDigitCode ? `Or enter this 6-digit verification code: ${sixDigitCode}\n\n` : ''
        }This link and code expire in 30 minutes. If you did not create this account, you can ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #1e3a8a; margin: 0; font-size: 24px;">SchoolSafe</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Smart School Transportation Safeguarding</p>
            </div>
            <p style="font-size: 16px; font-weight: 600; color: #1e293b;">Welcome to SchoolSafe, ${recipientName || 'Member'}!</p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              Please click the button below to verify your email address and activate your account.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
                Verify Email Address
              </a>
            </div>
            ${
              sixDigitCode
                ? `
            <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                Or enter this 6-digit verification code in SchoolSafe
              </p>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">
                ${sixDigitCode}
              </div>
            </div>
            `
                : ''
            }
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              If the button does not work, copy and paste this link into your browser:<br />
              <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
              This link and code expire in 30 minutes. If you did not create this account, you can ignore this email.
            </p>
          </div>
        `,
      });

      return {
        delivered: true,
        messageId: info.messageId,
        verificationUrl,
      };
    } catch (err: any) {
      console.error('[EmailService] SMTP transmission failed:', err.message);
      return {
        delivered: false,
        error: `Delivery failed: ${err.message}`,
        verificationUrl,
      };
    }
  }

  /**
   * Dispatches notification when an administrator reviews an applicant.
   */
  public async sendApprovalDecisionEmail(
    toEmail: string,
    recipientName: string,
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    reason?: string
  ): Promise<EmailDispatchResult> {
    if (!this.isConfigured()) {
      return {
        delivered: false,
        simulated: true,
      };
    }

    const isApproved = decision === 'APPROVED';
    const subject = isApproved
      ? 'Your SchoolSafe provider application has been approved'
      : `Your SchoolSafe provider application was ${decision.toLowerCase()}`;

    try {
      const info = await this.transporter!.sendMail({
        from: `"SchoolSafe Administrator" <${env.EMAIL_FROM}>`,
        to: toEmail,
        subject,
        text: `Hello ${recipientName},\n\nYour application status has been updated to: ${decision}.${reason ? `\n\nNotes from administrator: ${reason}` : ''}\n\nSchoolSafe Administration`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h3 style="color: ${isApproved ? '#166534' : '#991b1b'};">${subject}</h3>
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>Your application status is now: <strong>${decision}</strong>.</p>
            ${reason ? `<div style="background-color: #f8fafc; padding: 12px; border-left: 4px solid #94a3b8; margin: 16px 0;"><strong>Administrator notes:</strong><br />${reason}</div>` : ''}
            <p>Thank you,<br />SchoolSafe Administration</p>
          </div>
        `,
      });

      return {
        delivered: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      return {
        delivered: false,
        error: err.message,
      };
    }
  }
}

export const emailService = new EmailService();
