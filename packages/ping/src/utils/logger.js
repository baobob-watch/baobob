const winston = require("winston");
const path = require("path");
const fs = require("fs");

/**
 * Setup logger with given configuration
 * @param {Object} config - Logger configuration
 * @returns {winston.Logger} Configured logger instance
 */
function setupLogger(config) {
  // Ensure log directory exists
  fs.mkdirSync(config.dir, { recursive: true });

  const logger = winston.createLogger({
    level: config.level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(config.dir, config.filename.error),
        level: "error",
      }),
      new winston.transports.File({
        filename: path.join(config.dir, config.filename.combined),
      }),
    ],
  });

  // Add console transport in development
  if (process.env.NODE_ENV !== "production") {
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    );
  }

  return logger;
}

module.exports = {
  setupLogger,
};
