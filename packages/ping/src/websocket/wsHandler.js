const WebSocket = require("ws");
const PingService = require("../services/pingService");

/**
 * Setup WebSocket server with ping monitoring capabilities
 * @param {Object} options Configuration options
 * @param {import('http').Server} options.server HTTP server instance
 * @param {Object} options.logger Winston logger instance
 * @param {Object} options.db Database instance
 * @returns {WebSocket.Server} Configured WebSocket server
 */
function setupWebSocket({ server, logger, db }) {
  // Validate required dependencies
  if (!server) {
    throw new Error("HTTP server is required for WebSocket setup");
  }
  if (!logger) {
    throw new Error("Logger is required for WebSocket setup");
  }
  if (!db) {
    throw new Error("Database instance is required for WebSocket setup");
  }

  const wss = new WebSocket.Server({ server });
  const pingService = new PingService(db, logger);
  const activeConnections = new Set();
  let activePingSessions = 0;

  // Your existing connection handler
  wss.on("connection", (ws) => {
    logger.info("New WebSocket connection");
    activeConnections.add(ws);
    ws.pingIntervals = new Set();
    ws.isActive = false; // Track if this connection is doing pings
    ws.startTime = Date.now(); // Track connection duration

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug("Received WebSocket message:", data);

        if (data.type === "start_ping" && data.ip) {
          ws.isActive = true;
          ws.targetIp = data.ip; // Track target IP for status
          activePingSessions++;
          logger.debug(`Active ping sessions: ${activePingSessions}`);

          // Clear existing intervals
          ws.pingIntervals.forEach((interval) => clearInterval(interval));
          ws.pingIntervals.clear();

          const interval = setInterval(async () => {
            if (!pingService.isShuttingDown) {
              const result = await pingService.executePing(
                data.ip,
                data.packetSize
              );

              if (ws.readyState === WebSocket.OPEN && result) {
                ws.send(
                  JSON.stringify({
                    type: "ping_result",
                    ...result,
                  })
                );
                // Update statistics
                ws.lastPingTime = Date.now();
                ws.totalPings = (ws.totalPings || 0) + 1;
                ws.successfulPings =
                  (ws.successfulPings || 0) + (result.success ? 1 : 0);
              }
            }
          }, data.interval || 1000);

          ws.pingIntervals.add(interval);
        }
      } catch (error) {
        if (!pingService.isShuttingDown) {
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
      }
    });

    // Your existing close handler
    ws.on("close", () => {
      if (ws.isActive) {
        activePingSessions--;
        logger.debug(`Active ping sessions: ${activePingSessions}`);
      }
      ws.pingIntervals.forEach((interval) => clearInterval(interval));
      ws.pingIntervals.clear();
      activeConnections.delete(ws);
      logger.info("WebSocket connection closed");
    });

    // Your existing error handler
    ws.on("error", (error) => {
      if (!pingService.isShuttingDown) {
        logger.error("WebSocket error:", error);
      }
    });
  });

  // Your existing shutdown method
  wss.shutdown = async () => {
    logger.info("Starting WebSocket server shutdown...");
    logger.info(`Active ping sessions: ${activePingSessions}`);

    // Check if shutdown method exists before calling
    if (typeof pingService.shutdown === "function") {
      pingService.shutdown();
    } else {
      logger.warn("PingService shutdown method not available");
    }

    pingService.shutdown();

    // First, stop all ping intervals
    for (const ws of activeConnections) {
      try {
        // Notify clients about shutdown
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "shutdown",
              message: "Server is shutting down",
            })
          );
        }

        ws.pingIntervals.forEach((interval) => clearInterval(interval));
        ws.pingIntervals.clear();
      } catch (error) {
        logger.error("Error during interval cleanup:", error);
      }
    }

    // Wait for any in-progress ping operations to complete
    let waitAttempts = 0;
    const maxWaitAttempts = 10; // Maximum 10 seconds wait

    while (activePingSessions > 0 && waitAttempts < maxWaitAttempts) {
      logger.info(
        `Waiting for ${activePingSessions} active ping sessions to complete...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      waitAttempts++;
    }

    // Close all WebSocket connections
    const closePromises = Array.from(activeConnections).map((ws) => {
      return new Promise((resolve) => {
        ws.close();
        resolve();
      });
    });

    await Promise.all(closePromises);
    activeConnections.clear();

    // Finally close the WebSocket server
    return new Promise((resolve) => {
      wss.close(() => {
        logger.info("WebSocket server shut down completely");
        resolve();
      });
    });
  };

  // Add status/health check method
  wss.getStatus = () => {
    const connectionDetails = Array.from(activeConnections).map((ws) => ({
      targetIp: ws.targetIp,
      isActive: ws.isActive,
      uptime: Date.now() - ws.startTime,
      totalPings: ws.totalPings || 0,
      successfulPings: ws.successfulPings || 0,
      lastPingTime: ws.lastPingTime,
      readyState: ws.readyState,
    }));

    return {
      activeConnections: activeConnections.size,
      activePingSessions,
      isShuttingDown: pingService.isShuttingDown,
      connections: connectionDetails,
      serverUptime: process.uptime(),
      detailed: {
        totalPings: connectionDetails.reduce(
          (sum, conn) => sum + (conn.totalPings || 0),
          0
        ),
        successfulPings: connectionDetails.reduce(
          (sum, conn) => sum + (conn.successfulPings || 0),
          0
        ),
        activeTargets: [
          ...new Set(
            connectionDetails.map((conn) => conn.targetIp).filter(Boolean)
          ),
        ],
      },
    };
  };

  return wss;
}

module.exports = { setupWebSocket };
