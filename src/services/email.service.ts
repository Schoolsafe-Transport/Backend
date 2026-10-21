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
        const port = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587;
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port,
          secure: port === 465,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });
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
   * Dispatches a single-use cryptographically secure email verification link.
   * Never claims delivery occurred if SMTP configuration is absent or delivery fails.
   */
  public async sendVerificationEmail(
    toEmail: string,
    recipientName: string,
    rawToken: string
  ): Promise<EmailDispatchResult> {
    const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

    if (!this.isConfigured()) {
      if (env.NODE_ENV === 'production') {
        const errMsg = 'SMTP credentials not configured. Outbound email delivery is disabled.';
        console.error(`[EmailService] ${errMsg}`);
        return {
          delivered: false,
          error: errMsg,
          verificationUrl,
        };
      }

      // Safe development/test simulation
      console.log(
        `\n[EmailService - DEV SIMULATION]\nTo: ${toEmail}\nRecipient: ${recipientName}\nAction: Verify Email\nLink: ${verificationUrl}\n`
      );
      return {
        delivered: false,
        simulated: true,
        verificationUrl,
      };
    }

    try {
      const info = await this.transporter!.sendMail({
        from: `"SchoolSafe Smart Transit" <${env.EMAIL_FROM}>`,
        to: toEmail,
        subject: 'Verify your SchoolSafe email address',
        text: `Welcome to SchoolSafe!\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link expires after 30 minutes. If you did not create this account, you can ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #1e3a8a; margin: 0;">SchoolSafe</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Smart School Transportation Safeguarding</p>
            </div>
            <p style="font-size: 16px; font-weight: 600; color: #1e293b;">Welcome to SchoolSafe!</p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              Please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
                Verify My Email
              </a>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              Or copy and paste this link into your browser:<br />
              <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
              This link expires after 30 minutes. If you did not create this account, you can ignore this email.
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
