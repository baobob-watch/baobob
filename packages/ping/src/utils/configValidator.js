const joi = require("joi");
const path = require("path");

/**
 * Validation schema for ping monitor configuration
 */
const configSchema = joi.object({
  database: joi
    .object({
      path: joi.string().required(),
      filename: joi.string().required(),
    })
    .required(),

  logging: joi
    .object({
      dir: joi.string().required(),
      level: joi
        .string()
        .valid("error", "warn", "info", "debug")
        .default("info"),
      filename: joi
        .object({
          error: joi.string().required(),
          combined: joi.string().required(),
        })
        .required(),
    })
    .required(),

  ping: joi
    .object({
      minTimeout: joi.number().min(100).max(5000).default(100),
      maxTimeout: joi.number().min(1000).max(10000).default(5000),
      minPacketSize: joi.number().min(32).max(65507).default(32),
      maxPacketSize: joi.number().min(32).max(65507).default(65507),
      minDuration: joi.number().min(1000).default(1000),
      maxDuration: joi.number().min(1000).max(3600000).default(3600000),
    })
    .required(),

  server: joi
    .object({
      port: joi.number().port(),
      staticDir: joi.string(),
    })
    .optional(),
});

/**
 * Validate and process configuration
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validated and processed configuration
 * @throws {Error} If configuration is invalid
 */
function validateConfig(config) {
  // First validate the config structure
  const { error, value } = configSchema.validate(config, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  // Process paths to ensure they're absolute
  const processedConfig = {
    ...value,
    database: {
      ...value.database,
      path: path.resolve(value.database.path),
    },
    logging: {
      ...value.logging,
      dir: path.resolve(value.logging.dir),
    },
  };

  if (processedConfig.server?.staticDir) {
    processedConfig.server.staticDir = path.resolve(
      processedConfig.server.staticDir
    );
  }

  return processedConfig;
}

/**
 * Validate ping request parameters
 * @param {Object} params - Ping request parameters
 * @returns {Object} Validated parameters
 * @throws {Error} If parameters are invalid
 */
function validatePingParams(params, config) {
  const schema = joi.object({
    ip: joi
      .string()
      .ip({
        version: ["ipv4", "ipv6"],
      })
      .required(),
    timeout: joi
      .number()
      .min(config.ping.minTimeout)
      .max(config.ping.maxTimeout)
      .default(1000),
    packetSize: joi
      .number()
      .min(config.ping.minPacketSize)
      .max(config.ping.maxPacketSize)
      .default(32),
    duration: joi
      .number()
      .min(config.ping.minDuration)
      .max(config.ping.maxDuration)
      .default(60000),
  });

  const { error, value } = schema.validate(params);
  if (error) {
    throw new Error(`Invalid ping parameters: ${error.message}`);
  }

  return value;
}

module.exports = {
  validateConfig,
  validatePingParams,
};
