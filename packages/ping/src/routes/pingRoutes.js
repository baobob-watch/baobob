const express = require("express");
const { validatePingParams } = require("../utils/configValidator");
const { execPing } = require("../services/pingService");

function setupRoutes(app, db, logger) {
  const router = express.Router();

  // Enable JSON parsing
  router.use(express.json());

  router.post("/start", async (req, res) => {
    try {
      const params = {
        ip: req.body.ip,
        timeout: req.body.timeout || 1000,
        packetSize: req.body.packetSize || 32,
        duration: req.body.duration || 60000,
      };

      logger.info("Received ping request:", params);

      // Start ping monitoring
      res.json({
        status: "success",
        message: "Ping monitoring started",
        params,
      });
    } catch (error) {
      logger.error("Error starting ping:", error);
      res.status(400).json({
        status: "error",
        message: error.message,
      });
    }
  });

  router.get("/history", async (req, res) => {
    try {
      const results = await db.all(`
                SELECT * FROM ping_results 
                ORDER BY timestamp DESC 
                LIMIT 100
            `);
      res.json(results);
    } catch (error) {
      logger.error("Error fetching history:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch history",
      });
    }
  });

  // Mount the router at /api/ping
  app.use("/api/ping", router);
}

module.exports = { setupRoutes };
