/**
 * LOAD TESTING SUITE
 * Test UseFuns platform under high traffic and stress conditions
 *
 * Run with: node scripts/loadTesting.js --scenario=gifting --duration=60 --users=100
 */

const axios = require("axios");
const { logger } = require("../classes/logger");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN;

/**
 * Load Test Configuration
 */
const SCENARIOS = {
  gifting: {
    name: "High Volume Gifting",
    description: "Simulate users rapidly sending gifts",
    duration: 60, // seconds
    rampUp: 5, // seconds to reach peak
    users: 50,
    requestsPerUserPerSecond: 2,
  },
  salary: {
    name: "Large Salary Cycle",
    description: "Process salary for 10,000+ hosts simultaneously",
    duration: 120, // seconds
    rampUp: 10,
    hosts: 10000,
    batchSize: 1000,
  },
  alertFlood: {
    name: "Alert Flood",
    description: "System receives 1000s of alerts per minute",
    duration: 60,
    rampUp: 5,
    alertsPerSecond: 100,
  },
  fraudBurst: {
    name: "Fraud Action Burst",
    description: "Fraud system processes 100s of alerts simultaneously",
    duration: 60,
    rampUp: 5,
    fraudAlertsPerSecond: 50,
  },
  concurrent: {
    name: "Concurrent Operations",
    description: "All operations happening simultaneously",
    duration: 120,
    rampUp: 10,
    users: 100,
    hosts: 5000,
    alertsPerSecond: 50,
    giftsPerSecond: 100,
  },
};

/**
 * Test Metrics
 */
class LoadTestMetrics {
  constructor() {
    this.requests = 0;
    this.responses = 0;
    this.errors = 0;
    this.responseTimes = [];
    this.startTime = null;
    this.endTime = null;
    this.errorDetails = [];
    this.statusCodes = {};
  }

  trackRequest() {
    this.requests++;
  }

  trackResponse(statusCode, responseTime) {
    this.responses++;
    this.responseTimes.push(responseTime);
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;
  }

  trackError(error) {
    this.errors++;
    this.errorDetails.push({
      message: error.message,
      code: error.code,
      timestamp: new Date(),
    });
  }

  getStats() {
    const duration = (this.endTime - this.startTime) / 1000; // seconds
    const responseTimes = this.responseTimes.sort((a, b) => a - b);

    return {
      duration: duration.toFixed(2) + "s",
      totalRequests: this.requests,
      totalResponses: this.responses,
      totalErrors: this.errors,
      errorRate: ((this.errors / this.requests) * 100).toFixed(2) + "%",
      rps: (this.responses / duration).toFixed(2),
      avgResponseTime:
        (
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        ).toFixed(2) + "ms",
      p50ResponseTime:
        responseTimes[Math.floor(responseTimes.length * 0.5)].toFixed(2) + "ms",
      p95ResponseTime:
        responseTimes[Math.floor(responseTimes.length * 0.95)].toFixed(2) +
        "ms",
      p99ResponseTime:
        responseTimes[Math.floor(responseTimes.length * 0.99)].toFixed(2) +
        "ms",
      maxResponseTime: Math.max(...responseTimes).toFixed(2) + "ms",
      statusCodes: this.statusCodes,
      sampleErrors: this.errorDetails.slice(0, 5),
    };
  }
}

/**
 * SCENARIO 1: HIGH VOLUME GIFTING
 */
async function runGiftingLoadTest(config) {
  console.log("\n🎁 SCENARIO: High Volume Gifting");
  console.log(
    "Simulating",
    config.users,
    "users sending",
    config.requestsPerUserPerSecond,
    "gifts/sec each"
  );

  const metrics = new LoadTestMetrics();
  metrics.startTime = Date.now();

  // Create test users
  const users = await createTestUsers(config.users);
  const hosts = await createTestHosts(Math.ceil(config.users / 2));

  const endTime = Date.now() + config.duration * 1000;
  const rampUpEndTime = Date.now() + config.rampUp * 1000;
  let currentLoad = 0;

  console.log(`\nSending gifts for ${config.duration}s...`);

  while (Date.now() < endTime) {
    // Ramp up load gradually
    if (Date.now() < rampUpEndTime) {
      currentLoad = (Date.now() - metrics.startTime) / (config.rampUp * 1000);
    } else {
      currentLoad = 1.0;
    }

    // Send gifts from random users to random hosts
    const promises = [];
    const activeUsers = Math.ceil(config.users * currentLoad);

    for (let i = 0; i < activeUsers; i++) {
      for (let j = 0; j < config.requestsPerUserPerSecond; j++) {
        const user = users[i % users.length];
        const host = hosts[Math.floor(Math.random() * hosts.length)];

        promises.push(sendGift(user, host, metrics));
      }
    }

    await Promise.all(promises);
    await sleep(1000); // 1 second between batches
  }

  metrics.endTime = Date.now();
  return metrics.getStats();
}

async function sendGift(user, host, metrics) {
  metrics.trackRequest();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${BASE_URL}/api/gifts`,
      {
        receiver: host._id,
        diamonds: Math.floor(Math.random() * 1000) + 10, // 10-1010 diamonds
      },
      {
        headers: { Authorization: `Bearer ${user.token}` },
        timeout: 5000,
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.trackResponse(response.status, responseTime);
  } catch (error) {
    metrics.trackError(error);
  }
}

/**
 * SCENARIO 2: LARGE SALARY CYCLE PROCESSING
 */
async function runSalaryLoadTest(config) {
  console.log("\n💰 SCENARIO: Large Salary Cycle");
  console.log("Processing salary for", config.hosts, "hosts");

  const metrics = new LoadTestMetrics();
  metrics.startTime = Date.now();

  // Create test hosts
  const hosts = await createTestHosts(config.hosts);

  console.log(
    `\nProcessing ${config.hosts} hosts in batches of ${config.batchSize}...`
  );

  const totalBatches = Math.ceil(config.hosts / config.batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchHosts = hosts.slice(
      batch * config.batchSize,
      (batch + 1) * config.batchSize
    );

    const promises = batchHosts.map((host) =>
      processSalaryForHost(host, metrics)
    );

    await Promise.all(promises);
    console.log(`✓ Batch ${batch + 1}/${totalBatches} completed`);
  }

  metrics.endTime = Date.now();
  return metrics.getStats();
}

async function processSalaryForHost(host, metrics) {
  metrics.trackRequest();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${BASE_URL}/api/admin/salary/process`,
      { hostId: host._id },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
        timeout: 30000,
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.trackResponse(response.status, responseTime);
  } catch (error) {
    metrics.trackError(error);
  }
}

/**
 * SCENARIO 3: ALERT FLOOD
 */
async function runAlertFloodTest(config) {
  console.log("\n⚠️ SCENARIO: Alert Flood");
  console.log("Generating", config.alertsPerSecond, "alerts/second");

  const metrics = new LoadTestMetrics();
  metrics.startTime = Date.now();

  const endTime = Date.now() + config.duration * 1000;
  const rampUpEndTime = Date.now() + config.rampUp * 1000;
  let currentLoad = 0;

  console.log(`\nGenerating alerts for ${config.duration}s...`);

  while (Date.now() < endTime) {
    // Ramp up load
    if (Date.now() < rampUpEndTime) {
      currentLoad = (Date.now() - metrics.startTime) / (config.rampUp * 1000);
    } else {
      currentLoad = 1.0;
    }

    const activeAlertsPerSecond = Math.ceil(
      config.alertsPerSecond * currentLoad
    );
    const promises = [];

    for (let i = 0; i < activeAlertsPerSecond; i++) {
      promises.push(createAlert(metrics));
    }

    await Promise.all(promises);
    await sleep(1000);
  }

  metrics.endTime = Date.now();
  return metrics.getStats();
}

async function createAlert(metrics) {
  metrics.trackRequest();
  const startTime = Date.now();

  try {
    const alertTypes = [
      "gift_velocity",
      "gift_loop",
      "wallet_mismatch",
      "fraud_suspected",
    ];
    const response = await axios.post(
      `${BASE_URL}/api/alerts`,
      {
        type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
        severity: "high",
        referenceId: Math.random().toString(),
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
        timeout: 5000,
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.trackResponse(response.status, responseTime);
  } catch (error) {
    metrics.trackError(error);
  }
}

/**
 * SCENARIO 4: FRAUD DETECTION BURST
 */
async function runFraudBurstTest(config) {
  console.log("\n🚨 SCENARIO: Fraud Detection Burst");
  console.log("Processing", config.fraudAlertsPerSecond, "fraud alerts/second");

  const metrics = new LoadTestMetrics();
  metrics.startTime = Date.now();

  const endTime = Date.now() + config.duration * 1000;
  const rampUpEndTime = Date.now() + config.rampUp * 1000;
  let currentLoad = 0;

  console.log(`\nProcessing fraud alerts for ${config.duration}s...`);

  while (Date.now() < endTime) {
    // Ramp up
    if (Date.now() < rampUpEndTime) {
      currentLoad = (Date.now() - metrics.startTime) / (config.rampUp * 1000);
    } else {
      currentLoad = 1.0;
    }

    const activeAlerts = Math.ceil(config.fraudAlertsPerSecond * currentLoad);
    const promises = [];

    for (let i = 0; i < activeAlerts; i++) {
      promises.push(triggerFraudCheck(metrics));
    }

    await Promise.all(promises);
    await sleep(1000);
  }

  metrics.endTime = Date.now();
  return metrics.getStats();
}

async function triggerFraudCheck(metrics) {
  metrics.trackRequest();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${BASE_URL}/api/admin/fraud/check`,
      {
        type: "gift_velocity",
        userId: Math.random().toString(),
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
        timeout: 5000,
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.trackResponse(response.status, responseTime);
  } catch (error) {
    metrics.trackError(error);
  }
}

/**
 * SCENARIO 5: CONCURRENT OPERATIONS
 */
async function runConcurrentTest(config) {
  console.log("\n🔄 SCENARIO: Concurrent Operations");
  console.log("All operations running simultaneously");

  const metrics = new LoadTestMetrics();
  metrics.startTime = Date.now();

  const users = await createTestUsers(config.users);
  const hosts = await createTestHosts(config.hosts);

  const endTime = Date.now() + config.duration * 1000;
  const rampUpEndTime = Date.now() + config.rampUp * 1000;

  console.log(`\nRunning concurrent operations for ${config.duration}s...`);

  while (Date.now() < endTime) {
    const currentLoad = Math.min(
      1.0,
      (Date.now() - metrics.startTime) / (config.rampUp * 1000)
    );

    const promises = [
      // Gifting
      ...Array(Math.ceil(config.users * config.rampUp * currentLoad))
        .fill(null)
        .map(() => {
          const user = users[Math.floor(Math.random() * users.length)];
          const host = hosts[Math.floor(Math.random() * hosts.length)];
          return sendGift(user, host, metrics);
        }),

      // Alerts
      ...Array(Math.ceil(config.alertsPerSecond * currentLoad))
        .fill(null)
        .map(() => createAlert(metrics)),

      // Fraud checks
      ...Array(Math.ceil(config.fraudAlertsPerSecond * currentLoad))
        .fill(null)
        .map(() => triggerFraudCheck(metrics)),
    ];

    await Promise.all(promises);
    await sleep(1000);
  }

  metrics.endTime = Date.now();
  return metrics.getStats();
}

/**
 * Helper Functions
 */

async function createTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    // In real test, create actual users via API or database
    users.push({
      _id: `user_${i}`,
      token: TEST_ADMIN_TOKEN, // Use test token for now
    });
  }
  return users;
}

async function createTestHosts(count) {
  const hosts = [];
  for (let i = 0; i < count; i++) {
    hosts.push({
      _id: `host_${i}`,
    });
  }
  return hosts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main Test Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const scenarioName =
    args.find((arg) => arg.startsWith("--scenario="))?.split("=")[1] ||
    "gifting";

  const scenario = SCENARIOS[scenarioName];
  if (!scenario) {
    console.error("Unknown scenario:", scenarioName);
    console.log("Available scenarios:", Object.keys(SCENARIOS).join(", "));
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("USEFUNS LOAD TEST");
  console.log("=".repeat(60));
  console.log(scenario.description);
  console.log("Base URL:", BASE_URL);

  try {
    let stats;

    switch (scenarioName) {
      case "gifting":
        stats = await runGiftingLoadTest(SCENARIOS.gifting);
        break;
      case "salary":
        stats = await runSalaryLoadTest(SCENARIOS.salary);
        break;
      case "alertFlood":
        stats = await runAlertFloodTest(SCENARIOS.alertFlood);
        break;
      case "fraudBurst":
        stats = await runFraudBurstTest(SCENARIOS.fraudBurst);
        break;
      case "concurrent":
        stats = await runConcurrentTest(SCENARIOS.concurrent);
        break;
    }

    console.log("\n" + "=".repeat(60));
    console.log("TEST RESULTS");
    console.log("=".repeat(60));
    console.log(JSON.stringify(stats, null, 2));

    // Pass/fail criteria
    const errorRate = parseFloat(stats.errorRate);
    const p95 = parseFloat(stats.p95ResponseTime);

    console.log("\n" + "=".repeat(60));
    console.log("ASSESSMENT");
    console.log("=".repeat(60));

    if (errorRate > 5) {
      console.log("❌ FAILED: Error rate >5% (", stats.errorRate, ")");
    } else {
      console.log("✅ PASSED: Error rate acceptable (", stats.errorRate, ")");
    }

    if (p95 > 1000) {
      console.log(
        "❌ FAILED: P95 response time >1s (",
        stats.p95ResponseTime,
        ")"
      );
    } else {
      console.log(
        "✅ PASSED: P95 response time <1s (",
        stats.p95ResponseTime,
        ")"
      );
    }

    process.exit(errorRate > 5 || p95 > 1000 ? 1 : 0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();
