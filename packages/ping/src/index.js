const express = require("express");
// const path = require("path");
const http = require("http");
// const WebSocket = require("ws");
const { setupWebSocket } = require("./websocket/wsHandler");
const defaultConfig = require("./config/defaultConfig");
const { validateConfig } = require("./utils/configValidator");
const { setupLogger } = require("./utils/logger");
const { initializeDatabase } = require("./db/database");

class PingMonitor {
  constructor(options) {
    this.config = validateConfig({ ...defaultConfig, ...options.config });
    this.app = options.app || express();
    this.logger = setupLogger(this.config.logging);

    // Enable JSON parsing
    this.app.use(express.json());
  }

  async initialize() {
    try {
      // Initialize database
      this.db = await initializeDatabase(this.config.database);

      // Setup routes
      await this.setupRoutes();

      // Serve static files if configured
      if (this.config.server?.staticDir) {
        this.app.use(express.static(this.config.server.staticDir));
      }

      this.logger.info("Ping monitor initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize ping monitor:", error);
      throw error;
    }
  }

  async setupRoutes() {
    const router = express.Router();

    // Ping start endpoint
    router.post("/start", async (req, res) => {
      try {
        const {
          ip,
          timeout = 1000,
          packetSize = 32,
          duration = 60000,
        } = req.body;

        if (!ip) {
          return res.status(400).json({
            status: "error",
            message: "IP address is required",
          });
        }

        this.logger.info(`Starting ping monitoring for ${ip}`);

        res.json({
          status: "success",
          message: "Ping monitoring started",
          params: { ip, timeout, packetSize, duration },
        });
      } catch (error) {
        this.logger.error("Error starting ping:", error);
        res.status(500).json({
          status: "error",
          message: error.message,
        });
      }
    });

    // Get ping history
    router.get("/history", async (req, res) => {
      try {
        const results = await this.db.all(`
                    SELECT * FROM ping_results 
                    ORDER BY timestamp DESC 
                    LIMIT 100
                `);
        res.json(results);
      } catch (error) {
        this.logger.error("Error fetching history:", error);
        res.status(500).json({
          status: "error",
          message: "Failed to fetch history",
        });
      }
    });

    // Mount the router
    this.app.use("/api/ping", router);
  }

  // async start() {
  //   if (!this.config.server?.port) {
  //     return;
  //   }

  //   try {
  //     // Create HTTP server
  //     this.server = http.createServer(this.app);

  //     // Setup WebSocket
  //     this.wss = new WebSocket.Server({ server: this.server });

  //     // Start listening
  //     this.server.listen(this.config.server.port, () => {
  //       this.logger.info(
  //         `Ping monitor server running on port ${this.config.server.port}`
  //       );
  //     });

  //     // WebSocket connection handling
  //     this.wss.on("connection", (ws) => {
  //       this.logger.info("New WebSocket connection");

  //       ws.on("message", (message) => {
  //         try {
  //           const data = JSON.parse(message);
  //           this.logger.debug("Received WebSocket message:", data);
  //         } catch (error) {
  //           this.logger.error("WebSocket message error:", error);
  //         }
  //       });

  //       ws.on("close", () => {
  //         this.logger.info("WebSocket connection closed");
  //       });
  //     });
  //   } catch (error) {
  //     this.logger.error("Failed to start ping monitor:", error);
  //     throw error;
  //   }
  // }

  async start() {
    if (!this.config.server?.port) {
      return;
    }

    try {
      this.server = http.createServer(this.app);
      this.wss = setupWebSocket({ server: this.server }, this.logger);

      this.server.listen(this.config.server.port, () => {
        this.logger.info(
          `Ping monitor server running on port ${this.config.server.port}`
        );
      });
    } catch (error) {
      this.logger.error("Failed to start ping monitor:", error);
      throw error;
    }
  }

  async stop() {
    try {
      if (this.wss) {
        this.wss.close();
      }
      if (this.server) {
        this.server.close();
      }
      if (this.db) {
        await this.db.close();
      }
      this.logger.info("Ping monitor stopped");
    } catch (error) {
      this.logger.error("Error stopping ping monitor:", error);
      throw error;
    }
  }
}

module.exports = { PingMonitor };
