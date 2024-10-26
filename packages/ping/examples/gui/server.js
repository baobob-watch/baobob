// server.js
const express = require("express");
const path = require("path");
const { PingMonitor } = require("@baobab/ping");

async function startServer() {
  try {
    const monitor = new PingMonitor({
      config: {
        database: {
          path: path.join(__dirname, "data"),
          filename: "ping_monitor.db",
        },
        logging: {
          dir: path.join(__dirname, "logs"),
          level: "debug",
          filename: {
            error: "error.log",
            combined: "combined.log",
          },
        },
        server: {
          port: 3000,
          staticDir: path.join(__dirname, "public"), // Serve frontend files
        },
      },
    });

    // Initialize and start the monitor
    await monitor.initialize();
    await monitor.start();

    console.log("Ping Monitor server running on port 3000");

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nInitiating graceful shutdown...");
      await monitor.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
