const path = require("path");

const config = {
  port: process.env.PORT || 3000,
  dbPath: path.join(__dirname, "../../data/ping_monitor.db"),
  logConfig: {
    level: process.env.LOG_LEVEL || "info",
    format: {
      timestamp: true,
      json: true,
    },
    files: {
      error: path.join(__dirname, "../../logs/error.log"),
      combined: path.join(__dirname, "../../logs/combined.log"),
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

// Verify config
Object.entries(config).forEach(([key, value]) => {
  if (value === undefined) {
    throw new Error(`Configuration error: ${key} is undefined`);
  }
});

module.exports = config;
