const path = require("path");

/**
 * @typedef {Object} PingConfig
 * @property {Object} database - Database configuration
 * @property {string} database.path - Database directory path
 * @property {string} database.filename - Database filename
 * @property {Object} logging - Logging configuration
 * @property {string} logging.dir - Log directory path
 * @property {string} logging.level - Log level
 * @property {Object} logging.filename - Log filenames
 * @property {string} logging.filename.error - Error log filename
 * @property {string} logging.filename.combined - Combined log filename
 * @property {Object} ping - Ping configuration
 * @property {number} ping.minTimeout - Minimum timeout in ms
 * @property {number} ping.maxTimeout - Maximum timeout in ms
 * @property {number} ping.minPacketSize - Minimum packet size
 * @property {number} ping.maxPacketSize - Maximum packet size
 * @property {number} ping.minDuration - Minimum duration in ms
 * @property {number} ping.maxDuration - Maximum duration in ms
 * @property {Object} [server] - Optional server configuration
 * @property {number} [server.port] - Server port
 * @property {string} [server.staticDir] - Static files directory
 */

/**
 * Default configuration for the ping monitor
 * @type {PingConfig}
 */
const defaultConfig = {
  database: {
    path: process.cwd(),
    filename: "ping_monitor.db",
  },
  logging: {
    dir: path.join(process.cwd(), "logs"),
    level: "info",
    filename: {
      error: "error.log",
      combined: "combined.log",
    },
  },
  ping: {
    minTimeout: 100,
    maxTimeout: 5000,
    minPacketSize: 32,
    maxPacketSize: 65507,
    minDuration: 1000,
    maxDuration: 3600000,
  },
};

module.exports = defaultConfig;
