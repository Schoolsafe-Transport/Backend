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

  private initializeTransporter(): void {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      try {
        const port = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 465;
        const cleanPass = env.SMTP_PASS.replace(/\s+/g, '');

        if (env.SMTP_HOST.toLowerCase().includes('gmail')) {
          this.transporter = (nodemailer.createTransport as any)({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            family: 4,
            auth: {
              user: env.SMTP_USER,
              pass: cleanPass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          });
        } else {
          this.transporter = (nodemailer.createTransport as any)({
            host: env.SMTP_HOST,
            port,
            secure: port === 465,
            family: 4,
            auth: {
              user: env.SMTP_USER,
              pass: cleanPass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
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
   * Returns true if valid SMTP or HTTPS email API credentials are configured in environment.
   */
  public isConfigured(): boolean {
    return Boolean(
      env.RESEND_API_KEY ||
      env.BREVO_API_KEY ||
      (this.transporter && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
    );
  }

  /**
   * Verifies live SMTP transporter connection.
   */
  public async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    if (env.RESEND_API_KEY || env.BREVO_API_KEY) {
      return { ok: true };
    }
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
   * Dispatches a single-use cryptographically secure email verification link and 6-digit code.
   * Supports HTTPS APIs (Resend, Brevo) for cloud platforms like Render and SMTP for local development.
   */
  public async sendVerificationEmail(
    toEmail: string,
    recipientName: string,
    rawToken: string,
    sixDigitCode?: string
  ): Promise<EmailDispatchResult> {
    const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

    if (!this.isConfigured()) {
      const errMsg = 'Email credentials (RESEND_API_KEY, BREVO_API_KEY, or SMTP_HOST/USER/PASS) not configured.';
      console.warn(`[EmailService] ${errMsg}`);
      return {
        delivered: false,
        error: errMsg,
        simulated: env.NODE_ENV !== 'production',
        verificationUrl,
      };
    }

    const textContent = `Welcome to SchoolSafe!\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\n${
      sixDigitCode ? `Or enter this 6-digit verification code: ${sixDigitCode}\n\n` : ''
    }This link and code expire in 30 minutes. If you did not create this account, you can ignore this email.`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 24px;">SchoolSafe</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Smart School Transportation Safeguarding</p>
        </div>
        <p style="font-size: 16px; font-weight: 600; color: #1e293b;">Welcome to SchoolSafe, ${recipientName || 'Member'}!</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          Please enter the 6-digit verification code below in your SchoolSafe app to verify your email address and activate your account.
        </p>
        ${
          sixDigitCode
            ? `
        <div style="margin: 28px 0; padding: 20px; background-color: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #1e40af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Your 6-Digit Email Verification Code
          </p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; font-family: monospace;">
            ${sixDigitCode}
          </div>
        </div>
        `
            : ''
        }
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
            Verify Email Address Directly
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          If the button does not work, copy and paste this link into your browser:<br />
          <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          This code expires in 30 minutes. If you did not create this account, you can safely ignore this email.
        </p>
      </div>
    `;

    // 1. Resend HTTPS REST API (Port 443 — Bypasses cloud SMTP blocks)
    if (env.RESEND_API_KEY) {
      try {
        console.log(`[EmailService] Dispatching via Resend HTTPS API to ${toEmail}...`);
        const fromAddress = env.EMAIL_FROM && !env.EMAIL_FROM.includes('gmail.com')
          ? `"SchoolSafe Smart Transit" <${env.EMAIL_FROM}>`
          : 'SchoolSafe <onboarding@resend.dev>';

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [toEmail],
            subject: 'Verify your SchoolSafe email address',
            text: textContent,
            html: htmlContent,
          }),
        });

        const data: any = await response.json();
        if (response.ok && data?.id) {
          console.log(`[EmailService] Resend email delivered! Message ID: ${data.id}`);
          return { delivered: true, messageId: data.id, verificationUrl };
        } else {
          console.error('[EmailService] Resend API error response:', data);
          return { delivered: false, error: data?.message || 'Resend API dispatch failed', verificationUrl };
        }
      } catch (resendErr: any) {
        console.error('[EmailService] Resend network error:', resendErr.message);
        return { delivered: false, error: resendErr.message, verificationUrl };
      }
    }

    // 2. Brevo HTTPS REST API (Port 443 — Bypasses cloud SMTP blocks)
    if (env.BREVO_API_KEY) {
      try {
        console.log(`[EmailService] Dispatching via Brevo HTTPS API to ${toEmail}...`);
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'SchoolSafe Smart Transit', email: env.EMAIL_FROM || 'rahelnaba716@gmail.com' },
            to: [{ email: toEmail, name: recipientName || 'Member' }],
            subject: 'Verify your SchoolSafe email address',
            htmlContent,
            textContent,
          }),
        });

        const data: any = await response.json();
        if (response.ok && data?.messageId) {
          console.log(`[EmailService] Brevo email delivered! Message ID: ${data.messageId}`);
          return { delivered: true, messageId: data.messageId, verificationUrl };
        } else {
          console.error('[EmailService] Brevo API error response:', data);
          return { delivered: false, error: data?.message || 'Brevo API dispatch failed', verificationUrl };
        }
      } catch (brevoErr: any) {
        console.error('[EmailService] Brevo network error:', brevoErr.message);
        return { delivered: false, error: brevoErr.message, verificationUrl };
      }
    }

    // 3. Fallback: Direct SMTP (Port 465/587)
    if (!this.transporter) {
      const errMsg = 'No SMTP transporter initialized and no HTTPS email API keys provided.';
      console.warn(`[EmailService] ${errMsg}`);
      return { delivered: false, error: errMsg, verificationUrl };
    }

    try {
      console.log(`[EmailService] Dispatching via SMTP transporter to ${toEmail}...`);
      const info = await this.transporter.sendMail({
        from: `"SchoolSafe Smart Transit" <${env.EMAIL_FROM}>`,
        to: toEmail,
        subject: 'Verify your SchoolSafe email address',
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EmailService] SMTP email delivered! Message ID: ${info.messageId}`);
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
      if (this.transporter) {
        const info = await this.transporter.sendMail({
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
      }

      return { delivered: true };
    } catch (err: any) {
      return {
        delivered: false,
        error: err.message,
      };
    }
  }
}

export const emailService = new EmailService();
