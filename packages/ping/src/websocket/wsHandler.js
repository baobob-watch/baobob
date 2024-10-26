const WebSocket = require("ws");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

async function executePing(host) {
  try {
    const command =
      process.platform === "win32" ? `ping -n 1 ${host}` : `ping -c 1 ${host}`;

    const { stdout } = await execAsync(command);
    const time = parsePingOutput(stdout);

    return {
      success: true,
      responseTime: time,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      responseTime: null,
      timestamp: new Date(),
      error: error.message,
    };
  }
}

function parsePingOutput(output) {
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

function setupWebSocket(options, logger) {
  const wss = new WebSocket.Server(options);

  wss.on("connection", (ws) => {
    logger.info("New WebSocket connection");

    // Store active intervals for cleanup
    ws.pingIntervals = new Set();

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug("Received WebSocket message:", data);

        if (data.type === "start_ping" && data.ip) {
          // Clear any existing intervals
          ws.pingIntervals.forEach((interval) => clearInterval(interval));
          ws.pingIntervals.clear();

          // Start new ping interval
          const interval = setInterval(async () => {
            const result = await executePing(data.ip);
            const response = {
              type: "ping_result",
              ip: data.ip,
              ...result,
            };

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(response));
            }
          }, data.interval || 1000);

          ws.pingIntervals.add(interval);
        }
      } catch (error) {
        logger.error("WebSocket message handling error:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: error.message,
            })
          );
        }
      }
    });

    ws.on("close", () => {
      logger.info("WebSocket connection closed");
      // Clean up intervals
      ws.pingIntervals.forEach((interval) => clearInterval(interval));
      ws.pingIntervals.clear();
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error:", error);
    });
  });

  return wss;
}

module.exports = {
  setupWebSocket,
};
