/**
 * Queue Service
 * Manages job queues for async task processing using Bull
 *
 * Jobs:
 * - salary_cycle: Process salary and commission cycles
 * - wallet_unlock: Unlock frozen wallets after lock duration
 * - health_scan: Daily system health check
 * - fraud_expiry: Expire fraud actions and clean up
 * - alert_digest: Send batched alert emails
 */

const Queue = require("bull");
const { logger } = require("../classes/logger");
const metrics = require("./metrics.service");

// Queue instances
const queues = {};

// Queue names and their configurations
const QUEUE_CONFIG = {
  salary_cycle: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
      timeout: 300000, // 5 minutes
    },
    settings: {
      maxStalledCount: 2,
      lockDuration: 30000,
      lockRenewTime: 15000,
    },
  },
  wallet_unlock: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "fixed",
        delay: 5000,
      },
      removeOnComplete: { age: 3600 }, // Keep 1 hour
      timeout: 60000, // 1 minute
    },
  },
  health_scan: {
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      timeout: 120000, // 2 minutes
    },
  },
  fraud_expiry: {
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      timeout: 60000, // 1 minute
    },
  },
  alert_digest: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "fixed",
        delay: 10000,
      },
      removeOnComplete: true,
      timeout: 120000, // 2 minutes
    },
  },
};

/**
 * Initialize all queues
 * Must be called on server startup
 */
async function initializeQueues() {
  try {
    const redis = require("../config/redis").client;

    for (const [queueName, config] of Object.entries(QUEUE_CONFIG)) {
      queues[queueName] = new Queue(queueName, {
        redis,
        defaultJobOptions: config.defaultJobOptions,
        settings: config.settings || {},
      });

      // Event listeners
      queues[queueName].on("error", (error) => {
        logger.error(`Queue ${queueName} error:`, error);
      });

      queues[queueName].on("failed", (job, error) => {
        logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
        metrics.trackError(`queue_job_failed`, {
          queue: queueName,
          jobId: job.id,
          attempt: job.attemptsMade,
        });
      });

      queues[queueName].on("completed", (job) => {
        logger.info(`Job ${job.id} in queue ${queueName} completed`, {
          processingTime: job.finishedOn - job.processedOn,
        });
        metrics.trackCronExecution(
          queueName,
          job.finishedOn - job.processedOn,
          true
        );
      });

      logger.info(`Queue initialized: ${queueName}`);
    }

    return queues;
  } catch (error) {
    logger.error("Failed to initialize queues:", error);
    throw error;
  }
}

/**
 * Add job to queue
 */
async function addJob(queueName, jobData, options = {}) {
  if (!queues[queueName]) {
    throw new Error(`Queue ${queueName} not initialized`);
  }

  try {
    const job = await queues[queueName].add(jobData, {
      ...QUEUE_CONFIG[queueName].defaultJobOptions,
      ...options,
      jobId: options.jobId || undefined, // Allow custom job IDs for idempotency
    });

    logger.info(`Job added to ${queueName}:`, {
      jobId: job.id,
      data: jobData,
    });

    return job;
  } catch (error) {
    logger.error(`Failed to add job to ${queueName}:`, error);
    throw error;
  }
}

/**
 * Schedule recurring job (replaces cron)
 *
 * cronPattern examples:
 * "0 0 * * *" - Every day at midnight
 * "0 * * * *" - Every hour
 * "0 2 1 * *" - 1st of month at 2 AM
 */
async function scheduleRecurringJob(
  queueName,
  jobData,
  cronPattern,
  options = {}
) {
  if (!queues[queueName]) {
    throw new Error(`Queue ${queueName} not initialized`);
  }

  try {
    const job = await queues[queueName].add(jobData, {
      ...QUEUE_CONFIG[queueName].defaultJobOptions,
      ...options,
      repeat: {
        cron: cronPattern,
        tz: "UTC",
      },
    });

    logger.info(`Recurring job scheduled in ${queueName}:`, {
      jobId: job.id,
      cronPattern,
      data: jobData,
    });

    return job;
  } catch (error) {
    logger.error(`Failed to schedule recurring job in ${queueName}:`, error);
    throw error;
  }
}

/**
 * Get queue instance
 */
function getQueue(queueName) {
  return queues[queueName];
}

/**
 * Get all queues
 */
function getAllQueues() {
  return queues;
}

/**
 * Get queue stats
 */
async function getQueueStats(queueName) {
  const queue = queues[queueName];
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Get all queues stats (for monitoring)
 */
async function getAllQueuesStats() {
  const stats = {};
  for (const queueName of Object.keys(queues)) {
    stats[queueName] = await getQueueStats(queueName);
  }
  return stats;
}

/**
 * Process job in queue
 * Call this in queue consumers
 */
function createJobProcessor(processorFn) {
  return async (job) => {
    const startTime = Date.now();
    try {
      logger.info(`Processing job ${job.id}:`, job.data);
      const result = await processorFn(job);
      const duration = Date.now() - startTime;
      logger.info(`Job ${job.id} completed in ${duration}ms`);
      return result;
    } catch (error) {
      logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  };
}

/**
 * Close all queues gracefully
 */
async function closeQueues() {
  try {
    for (const [queueName, queue] of Object.entries(queues)) {
      await queue.close();
      logger.info(`Queue closed: ${queueName}`);
    }
  } catch (error) {
    logger.error("Failed to close queues:", error);
  }
}

module.exports = {
  initializeQueues,
  addJob,
  scheduleRecurringJob,
  getQueue,
  getAllQueues,
  getQueueStats,
  getAllQueuesStats,
  createJobProcessor,
  closeQueues,
  QUEUE_CONFIG,
};
