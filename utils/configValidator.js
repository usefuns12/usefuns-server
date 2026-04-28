/**
 * STEP 7.5 - Configuration Validation
 *
 * Validates .env configuration on server boot
 * Fails fast on misconfiguration
 * Sets safe defaults
 */

const logger = require("../classes/logger");

const CONFIG_SCHEMA = {
  // Database
  MONGODB_URI: {
    required: true,
    type: "string",
    description: "MongoDB connection string",
  },

  // Server
  PORT: {
    required: false,
    type: "number",
    default: 3000,
    description: "Server port",
  },
  NODE_ENV: {
    required: false,
    type: "string",
    default: "development",
    enum: ["development", "production", "test"],
    description: "Environment",
  },

  // JWT
  JWT_SECRET: {
    required: true,
    type: "string",
    minLength: 32,
    description: "JWT secret key (min 32 chars)",
  },
  JWT_EXPIRES_IN: {
    required: false,
    type: "string",
    default: "7d",
    description: "JWT expiration",
  },

  // Email Configuration (optional but validated if enabled)
  EMAIL_ENABLED: {
    required: false,
    type: "boolean",
    default: false,
    description: "Enable email notifications",
  },
  EMAIL_FROM: {
    required: false,
    type: "string",
    requiredIf: "EMAIL_ENABLED",
    description: "Email sender address",
  },
  EMAIL_TO: {
    required: false,
    type: "string",
    requiredIf: "EMAIL_ENABLED",
    description: "Admin email address",
  },
  SMTP_HOST: {
    required: false,
    type: "string",
    requiredIf: "EMAIL_ENABLED",
    description: "SMTP server host",
  },
  SMTP_PORT: {
    required: false,
    type: "number",
    requiredIf: "EMAIL_ENABLED",
    default: 587,
    description: "SMTP server port",
  },
  SMTP_USER: {
    required: false,
    type: "string",
    requiredIf: "EMAIL_ENABLED",
    description: "SMTP username",
  },
  SMTP_PASS: {
    required: false,
    type: "string",
    requiredIf: "EMAIL_ENABLED",
    description: "SMTP password",
  },

  // AWS S3 (if using file uploads)
  AWS_ACCESS_KEY_ID: {
    required: false,
    type: "string",
    description: "AWS access key",
  },
  AWS_SECRET_ACCESS_KEY: {
    required: false,
    type: "string",
    description: "AWS secret key",
  },
  AWS_REGION: {
    required: false,
    type: "string",
    default: "us-east-1",
    description: "AWS region",
  },
  S3_BUCKET: {
    required: false,
    type: "string",
    description: "S3 bucket name",
  },

  // Payment Gateway (optional)
  PAYMENT_GATEWAY_KEY: {
    required: false,
    type: "string",
    description: "Payment gateway API key",
  },
  PAYMENT_GATEWAY_SECRET: {
    required: false,
    type: "string",
    description: "Payment gateway secret",
  },

  // Firebase (for push notifications)
  FIREBASE_PROJECT_ID: {
    required: false,
    type: "string",
    description: "Firebase project ID",
  },

  // Admin Dashboard URL
  ADMIN_DASHBOARD_URL: {
    required: false,
    type: "string",
    default: "http://localhost:4200",
    description: "Admin dashboard URL for links",
  },

  // Redis (if using caching)
  REDIS_HOST: {
    required: false,
    type: "string",
    default: "localhost",
    description: "Redis host",
  },
  REDIS_PORT: {
    required: false,
    type: "number",
    default: 6379,
    description: "Redis port",
  },

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: {
    required: false,
    type: "number",
    default: 900000, // 15 minutes
    description: "Rate limit window in ms",
  },
  RATE_LIMIT_MAX_REQUESTS: {
    required: false,
    type: "number",
    default: 100,
    description: "Max requests per window",
  },
};

/**
 * Validate configuration
 * @returns {Object} { valid: boolean, errors: [], warnings: [] }
 */
function validateConfig() {
  const errors = [];
  const warnings = [];
  const config = process.env;

  logger.info("[ConfigValidator] Starting configuration validation...");

  // Check required fields
  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    const value = config[key];

    // Check if required
    if (schema.required && !value) {
      errors.push(`❌ Missing required config: ${key} - ${schema.description}`);
      continue;
    }

    // Check conditional requirements
    if (schema.requiredIf) {
      const conditionKey = schema.requiredIf;
      const conditionValue = config[conditionKey];

      if (conditionValue === "true" && !value) {
        errors.push(
          `❌ Missing required config: ${key} (required when ${conditionKey}=true) - ${schema.description}`
        );
        continue;
      }
    }

    // Skip validation if not provided and not required
    if (!value) {
      // Set default if available
      if (schema.default !== undefined) {
        process.env[key] = String(schema.default);
        logger.info(`[ConfigValidator] Set default: ${key}=${schema.default}`);
      }
      continue;
    }

    // Type validation
    if (schema.type === "number") {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors.push(
          `❌ Invalid type for ${key}: expected number, got "${value}"`
        );
        continue;
      }
      process.env[key] = String(numValue); // Normalize
    }

    if (schema.type === "boolean") {
      if (value !== "true" && value !== "false") {
        warnings.push(
          `⚠️  Invalid boolean for ${key}: "${value}" (use "true" or "false")`
        );
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(
        `❌ Invalid value for ${key}: "${value}" (allowed: ${schema.enum.join(
          ", "
        )})`
      );
    }

    // Length validation
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(
        `❌ ${key} too short: ${value.length} chars (min: ${schema.minLength})`
      );
    }
  }

  // Security warnings
  if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
    warnings.push(
      "⚠️  JWT_SECRET should be at least 32 characters for security"
    );
  }

  if (
    config.NODE_ENV === "production" &&
    !config.MONGODB_URI?.includes("mongodb+srv://")
  ) {
    warnings.push(
      "⚠️  Production environment should use MongoDB Atlas (mongodb+srv://)"
    );
  }

  if (config.NODE_ENV === "production" && config.PORT === "3000") {
    warnings.push(
      "⚠️  Default port 3000 in production - consider using 80/443 with reverse proxy"
    );
  }

  // Email configuration check
  if (config.EMAIL_ENABLED === "true") {
    const emailFields = [
      "EMAIL_FROM",
      "EMAIL_TO",
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASS",
    ];
    const missingEmail = emailFields.filter((field) => !config[field]);
    if (missingEmail.length > 0) {
      warnings.push(
        `⚠️  Email enabled but missing: ${missingEmail.join(", ")}`
      );
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
  };
}

/**
 * Validate and fail fast on boot
 * Call this before starting the server
 */
function validateOrExit() {
  logger.info("========================================");
  logger.info("       Configuration Validation        ");
  logger.info("========================================");

  const result = validateConfig();

  // Log warnings
  if (result.warnings.length > 0) {
    logger.warn("\n⚠️  WARNINGS:");
    result.warnings.forEach((warning) => logger.warn(`  ${warning}`));
  }

  // Log errors
  if (result.errors.length > 0) {
    logger.error("\n❌ CONFIGURATION ERRORS:");
    result.errors.forEach((error) => logger.error(`  ${error}`));
    logger.error("\n❌ Server startup aborted due to configuration errors");
    logger.error("Fix the errors in your .env file and try again\n");
    process.exit(1);
  }

  logger.info("\n✅ Configuration valid!");
  logger.info(`   Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(
    `   MongoDB: ${process.env.MONGODB_URI ? "✓ Configured" : "✗ Missing"}`
  );
  logger.info(
    `   JWT Secret: ${process.env.JWT_SECRET ? "✓ Configured" : "✗ Missing"}`
  );
  logger.info(
    `   Email: ${
      process.env.EMAIL_ENABLED === "true" ? "✓ Enabled" : "✗ Disabled"
    }`
  );
  logger.info(`   Port: ${process.env.PORT || 3000}`);
  logger.info("========================================\n");

  return true;
}

/**
 * Get current configuration (safe - no secrets)
 */
function getSafeConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3000,
    mongodbConfigured: !!process.env.MONGODB_URI,
    jwtConfigured: !!process.env.JWT_SECRET,
    emailEnabled: process.env.EMAIL_ENABLED === "true",
    awsConfigured:
      !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY,
    firebaseConfigured: !!process.env.FIREBASE_PROJECT_ID,
    paymentConfigured: !!process.env.PAYMENT_GATEWAY_KEY,
    redisConfigured: !!process.env.REDIS_HOST,
  };
}

module.exports = {
  validateConfig,
  validateOrExit,
  getSafeConfig,
  CONFIG_SCHEMA,
};
