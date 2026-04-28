/**
 * STEP 7.4 - Metrics Service
 *
 * Tracks application metrics:
 * - Request counts
 * - Error rates
 * - Cron job success/failure
 * - Performance metrics
 *
 * In-memory metrics (can be extended to Prometheus/StatsD)
 */

const logger = require("../classes/logger");

class MetricsService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byPath: {},
        byStatusCode: {},
      },
      errors: {
        total: 0,
        byType: {},
        recentErrors: [], // Last 100 errors
      },
      cronJobs: {
        executions: {},
        failures: {},
        lastRun: {},
      },
      performance: {
        slowRequests: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
      },
      database: {
        queries: 0,
        slowQueries: 0,
      },
    };

    this.startTime = new Date();
  }

  // ========== Request Metrics ==========

  /**
   * Track API request
   */
  trackRequest(method, path, statusCode, durationMs) {
    this.metrics.requests.total++;

    // By method
    this.metrics.requests.byMethod[method] =
      (this.metrics.requests.byMethod[method] || 0) + 1;

    // By path (normalize IDs)
    const normalizedPath = path.replace(/\/[0-9a-f]{24}/gi, "/:id");
    this.metrics.requests.byPath[normalizedPath] =
      (this.metrics.requests.byPath[normalizedPath] || 0) + 1;

    // By status code
    this.metrics.requests.byStatusCode[statusCode] =
      (this.metrics.requests.byStatusCode[statusCode] || 0) + 1;

    // Track performance
    if (durationMs > 1000) {
      this.metrics.performance.slowRequests++;
    }

    if (durationMs > this.metrics.performance.maxResponseTime) {
      this.metrics.performance.maxResponseTime = durationMs;
    }

    // Update average (simple moving average)
    const totalRequests = this.metrics.requests.total;
    this.metrics.performance.avgResponseTime =
      (this.metrics.performance.avgResponseTime * (totalRequests - 1) +
        durationMs) /
      totalRequests;
  }

  // ========== Error Metrics ==========

  /**
   * Track error
   */
  trackError(error, context = {}) {
    this.metrics.errors.total++;

    // By error type
    const errorType = error.name || "UnknownError";
    this.metrics.errors.byType[errorType] =
      (this.metrics.errors.byType[errorType] || 0) + 1;

    // Store recent errors (last 100)
    this.metrics.errors.recentErrors.unshift({
      timestamp: new Date(),
      type: errorType,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 3).join("\n"), // First 3 lines
      context,
    });

    if (this.metrics.errors.recentErrors.length > 100) {
      this.metrics.errors.recentErrors.pop();
    }
  }

  // ========== Cron Job Metrics ==========

  /**
   * Track cron job execution
   */
  trackCronExecution(jobName, success, durationMs, error = null) {
    if (!this.metrics.cronJobs.executions[jobName]) {
      this.metrics.cronJobs.executions[jobName] = 0;
      this.metrics.cronJobs.failures[jobName] = 0;
    }

    this.metrics.cronJobs.executions[jobName]++;
    this.metrics.cronJobs.lastRun[jobName] = {
      timestamp: new Date(),
      success,
      durationMs,
      error: error ? error.message : null,
    };

    if (!success) {
      this.metrics.cronJobs.failures[jobName]++;
      logger.error(`[Metrics] Cron job failed: ${jobName} - ${error?.message}`);
    }
  }

  // ========== Database Metrics ==========

  /**
   * Track database query
   */
  trackQuery(durationMs) {
    this.metrics.database.queries++;

    if (durationMs > 100) {
      // Slow query > 100ms
      this.metrics.database.slowQueries++;
      logger.warn(`[Metrics] Slow query detected: ${durationMs}ms`);
    }
  }

  // ========== Getters ==========

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime.getTime(),
      startTime: this.startTime.toISOString(),
    };
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeHours = (uptime / 1000 / 60 / 60).toFixed(2);

    return {
      uptime: `${uptimeHours} hours`,
      requests: {
        total: this.metrics.requests.total,
        errorRate: this.getErrorRate(),
        avgResponseTime: `${this.metrics.performance.avgResponseTime.toFixed(
          2
        )}ms`,
      },
      errors: {
        total: this.metrics.errors.total,
        recentCount: this.metrics.errors.recentErrors.length,
      },
      cronJobs: {
        total: Object.keys(this.metrics.cronJobs.executions).length,
        failures: Object.values(this.metrics.cronJobs.failures).reduce(
          (a, b) => a + b,
          0
        ),
      },
      database: {
        queries: this.metrics.database.queries,
        slowQueries: this.metrics.database.slowQueries,
      },
    };
  }

  /**
   * Get error rate (%)
   */
  getErrorRate() {
    const total = this.metrics.requests.total;
    const errors = this.metrics.errors.total;

    if (total === 0) return "0%";

    return `${((errors / total) * 100).toFixed(2)}%`;
  }

  /**
   * Get top slow endpoints
   */
  getSlowEndpoints(limit = 10) {
    // This would require tracking per-endpoint timing
    // For now, return placeholder
    return {
      message: "Per-endpoint metrics not yet tracked",
      totalSlowRequests: this.metrics.performance.slowRequests,
    };
  }

  /**
   * Get cron job health
   */
  getCronHealth() {
    const jobs = {};

    for (const [jobName, lastRun] of Object.entries(
      this.metrics.cronJobs.lastRun
    )) {
      const executions = this.metrics.cronJobs.executions[jobName];
      const failures = this.metrics.cronJobs.failures[jobName];
      const successRate =
        executions > 0
          ? (((executions - failures) / executions) * 100).toFixed(2)
          : "0";

      jobs[jobName] = {
        lastRun: lastRun.timestamp,
        success: lastRun.success,
        successRate: `${successRate}%`,
        totalExecutions: executions,
        totalFailures: failures,
      };
    }

    return jobs;
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byPath: {},
        byStatusCode: {},
      },
      errors: {
        total: 0,
        byType: {},
        recentErrors: [],
      },
      cronJobs: {
        executions: {},
        failures: {},
        lastRun: {},
      },
      performance: {
        slowRequests: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
      },
      database: {
        queries: 0,
        slowQueries: 0,
      },
    };

    this.startTime = new Date();
    logger.info("[Metrics] Metrics reset");
  }
}

// Singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
