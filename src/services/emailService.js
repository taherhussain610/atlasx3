const nodemailer = require("nodemailer");

/**
 * Email Service for sending notifications and alerts
 */
class EmailService {
  constructor() {
    this.enabled = false;
    this.lastError = null;
    this.host = process.env.SMTP_HOST || "";
    this.port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
    this.secure = process.env.SMTP_SECURE === "true";
    this.requireTls = process.env.SMTP_REQUIRE_TLS !== "false";
    this.userConfigured = Boolean(process.env.SMTP_USER);
    this.passwordConfigured = Boolean(process.env.SMTP_PASSWORD);
    this.from = process.env.SMTP_FROM || "noreply@localhost";
    this.fromName = process.env.SMTP_FROM_NAME || "ATLASX3";
    this.adminEmail = process.env.ADMIN_EMAIL || this.from;
    this.trackOpens = process.env.SMTP_TRACK_OPENS === "true";
    this.trackInbox = process.env.SMTP_TRACK_INBOX !== "false";
    this.campaignId = process.env.SMTP_CAMPAIGN_ID || "atlasx3-transactional";

    // Initialize transporter only if SMTP credentials are provided
    if (this.host && this.userConfigured) {
      try {
        this.transporter = nodemailer.createTransport({
          host: this.host,
          port: this.port,
          secure: this.secure,
          requireTLS: !this.secure && this.requireTls,
          connectionTimeout: Number.parseInt(
            process.env.SMTP_CONNECTION_TIMEOUT_MS || "10000",
            10,
          ),
          greetingTimeout: Number.parseInt(
            process.env.SMTP_GREETING_TIMEOUT_MS || "10000",
            10,
          ),
          socketTimeout: Number.parseInt(
            process.env.SMTP_SOCKET_TIMEOUT_MS || "20000",
            10,
          ),
          auth: this.passwordConfigured
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              }
            : undefined,
          tls: {
            servername: this.host,
            minVersion: "TLSv1.2",
          },
        });
        this.enabled = this.passwordConfigured;

        if (this.enabled) {
          console.log(`✓ Email service configured: ${this.from}`);
        } else {
          console.log("⚠ Email service configured but SMTP_PASSWORD not set");
        }
      } catch (error) {
        console.warn("Email service initialization failed:", error.message);
      }
    } else {
      console.log("ℹ Email service not configured (SMTP credentials missing)");
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text content
   * @param {string} options.html - HTML content
   * @returns {Promise<boolean>} Success status
   */
  async sendEmail({ to, subject, text, html, campaignId }) {
    if (!this.enabled) {
      console.log(`[Email] Would send to ${to}: ${subject}`);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: {
          name: this.fromName,
          address: this.from,
        },
        envelope: {
          from: this.from,
          to,
        },
        to,
        subject,
        text,
        html: html || text,
        headers: {
          "mld-track-opens": String(this.trackOpens),
          "mld-track-inbox": String(this.trackInbox),
          "mld-track-campaign-id": campaignId || this.campaignId,
        },
      });

      this.lastError = null;
      console.log(`✓ Email sent to ${to}: ${subject} (${info.messageId})`);
      return true;
    } catch (error) {
      this.lastError = this.formatDeliveryError(error);
      console.error(`✗ Email send failed to ${to}:`, error.message);
      return false;
    }
  }

  formatDeliveryError(error) {
    const response = String(
      error?.response || error?.message || "SMTP delivery failed",
    );
    if (/invalid sender|valid From address/i.test(response)) {
      return "MailRCLD rejected SMTP_FROM. Verify this sender address in the MailRCLD dashboard.";
    }
    if (/authentication|invalid login|EAUTH/i.test(response)) {
      return "MailRCLD authentication failed. Check SMTP_USER and SMTP_PASSWORD.";
    }
    return "MailRCLD accepted the connection but rejected the message.";
  }

  getLastError() {
    return this.lastError;
  }

  async verifyConnection() {
    if (!this.transporter || !this.enabled) {
      return {
        ok: false,
        configured: Boolean(this.transporter),
        credentialsConfigured: this.passwordConfigured,
        error: this.passwordConfigured
          ? "SMTP transport is not configured"
          : "SMTP_PASSWORD is not configured",
      };
    }

    try {
      await this.transporter.verify();
      return {
        ok: true,
        configured: true,
        credentialsConfigured: true,
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        credentialsConfigured: true,
        error: error.message,
      };
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    const subject = `Welcome to ${this.fromName}`;
    const html = `
      <h2>Welcome to ${this.fromName}, ${user.username}!</h2>
      <p>Your account has been successfully created.</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Username:</strong> ${user.username}</p>
      <br>
      <p>Get started by depositing funds or exploring our blockchain integration features.</p>
      <p>If you have any questions, please contact us at ${this.adminEmail}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">This is an automated message from ${this.fromName}</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text: `Welcome to ${this.fromName}, ${user.username}! Your account has been successfully created.`,
      html,
    });
  }

  /**
   * Send deposit confirmation email
   */
  async sendDepositConfirmation(user, currency, amount) {
    const subject = `Deposit Confirmed: ${amount} ${currency}`;
    const html = `
      <h2>Deposit Confirmation</h2>
      <p>Hello ${user.username},</p>
      <p>Your deposit has been successfully processed:</p>
      <ul>
        <li><strong>Currency:</strong> ${currency}</li>
        <li><strong>Amount:</strong> ${amount}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p>Your new balance is available in your wallet.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">If you did not make this deposit, please contact us immediately at ${this.adminEmail}</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text: `Deposit Confirmed: ${amount} ${currency}`,
      html,
    });
  }

  /**
   * Send withdrawal confirmation email
   */
  async sendWithdrawalConfirmation(user, currency, amount, address) {
    const subject = `Withdrawal Confirmed: ${amount} ${currency}`;
    const html = `
      <h2>Withdrawal Confirmation</h2>
      <p>Hello ${user.username},</p>
      <p>Your withdrawal has been successfully processed:</p>
      <ul>
        <li><strong>Currency:</strong> ${currency}</li>
        <li><strong>Amount:</strong> ${amount}</li>
        <li><strong>Address:</strong> ${address || "N/A"}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <hr>
      <p style="color: #666; font-size: 12px;">If you did not make this withdrawal, please contact us immediately at ${this.adminEmail}</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text: `Withdrawal Confirmed: ${amount} ${currency}`,
      html,
    });
  }

  /**
   * Send exchange/trade confirmation email
   */
  async sendTradeConfirmation(
    user,
    fromCurrency,
    toCurrency,
    fromAmount,
    toAmount,
    rate,
  ) {
    const subject = `Trade Confirmed: ${fromAmount} ${fromCurrency} → ${toAmount} ${toCurrency}`;
    const html = `
      <h2>Trade Confirmation</h2>
      <p>Hello ${user.username},</p>
      <p>Your trade has been successfully executed:</p>
      <ul>
        <li><strong>From:</strong> ${fromAmount} ${fromCurrency}</li>
        <li><strong>To:</strong> ${toAmount} ${toCurrency}</li>
        <li><strong>Rate:</strong> ${rate}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p>Your balances have been updated accordingly.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">If you did not make this trade, please contact us immediately at ${this.adminEmail}</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text: `Trade Confirmed: ${fromAmount} ${fromCurrency} to ${toAmount} ${toCurrency}`,
      html,
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlert(user, alertType, details) {
    const subject = `Security Alert: ${alertType}`;
    const html = `
      <h2 style="color: #d9534f;">Security Alert</h2>
      <p>Hello ${user.username},</p>
      <p>We detected the following security event on your account:</p>
      <p><strong>Alert Type:</strong> ${alertType}</p>
      <p><strong>Details:</strong> ${details}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <br>
      <p style="color: #d9534f;"><strong>If this was not you, please secure your account immediately.</strong></p>
      <p>Contact us at ${this.adminEmail} if you need assistance.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">This is an automated security alert from ${this.fromName}</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      text: `Security Alert: ${alertType} - ${details}`,
      html,
    });
  }

  /**
   * Send admin notification
   */
  async sendAdminNotification(subject, message) {
    const html = `
      <h2>Admin Notification</h2>
      <p>${message}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">Automated notification from ${this.fromName}</p>
    `;

    return this.sendEmail({
      to: this.adminEmail,
      subject: `[Admin] ${subject}`,
      text: message,
      html,
    });
  }

  /**
   * Get email service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      configured: !!this.transporter,
      credentialsConfigured: this.passwordConfigured,
      from: this.from,
      fromName: this.fromName,
      adminEmail: this.adminEmail,
      host: this.host || "not configured",
      port: this.port,
      secure: this.secure,
      requireTls: !this.secure && this.requireTls,
      tracking: {
        opens: this.trackOpens,
        inbox: this.trackInbox,
        campaignId: this.campaignId,
      },
    };
  }
}

module.exports = EmailService;
