const logger = require("../classes/logger");

/**
 * STEP 7.4 - Request Timing Middleware
 *
 * Measures execution time for every API request
 * Logs slow requests (>1s)
 * Enables performance monitoring
 */

const SLOW_REQUEST_THRESHOLD_MS = 1000; // 1 second

function requestTimingMiddleware(req, res, next) {
  const startTime = Date.now();

  // Capture original res.json to log after response
  const originalJson = res.json;

  res.json = function (body) {
    const duration = Date.now() - startTime;

    // Log request details
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers["user-agent"],
    };

    // Log slow requests
    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(
        `[SlowRequest] ${req.method} ${req.path} - ${duration}ms`,
        logData
      );
    } else {
      logger.info(`[Request] ${req.method} ${req.path} - ${duration}ms`);
    }

    // Call original json method
    return originalJson.call(this, body);
  };

  next();
}

module.exports = requestTimingMiddleware;
