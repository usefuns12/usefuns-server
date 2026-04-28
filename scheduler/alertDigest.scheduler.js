const cron = require("node-cron");
const models = require("../models");
const Alert = models.Alert;

const logger = console;

/**
 * STEP 5.7: Daily Alert Digest Scheduler
 * Sends daily summary of non-critical alerts to admins via Email
 * Runs once per day at 8:00 AM
 */

async function sendDailyDigest() {
  if (process.env.EMAIL_ENABLED !== "true") {
    logger.info("Daily digest skipped: Email notifications disabled");
    return;
  }

  try {
    logger.info("========== DAILY ALERT DIGEST START ==========");

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch alerts from last 24 hours
    const newAlerts = await Alert.find({
      createdAt: { $gte: oneDayAgo },
      severity: { $ne: "critical" },
    }).sort({ createdAt: -1 });

    // Fetch unresolved critical alerts (from any time)
    const criticalAlerts = await Alert.find({
      severity: "critical",
      status: { $in: ["open", "acknowledged"] },
    }).sort({ createdAt: -1 });

    // Fetch alerts open > 3 days
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const stalAlerts = await Alert.find({
      createdAt: { $lt: threeDaysAgo },
      status: { $in: ["open", "acknowledged"] },
    }).sort({ createdAt: 1 });

    // Metrics
    const allAlerts = await Alert.find({
      status: { $in: ["open", "acknowledged"] },
    });
    const metrics = {
      openAlerts: allAlerts.length,
      criticalAlerts: allAlerts.filter((a) => a.severity === "critical").length,
      newIn24h: newAlerts.length,
      staleOver3Days: stalAlerts.length,
    };

    logger.info(`Daily digest metrics:`, metrics);

    // Send Email digest
    if (process.env.EMAIL_ENABLED === "true") {
      await sendEmailDigest(newAlerts, criticalAlerts, stalAlerts, metrics);
    }

    logger.info("========== DAILY ALERT DIGEST END ==========");
  } catch (err) {
    logger.error("Error in daily alert digest:", err.message);
  }
}

async function sendEmailDigest(
  newAlerts,
  criticalAlerts,
  staleAlerts,
  metrics
) {
  if (
    !process.env.EMAIL_FROM ||
    !process.env.EMAIL_TO ||
    !process.env.SMTP_HOST
  ) {
    logger.warn("Email configuration incomplete");
    return;
  }

  try {
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const alertTable = (alerts, title) => {
      if (alerts.length === 0) {
        return `<p><strong>${title}:</strong> None</p>`;
      }

      const rows = alerts
        .slice(0, 10)
        .map(
          (a) =>
            `<tr><td>${a.type}</td><td>${a.severity}</td><td>${
              a.referenceType
            }:${a.referenceId}</td><td>${new Date(
              a.createdAt
            ).toLocaleString()}</td></tr>`
        )
        .join("");

      return `
        <h3>${title}</h3>
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
          <tr><th>Type</th><th>Severity</th><th>Reference</th><th>Created</th></tr>
          ${rows}
        </table>
      `;
    };

    const emailBody = `
      <h1>📊 Daily Alert Digest</h1>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      
      <h2>📈 Summary</h2>
      <ul>
        <li><strong>Open Alerts:</strong> ${metrics.openAlerts} (${
      metrics.criticalAlerts
    } critical)</li>
        <li><strong>New in 24h:</strong> ${metrics.newIn24h}</li>
        <li><strong>Stale (>3 days):</strong> ${metrics.staleOver3Days}</li>
      </ul>

      <h2>🚨 Unresolved Critical Alerts</h2>
      ${alertTable(criticalAlerts, "Critical")}

      <h2>📌 New Alerts (24h)</h2>
      ${alertTable(newAlerts, "New")}

      <h2>🕐 Stale Alerts (>3 days)</h2>
      ${alertTable(staleAlerts, "Stale")}

      <p><a href="${
        process.env.ADMIN_DASHBOARD_URL || "N/A"
      }/alerts" style="padding: 10px 20px; background-color: #0099FF; color: white; text-decoration: none; border-radius: 5px;">View All Alerts</a></p>

      <hr/>
      <p><em>UseFunc Alert System - Daily Digest</em></p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `📊 Daily Alert Digest - ${metrics.openAlerts} Open`,
      html: emailBody,
    });

    logger.info("Daily Email digest sent successfully");
  } catch (err) {
    logger.error("Failed to send Email daily digest:", err.message);
  }
}

/**
 * Schedule daily digest - runs at 8:00 AM every day
 */
function scheduleAlertDigest() {
  logger.info("📅 Alert Digest Scheduler initialized");
  logger.info("   Runs: Daily at 08:00 AM");

  // Cron: 0 8 * * * (8:00 AM every day)
  cron.schedule("0 8 * * *", async () => {
    logger.info("🔔 Triggering daily alert digest...");
    await sendDailyDigest();
  });

  // Also run once at startup (for testing)
  // Comment out in production
  // sendDailyDigest();
}

module.exports = {
  scheduleAlertDigest,
  sendDailyDigest,
  sendEmailDigest,
};
