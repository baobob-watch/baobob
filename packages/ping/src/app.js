const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const fs = require("fs").promises;
const config = require("./config/config");
const Database = require("./db/database");
const PingService = require("./services/pingService");
const setupPingRoutes = require("./routes/pingRoutes");
const setupWebSocket = require("./websocket/wsHandler");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");

// Ensure required directories exist
async function ensureDirectories() {
  const dirs = [
    path.join(__dirname, "../logs"),
    path.join(__dirname, "../data"),
    path.join(__dirname, "../public"),
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Directory created/verified: ${dir}`);
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
      throw error;
    }
  }
}

// Verify frontend file exists
async function verifyFrontendFile() {
  const frontendPath = path.join(__dirname, "../public/index.html");
  try {
    await fs.access(frontendPath);
    console.log("Frontend file verified:", frontendPath);
  } catch (error) {
    console.error("Frontend file missing:", frontendPath);
    throw new Error(
      "Frontend file (index.html) is missing from public directory"
    );
  }
}

async function createApp() {
  try {
    console.log("Starting application initialization...");

    // Ensure required directories exist
    await ensureDirectories();

    // Verify frontend file
    await verifyFrontendFile();

    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // Initialize database
    console.log("Initializing database...");
    const db = await Database.init();
    console.log("Database initialized successfully");

    const pingService = new PingService(db);

    // Middleware
    app.use(express.json());
    app.use(express.static(path.join(__dirname, "../public")));

    // Routes
    app.use("/api/ping", setupPingRoutes(pingService, wss));

    // WebSocket setup
    setupWebSocket(wss);

    // Error handling
    app.use(errorHandler);

    return { app, server };
  } catch (error) {
    console.error("Application initialization failed:", error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    console.log("Starting server...");
    const { app, server } = await createApp();

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      logger.info(`Server running on port ${config.port}`);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      logger.error("Unhandled Rejection:", reason);
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = createApp;
