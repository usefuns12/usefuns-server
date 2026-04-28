const nodemailer = require("nodemailer");

const logger = console;

/**
 * STEP 5.7: Notification Service
 * Routes alerts to admins via Email only
 * Non-blocking: Failures logged, never thrown
 */

// ============================================================================
// NOTIFICATION RULES: Config-driven decision on what to notify
// ============================================================================

const NOTIFICATION_RULES = {
  // Critical alerts - notify immediately
  IMMEDIATE: [
    "system_error", // System failures
    "cron_failure", // Job failures
    "unlock_failure", // Wallet unlock failures
    "wallet_mismatch", // Balance inconsistencies
  ],
  // High severity - notify immediately
  IMMEDIATE_SEVERITY: ["critical"],
  // Batch/digest - group into daily summary
  BATCHED: [
    "salary_zero",
    "salary_drop",
    "vip_anomaly",
    "commission_drop",
    "gift_velocity",
    "gift_loop",
    "cycle_stuck",
  ],
};

/**
 * Determine if an alert should trigger immediate notification
 */
function shouldNotifyImmediately(alert) {
  // Critical severity always notifies
  if (alert.severity === "critical") {
    return true;
  }

  // Specific types always notify
  if (NOTIFICATION_RULES.IMMEDIATE.includes(alert.type)) {
    return true;
  }

  return false;
}

/**
 * Determine if an alert should be included in daily digest
 */
function shouldIncludeInDigest(alert) {
  return NOTIFICATION_RULES.BATCHED.includes(alert.type);
}

// ============================================================================
// EMAIL INTEGRATION
// ============================================================================

async function sendEmail(alert) {
  if (process.env.EMAIL_ENABLED !== "true") {
    return;
  }

  if (
    !process.env.EMAIL_FROM ||
    !process.env.EMAIL_TO ||
    !process.env.SMTP_HOST
  ) {
    logger.warn("Email configuration incomplete, skipping Email notification");
    return;
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Determine urgency
    const subject =
      alert.severity === "critical"
        ? `🚨 CRITICAL ALERT: ${alert.type}`
        : `⚠️ ALERT: ${alert.type}`;

    // Build email body
    const emailBody = `
      <h2>${subject}</h2>
      <p><strong>Alert Details:</strong></p>
      <ul>
        <li><strong>Type:</strong> ${alert.type}</li>
        <li><strong>Severity:</strong> ${alert.severity}</li>
        <li><strong>Reference:</strong> ${alert.referenceType}:${
      alert.referenceId
    }</li>
        <li><strong>Status:</strong> ${alert.status}</li>
        <li><strong>Message:</strong> ${alert.message || "No details"}</li>
        <li><strong>Created:</strong> ${new Date(
          alert.createdAt
        ).toLocaleString()}</li>
      </ul>
      <p><a href="${process.env.ADMIN_DASHBOARD_URL || "N/A"}/alerts/${
      alert._id
    }">View in Dashboard</a></p>
      <hr/>
      <p><em>UseFunc Alert System</em></p>
    `;

    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: subject,
      html: emailBody,
    });

    logger.info(
      `Email notification sent for alert: ${alert.type}:${alert._id}`
    );
    return info;
  } catch (err) {
    logger.error(
      `Failed to send Email notification for ${alert.type}:`,
      err.message
    );
    // Don't throw - never block alert system
  }
}

// ============================================================================
// MAIN NOTIFICATION FUNCTION
// ============================================================================

async function notifyAdmins(alert) {
  if (!alert) {
    logger.warn("No alert provided to notifyAdmins");
    return;
  }

  // Determine if immediate notification should trigger
  if (shouldNotifyImmediately(alert)) {
    logger.info(`Notifying admins immediately for ${alert.type}:${alert._id}`);

    // Email notification (for critical alerts)
    setImmediate(async () => {
      try {
        await sendEmail(alert);
      } catch (err) {
        logger.error("Email notification error:", err.message);
      }
    });
  } else if (shouldIncludeInDigest(alert)) {
    logger.info(`Alert ${alert.type}:${alert._id} queued for daily digest`);
    // Digest is handled by alertDigest.scheduler.js
  }
}

module.exports = {
  notifyAdmins,
  sendEmail,
  shouldNotifyImmediately,
  shouldIncludeInDigest,
};
