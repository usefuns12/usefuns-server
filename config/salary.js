const { startSalaryCycleCron } = require("../services/salaryCycle.service");

/**
 * Initialize all salary and commission related services
 * Call this function when the server starts
 */
function initializeSalarySystem() {
  try {
    console.log("🚀 Initializing Salary & Commission System...");

    // Start the salary cycle cron job
    startSalaryCycleCron();

    console.log("✅ Salary & Commission System initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Salary & Commission System:", error);
  }
}

module.exports = { initializeSalarySystem };
