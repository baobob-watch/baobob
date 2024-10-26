// backend/src/services/pingService.js
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const logger = require("../utils/logger");

class PingService {
  constructor(db) {
    this.db = db;
  }

  async monitorHost(params, ws) {
    const { ip, timeout, packetSize, duration } = params;
    const startTime = Date.now();

    // Validate IP/hostname
    if (!ip) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid IP address or hostname",
        })
      );
      return;
    }

    ws.send(
      JSON.stringify({
        type: "info",
        message: `Started monitoring ${ip}`,
      })
    );

    const interval = setInterval(async () => {
      try {
        const result = await this.execPing(ip);
        const pingResult = {
          ...result,
          ip: ip, // Ensure IP is included
          packetSize,
          timeout,
        };

        await this.saveResult(pingResult);

        ws.send(
          JSON.stringify({
            type: "ping",
            timestamp: new Date(),
            responseTime: result.responseTime,
            success: result.success,
            error: result.error,
          })
        );
      } catch (error) {
        logger.error("Ping execution error:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: error.message,
          })
        );
      }

      if (Date.now() - startTime >= duration) {
        this.endMonitoring(ws, interval);
      }
    }, 1000);

    // Store interval for cleanup
    ws.pingInterval = interval;

    // Clean up on WebSocket close
    ws.on("close", () => {
      if (ws.pingInterval) {
        clearInterval(ws.pingInterval);
      }
    });
  }

  async execPing(host) {
    try {
      // Use different commands based on platform
      const cmd =
        process.platform === "win32"
          ? `ping -n 1 ${host}`
          : `ping -c 1 ${host}`;

      const { stdout, stderr } = await execPromise(cmd);

      if (stderr) {
        logger.error("Ping stderr:", stderr);
        return {
          success: false,
          responseTime: null,
          error: stderr,
        };
      }

      // Parse the ping output based on platform
      const time = this.parsePingOutput(stdout);

      return {
        success: true,
        responseTime: time,
        output: stdout,
      };
    } catch (error) {
      logger.error("Ping execution failed:", error);
      return {
        success: false,
        responseTime: null,
        error: error.message,
      };
    }
  }

  parsePingOutput(output) {
    try {
      if (process.platform === "win32") {
        // Parse Windows ping output
        const match = output.match(/time[=<](\d+)ms/);
        return match ? parseFloat(match[1]) : null;
      } else {
        // Parse Unix ping output
        const match = output.match(/time=(\d+\.?\d*) ms/);
        return match ? parseFloat(match[1]) : null;
      }
    } catch (error) {
      logger.error("Error parsing ping output:", error);
      return null;
    }
  }

  async saveResult(result) {
    try {
      // Log the result object for debugging
      logger.debug("Saving ping result:", result);

      // Validate required fields
      if (!result.ip) {
        throw new Error("IP address is required for saving ping result");
      }

      await this.db.run(
        `
                INSERT INTO ping_results (
                    ip, response_time, packet_size, timeout, success
                ) VALUES (?, ?, ?, ?, ?)
            `,
        [
          result.ip,
          result.responseTime,
          result.packetSize,
          result.timeout,
          result.success ? 1 : 0,
        ]
      );
    } catch (error) {
      logger.error("Error saving ping result:", error, "Result:", result);
      // Don't throw the error to prevent stopping the monitoring
    }
  }

  endMonitoring(ws, interval) {
    clearInterval(interval);
    ws.send(
      JSON.stringify({
        type: "info",
        message: "Monitoring finished",
      })
    );
  }

  async getHistory() {
    try {
      return await this.db.all(`
                SELECT 
                    timestamp,
                    ip,
                    response_time as responseTime,
                    packet_size as packetSize,
                    timeout,
                    success
                FROM ping_results 
                WHERE response_time IS NOT NULL
                ORDER BY timestamp DESC 
                LIMIT 1000
            `);
    } catch (error) {
      logger.error("Error fetching ping history:", error);
      return [];
    }
  }
}

module.exports = PingService;
