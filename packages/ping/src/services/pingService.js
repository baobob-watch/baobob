const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

class PingService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.isShuttingDown = false;
  }

  async executePing(host, packetSize = 32) {
    try {
      if (this.isShuttingDown) {
        this.logger.warn(
          "Ping service is shutting down, skipping ping execution"
        );
        return null;
      }

      const command =
        process.platform === "win32"
          ? `ping -n 1 -l ${packetSize} ${host}`
          : `ping -c 1 -s ${packetSize} ${host}`;

      const { stdout } = await execAsync(command);
      const responseTime = this.parsePingOutput(stdout);

      const result = {
        timestamp: new Date(),
        ip: host,
        responseTime,
        packetSize,
        success: responseTime !== null,
      };

      if (!this.isShuttingDown) {
        await this.savePingResult(result);
      }

      return result;
    } catch (error) {
      this.logger.error("Ping execution error:", error);
      return {
        timestamp: new Date(),
        ip: host,
        responseTime: null,
        packetSize,
        success: false,
        error: error.message,
      };
    }
  }

  parsePingOutput(output) {
    try {
      if (process.platform === "win32") {
        const match = output.match(/time[=<](\d+)ms/);
        return match ? parseFloat(match[1]) : null;
      } else {
        const match = output.match(/time=([\d.]+) ms/);
        return match ? parseFloat(match[1]) : null;
      }
    } catch (error) {
      return null;
    }
  }

  async savePingResult(result) {
    try {
      if (this.isShuttingDown) return;

      // Check if database is still open
      if (!this.db || this.db.open === false) {
        throw new Error("Database connection is closed");
      }

      await this.db.run(
        `
                INSERT INTO ping_results (
                    timestamp,
                    ip,
                    response_time,
                    packet_size,
                    success
                ) VALUES (?, ?, ?, ?, ?)
            `,
        [
          result.timestamp.toISOString(),
          result.ip,
          result.responseTime,
          result.packetSize,
          result.success ? 1 : 0,
        ]
      );

      this.logger.debug("Ping result saved:", result);
    } catch (error) {
      this.logger.error("Error saving ping result:", error);
      throw error;
    }
  }

  // Add the shutdown method
  shutdown() {
    this.logger.info("Shutting down ping service");
    this.isShuttingDown = true;
  }

  // Optional: Add method to check service status
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      dbConnected: this.db && this.db.open === true,
    };
  }

  async getHistory(options = {}) {
    const {
      ip = null,
      limit = 1000,
      offset = 0,
      startTime = null,
      endTime = null,
    } = options;

    try {
      let query = `
                SELECT 
                    timestamp,
                    ip,
                    response_time as responseTime,
                    packet_size as packetSize,
                    success
                FROM ping_results
                WHERE 1=1
            `;
      const params = [];

      if (ip) {
        query += " AND ip = ?";
        params.push(ip);
      }

      if (startTime) {
        query += " AND timestamp >= ?";
        params.push(startTime.toISOString());
      }

      if (endTime) {
        query += " AND timestamp <= ?";
        params.push(endTime.toISOString());
      }

      query += ` 
                ORDER BY timestamp DESC 
                LIMIT ? OFFSET ?
            `;
      params.push(limit, offset);

      const results = await this.db.all(query, params);
      return results.map((result) => ({
        ...result,
        timestamp: new Date(result.timestamp),
      }));
    } catch (error) {
      this.logger.error("Error fetching ping history:", error);
      throw error;
    }
  }

  async getStatistics(ip, timeRange = "1h") {
    try {
      const timeConstraint = this.getTimeConstraint(timeRange);

      const stats = await this.db.get(
        `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                    MIN(CASE WHEN success = 1 THEN response_time END) as min_time,
                    MAX(CASE WHEN success = 1 THEN response_time END) as max_time,
                    AVG(CASE WHEN success = 1 THEN response_time END) as avg_time,
                    (CAST(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS FLOAT) / 
                     COUNT(*) * 100.0) as packet_loss
                FROM ping_results
                WHERE ip = ?
                AND timestamp >= datetime('now', ?)
            `,
        [ip, timeConstraint]
      );

      return {
        totalPings: stats.total,
        successfulPings: stats.successful,
        failedPings: stats.total - stats.successful,
        minResponseTime: stats.min_time,
        maxResponseTime: stats.max_time,
        avgResponseTime: stats.avg_time,
        packetLoss: stats.packet_loss,
      };
    } catch (error) {
      this.logger.error("Error fetching ping statistics:", error);
      throw error;
    }
  }

  getTimeConstraint(timeRange) {
    switch (timeRange) {
      case "1h":
        return "-1 hour";
      case "24h":
        return "-24 hours";
      case "7d":
        return "-7 days";
      case "30d":
        return "-30 days";
      default:
        return "-1 hour";
    }
  }
}

module.exports = PingService;
