const WebSocket = require("ws");
const PingService = require("../services/pingService");

function setupWebSocket(options, db, logger) {
  const wss = new WebSocket.Server(options);
  const pingService = new PingService(db, logger);

  wss.on("connection", (ws) => {
    logger.info("New WebSocket connection");

    ws.pingIntervals = new Set();

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug("Received WebSocket message:", data);

        if (data.type === "start_ping" && data.ip) {
          // Clear existing intervals
          ws.pingIntervals.forEach((interval) => clearInterval(interval));
          ws.pingIntervals.clear();

          // Start new ping interval
          const interval = setInterval(async () => {
            const result = await pingService.executePing(
              data.ip,
              data.packetSize
            );

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "ping_result",
                  ...result,
                })
              );

              // Send statistics every 10 pings
              if (result.success) {
                const stats = await pingService.getStatistics(data.ip);
                ws.send(
                  JSON.stringify({
                    type: "statistics",
                    ...stats,
                  })
                );
              }
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
      ws.pingIntervals.forEach((interval) => clearInterval(interval));
      ws.pingIntervals.clear();
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error:", error);
    });
  });

  return wss;
}

module.exports = { setupWebSocket };
