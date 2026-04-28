/**
 * CHAOS TESTING SUITE
 * Test system resilience under failure conditions
 *
 * Run with: node scripts/chaosTesting.js --failure=database --duration=60
 */

const axios = require("axios");
const { logger } = require("../classes/logger");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN;

/**
 * Failure Scenarios
 */
const FAILURES = {
  database: {
    name: "Database Connection Failure",
    description: "Simulate temporary database unavailability",
    injectFn: simulateDatabaseFailure,
    recoveryFn: recoverDatabaseFailure,
  },
  redis: {
    name: "Redis Connection Failure",
    description: "Simulate Redis cache unavailability",
    injectFn: simulateRedisFailure,
    recoveryFn: recoverRedisFailure,
  },
  timeout: {
    name: "Request Timeout",
    description: "Simulate slow/timeout responses",
    injectFn: simulateTimeoutFailure,
    recoveryFn: recoverTimeoutFailure,
  },
  networkLatency: {
    name: "High Network Latency",
    description: "Add artificial latency to responses",
    injectFn: simulateNetworkLatency,
    recoveryFn: recoverNetworkLatency,
  },
  memory: {
    name: "Memory Pressure",
    description: "Simulate high memory usage",
    injectFn: simulateMemoryPressure,
    recoveryFn: recoverMemoryPressure,
  },
};

/**
 * Test Metrics for Chaos Testing
 */
class ChaosTestMetrics {
  constructor() {
    this.requests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.recoveredRequests = 0;
    this.responseTimes = [];
    this.failureStartTime = null;
    this.failureEndTime = null;
    this.recoveryTime = null;
    this.errors = [];
  }

  trackRequest(success, responseTime) {
    this.requests++;
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
    this.responseTimes.push(responseTime);
  }

  markFailureStart() {
    this.failureStartTime = Date.now();
  }

  markFailureEnd() {
    this.failureEndTime = Date.now();
  }

  markRecovery() {
    if (this.failureStartTime && this.failureEndTime) {
      this.recoveryTime = this.failureEndTime - this.failureStartTime;
    }
  }

  trackError(error) {
    this.errors.push({
      message: error.message,
      timestamp: new Date(),
    });
  }

  getStats() {
    const successRate = (
      (this.successfulRequests / this.requests) *
      100
    ).toFixed(2);
    const avgResponseTime = (
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
    ).toFixed(2);

    return {
      totalRequests: this.requests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate: successRate + "%",
      avgResponseTime: avgResponseTime + "ms",
      maxResponseTime: Math.max(...this.responseTimes).toFixed(2) + "ms",
      failureDuration: this.failureEndTime - this.failureStartTime + "ms",
      recoveryTime: this.recoveryTime ? this.recoveryTime + "ms" : "N/A",
      errors: this.errors.slice(0, 10),
    };
  }
}

/**
 * Failure Injection Functions
 */

async function simulateDatabaseFailure() {
  console.log("💥 Injecting database failure...");
  // Send signal to app to disconnect from MongoDB
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/inject`,
      {
        failure: "database",
        action: "disconnect",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log(
      "⚠️ Could not inject failure via API, database may not support this"
    );
  }
}

async function recoverDatabaseFailure() {
  console.log("🔧 Recovering database connection...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/recover`,
      {
        failure: "database",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("Database recovery attempted");
  }
}

async function simulateRedisFailure() {
  console.log("💥 Injecting Redis failure...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/inject`,
      {
        failure: "redis",
        action: "disconnect",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("⚠️ Could not inject Redis failure");
  }
}

async function recoverRedisFailure() {
  console.log("🔧 Recovering Redis connection...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/recover`,
      {
        failure: "redis",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("Redis recovery attempted");
  }
}

async function simulateTimeoutFailure() {
  console.log("💥 Injecting timeout failures...");
  // Middleware or controller would add artificial delay
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/inject`,
      {
        failure: "timeout",
        delay: 5000,
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("⚠️ Could not inject timeout");
  }
}

async function recoverTimeoutFailure() {
  console.log("🔧 Removing timeout injection...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/recover`,
      {
        failure: "timeout",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("Timeout recovery attempted");
  }
}

async function simulateNetworkLatency() {
  console.log("💥 Injecting network latency...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/inject`,
      {
        failure: "latency",
        latency: 1000, // 1 second
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("⚠️ Could not inject latency");
  }
}

async function recoverNetworkLatency() {
  console.log("🔧 Removing latency injection...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/recover`,
      {
        failure: "latency",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("Latency recovery attempted");
  }
}

async function simulateMemoryPressure() {
  console.log("💥 Injecting memory pressure...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/inject`,
      {
        failure: "memory",
        pressure: "high",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("⚠️ Could not inject memory pressure");
  }
}

async function recoverMemoryPressure() {
  console.log("🔧 Recovering from memory pressure...");
  try {
    await axios.post(
      `${BASE_URL}/api/admin/chaos/recover`,
      {
        failure: "memory",
      },
      {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      }
    );
  } catch (error) {
    console.log("Memory recovery attempted");
  }
}

/**
 * Run Chaos Test
 */
async function runChaosTest(failureType, duration = 60) {
  const failure = FAILURES[failureType];
  if (!failure) {
    console.error("Unknown failure type:", failureType);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("CHAOS TEST:", failure.name);
  console.log("=".repeat(60));
  console.log("Description:", failure.description);
  console.log("Duration:", duration + "s");

  const metrics = new ChaosTestMetrics();
  const endTime = Date.now() + duration * 1000;
  const failureStartTime = Date.now() + 5 * 1000; // Wait 5 seconds before injecting
  const failureEndTime = failureStartTime + 30 * 1000; // 30 second failure window

  try {
    // Phase 1: Baseline (5 seconds before failure)
    console.log("\n📊 PHASE 1: Baseline (5s before failure)");
    while (Date.now() < failureStartTime) {
      const response = await makeTestRequest(metrics);
      await sleep(100);
    }

    // Phase 2: Inject failure
    console.log("\n💥 PHASE 2: Failure Injection");
    metrics.markFailureStart();
    await failure.injectFn();

    // Keep making requests during failure
    while (Date.now() < failureEndTime) {
      await makeTestRequest(metrics);
      await sleep(100);
    }

    // Phase 3: Recover
    console.log("\n🔧 PHASE 3: Recovery");
    await failure.recoveryFn();
    metrics.markFailureEnd();
    metrics.markRecovery();

    // Phase 4: Verify recovery (continue for remaining time)
    console.log("\n✅ PHASE 4: Verify Recovery");
    while (Date.now() < endTime) {
      await makeTestRequest(metrics);
      await sleep(100);
    }

    // Print results
    console.log("\n" + "=".repeat(60));
    console.log("CHAOS TEST RESULTS");
    console.log("=".repeat(60));
    console.log(JSON.stringify(metrics.getStats(), null, 2));

    // Assessment
    const successRate = parseFloat(metrics.getStats().successRate);
    console.log("\n" + "=".repeat(60));
    console.log("ASSESSMENT");
    console.log("=".repeat(60));

    if (successRate > 95) {
      console.log("✅ EXCELLENT: System recovered well (>95% success rate)");
    } else if (successRate > 80) {
      console.log("⚠️ GOOD: System recovered (>80% success rate)");
    } else {
      console.log("❌ POOR: System struggled to recover (<80% success rate)");
    }

    if (metrics.recoveryTime && metrics.recoveryTime < 10000) {
      console.log(
        "✅ FAST: Recovery time <10s (",
        metrics.recoveryTime + "ms",
        ")"
      );
    } else {
      console.log(
        "⚠️ SLOW: Recovery time >10s (",
        metrics.recoveryTime + "ms",
        ")"
      );
    }

    process.exit(successRate > 80 ? 0 : 1);
  } catch (error) {
    console.error("Chaos test failed:", error);
    process.exit(1);
  }
}

async function makeTestRequest(metrics) {
  const startTime = Date.now();

  try {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      timeout: 10000,
    });

    const responseTime = Date.now() - startTime;
    metrics.trackRequest(response.status === 200, responseTime);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metrics.trackRequest(false, responseTime);
    metrics.trackError(error);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main
 */
const args = process.argv.slice(2);
const failureType =
  args.find((arg) => arg.startsWith("--failure="))?.split("=")[1] || "database";
const duration = parseInt(
  args.find((arg) => arg.startsWith("--duration="))?.split("=")[1] || "60"
);

runChaosTest(failureType, duration);
