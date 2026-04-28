/**
 * Queue Routes
 * Admin APIs for queue monitoring and management
 */

const express = require("express");
const router = express.Router();
const queueService = require("../services/queue.service");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");
const { logger } = require("../classes/logger");

// Middleware
router.use(userAuth);
router.use(requirePermission("manage_queues"));

/**
 * GET /api/admin/queues/stats
 * Get statistics for all queues
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await queueService.getAllQueuesStats();
    res.json({
      success: true,
      queues: stats,
    });
  } catch (error) {
    logger.error("Failed to get queue stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/queues/:queueName/stats
 * Get statistics for specific queue
 */
router.get("/:queueName/stats", async (req, res) => {
  try {
    const { queueName } = req.params;
    const stats = await queueService.getQueueStats(queueName);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    res.json({
      success: true,
      queue: stats,
    });
  } catch (error) {
    logger.error("Failed to get queue stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/queues/:queueName/jobs
 * Get jobs in a specific queue
 */
router.get("/:queueName/jobs", async (req, res) => {
  try {
    const { queueName } = req.params;
    const { status = "waiting", limit = 20, start = 0 } = req.query;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    let jobs = [];
    switch (status) {
      case "waiting":
        jobs = await queue.getWaiting(start, start + limit - 1);
        break;
      case "active":
        jobs = await queue.getActive(start, start + limit - 1);
        break;
      case "completed":
        jobs = await queue.getCompleted(start, start + limit - 1);
        break;
      case "failed":
        jobs = await queue.getFailed(start, start + limit - 1);
        break;
      case "delayed":
        jobs = await queue.getDelayed(start, start + limit - 1);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: "Invalid status",
        });
    }

    // Format job data
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      data: job.data,
      status: job.getState ? job.getState() : status,
      progress: job.progress ? job.progress() : null,
      attemptsMade: job.attemptsMade,
      createdAt: job.createdTimestamp,
      finishedAt: job.finishedOn,
      failedReason: job.failedReason,
    }));

    res.json({
      success: true,
      queueName,
      status,
      jobs: formattedJobs,
    });
  } catch (error) {
    logger.error("Failed to get queue jobs:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/queues/:queueName/jobs/:jobId
 * Get specific job details
 */
router.get("/:queueName/jobs/:jobId", async (req, res) => {
  try {
    const { queueName, jobId } = req.params;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const state = await job.getState();
    const progress = await job.progress();

    res.json({
      success: true,
      job: {
        id: job.id,
        data: job.data,
        state,
        progress,
        attemptsMade: job.attemptsMade,
        createdAt: job.createdTimestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
      },
    });
  } catch (error) {
    logger.error("Failed to get job details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/queues/:queueName/jobs/:jobId/retry
 * Retry failed job
 */
router.post("/:queueName/jobs/:jobId/retry", async (req, res) => {
  try {
    const { queueName, jobId } = req.params;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    await job.retry();

    res.json({
      success: true,
      message: `Job ${jobId} retrying`,
    });
  } catch (error) {
    logger.error("Failed to retry job:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/admin/queues/:queueName/jobs/:jobId
 * Cancel/remove job
 */
router.delete("/:queueName/jobs/:jobId", async (req, res) => {
  try {
    const { queueName, jobId } = req.params;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    await job.remove();

    res.json({
      success: true,
      message: `Job ${jobId} removed`,
    });
  } catch (error) {
    logger.error("Failed to remove job:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/queues/:queueName/drain
 * Drain queue (remove all waiting jobs)
 */
router.post("/:queueName/drain", async (req, res) => {
  try {
    const { queueName } = req.params;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    const count = await queue.count();
    await queue.clean(0); // Remove all jobs

    res.json({
      success: true,
      message: `Queue ${queueName} drained`,
      jobsRemoved: count,
    });
  } catch (error) {
    logger.error("Failed to drain queue:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/queues/:queueName/pause
 * Pause queue processing
 */
router.post("/:queueName/pause", async (req, res) => {
  try {
    const { queueName } = req.params;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    await queue.pause(true);

    res.json({
      success: true,
      message: `Queue ${queueName} paused`,
    });
  } catch (error) {
    logger.error("Failed to pause queue:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/queues/:queueName/resume
 * Resume queue processing
 */
router.post("/:queueName/resume", async (req, res) => {
  try {
    const { queueName } = req.params;

    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: "Queue not found",
      });
    }

    await queue.resume(true);

    res.json({
      success: true,
      message: `Queue ${queueName} resumed`,
    });
  } catch (error) {
    logger.error("Failed to resume queue:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
