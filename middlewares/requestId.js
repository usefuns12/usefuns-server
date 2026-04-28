const { v4: uuidv4 } = require("uuid");

/**
 * STEP 7.4 - Request ID Middleware
 *
 * Adds unique request ID to every API call
 * Enables request tracing across logs
 */

function requestIdMiddleware(req, res, next) {
  // Generate or use existing request ID
  const requestId = req.headers["x-request-id"] || uuidv4();

  // Attach to request
  req.requestId = requestId;

  // Add to response headers for client tracking
  res.setHeader("X-Request-ID", requestId);

  next();
}

module.exports = requestIdMiddleware;
