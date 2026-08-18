import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');

  constructor(private readonly config: ConfigService) {}

  /**
   * Placeholder send — logs in development. Wire up Resend (RESEND_API_KEY,
   * EMAIL_FROM are already read from config) or another provider when ready.
   */
  async sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
    try {
      const resendApiKey = this.config.get<string>('RESEND_API_KEY');

      if (resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.config.get<string>('EMAIL_FROM') || 'noreply@yourhospital.com',
            to,
            subject,
            html,
            text,
          }),
        });

        if (!response.ok) {
          this.logger.error(`Failed to send email: ${await response.text()}`);
          return false;
        }

        return true;
      }

      this.logger.log('📧 Email would be sent:');
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Content: ${text || html}`);

      return true;
    } catch (error) {
      this.logger.error('Error sending email:', error as Error);
      return false;
    }
  }

  async sendDoctorWelcomeEmail(doctorEmail: string, doctorName: string, hospitalName: string): Promise<boolean> {
    const appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') || 'https://yourhospital.com';
    const subject = `Welcome to ${hospitalName} - Doctor Portal Access`;

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${hospitalName}</h1>
          </div>
          <div class="content">
            <p>Dear Dr. ${doctorName},</p>
            <p>We are pleased to inform you that you have been added to the <strong>${hospitalName}</strong> doctor portal.</p>
            <p>You can now:</p>
            <ul>
              <li>Access your dashboard and manage appointments</li>
              <li>View patient information and medical records</li>
              <li>Update your availability and schedule</li>
              <li>Communicate with hospital staff and patients</li>
            </ul>
            <p>To get started, please log in to your account using your email address:</p>
            <div style="text-align: center;">
              <a href="${appUrl}/login" class="button">Access Doctor Portal</a>
            </div>
            <p>If you have any questions or need assistance, please don't hesitate to contact the hospital administration.</p>
            <p>Best regards,<br>${hospitalName} Administration Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

    const text = `
Welcome to ${hospitalName}

Dear Dr. ${doctorName},

We are pleased to inform you that you have been added to the ${hospitalName} doctor portal.

You can now:
- Access your dashboard and manage appointments
- View patient information and medical records
- Update your availability and schedule
- Communicate with hospital staff and patients

To get started, please log in to your account using your email address at:
${appUrl}/login

If you have any questions or need assistance, please don't hesitate to contact the hospital administration.

Best regards,
${hospitalName} Administration Team

---
This is an automated message. Please do not reply to this email.
  `;

    return this.sendEmail({ to: doctorEmail, subject, html, text });
  }

  async sendDoctorApprovalEmail(doctorEmail: string, doctorName: string, hospitalName: string): Promise<boolean> {
    const appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') || 'https://yourhospital.com';
    const subject = `Your Doctor Profile Has Been Approved - ${hospitalName}`;

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Profile Approved!</h1>
          </div>
          <div class="content">
            <p>Dear Dr. ${doctorName},</p>
            <p>Congratulations! Your doctor profile at <strong>${hospitalName}</strong> has been approved.</p>
            <p>You now have full access to all doctor portal features. You can start managing your appointments and seeing patients.</p>
            <div style="text-align: center;">
              <a href="${appUrl}/login" class="button">Go to Dashboard</a>
            </div>
            <p>Thank you for joining our team!</p>
            <p>Best regards,<br>${hospitalName} Administration Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

    const text = `
Profile Approved!

Dear Dr. ${doctorName},

Congratulations! Your doctor profile at ${hospitalName} has been approved.

You now have full access to all doctor portal features. You can start managing your appointments and seeing patients.

Log in at: ${appUrl}/login

Thank you for joining our team!

Best regards,
${hospitalName} Administration Team
  `;

    return this.sendEmail({ to: doctorEmail, subject, html, text });
  }
}
