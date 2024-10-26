// tests/load-test.js
const { PingMonitor } = require("@baobab/ping");
const WebSocket = require("ws");
const path = require("path");

class PingLoadTest {
  constructor() {
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      minResponseTime: Infinity,
      maxResponseTime: -Infinity,
      avgResponseTime: 0,
      totalResponseTime: 0,
      byTarget: new Map(),
    };

    this.targets = [
      { ip: "8.8.8.8", name: "Google DNS" },
      { ip: "1.1.1.1", name: "Cloudflare DNS" },
      { ip: "google.com", name: "Google" },
      { ip: "cloudflare.com", name: "Cloudflare" },
      { ip: "208.67.222.222", name: "OpenDNS" },
    ];

    this.connections = new Map();
    this.monitor = null;
  }

  initializeStats() {
    this.targets.forEach((target) => {
      this.stats.byTarget.set(target.ip, {
        total: 0,
        successful: 0,
        failed: 0,
        minResponseTime: Infinity,
        maxResponseTime: -Infinity,
        avgResponseTime: 0,
        totalResponseTime: 0,
        packetLoss: 0,
      });
    });
  }

  updateStats(target, result) {
    const targetStats = this.stats.byTarget.get(target);
    const responseTime = result.responseTime;

    // Update global stats
    this.stats.total++;
    if (result.success && responseTime !== null) {
      this.stats.successful++;
      this.stats.totalResponseTime += responseTime;
      this.stats.avgResponseTime =
        this.stats.totalResponseTime / this.stats.successful;
      this.stats.minResponseTime = Math.min(
        this.stats.minResponseTime,
        responseTime
      );
      this.stats.maxResponseTime = Math.max(
        this.stats.maxResponseTime,
        responseTime
      );
    } else {
      this.stats.failed++;
    }

    // Update target-specific stats
    targetStats.total++;
    if (result.success && responseTime !== null) {
      targetStats.successful++;
      targetStats.totalResponseTime += responseTime;
      targetStats.avgResponseTime =
        targetStats.totalResponseTime / targetStats.successful;
      targetStats.minResponseTime = Math.min(
        targetStats.minResponseTime,
        responseTime
      );
      targetStats.maxResponseTime = Math.max(
        targetStats.maxResponseTime,
        responseTime
      );
    } else {
      targetStats.failed++;
    }
    targetStats.packetLoss = (targetStats.failed / targetStats.total) * 100;

    this.logProgress(target, result);
  }

  logProgress(target, result) {
    const targetStats = this.stats.byTarget.get(target);
    const targetInfo = this.targets.find((t) => t.ip === target);
    const timestamp = new Date().toLocaleTimeString();
    const status = result.success ? "✓" : "✗";
    const responseTime = result.success
      ? `${result.responseTime.toFixed(2)}ms`
      : "Failed";

    console.log(
      `[${timestamp}] ${status} ${targetInfo.name} (${target}): ${responseTime}`
    );

    // Log detailed stats every 50 pings per target
    if (targetStats.total % 50 === 0) {
      this.printTargetStats(target);
    }
  }

  printTargetStats(target) {
    const stats = this.stats.byTarget.get(target);
    const targetInfo = this.targets.find((t) => t.ip === target);

    console.log(`\n📊 Stats for ${targetInfo.name} (${target}):`);
    console.log(`   Total Pings: ${stats.total}`);
    console.log(`   Successful: ${stats.successful}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(
      `   Min Response Time: ${
        stats.minResponseTime !== Infinity
          ? stats.minResponseTime.toFixed(2)
          : "N/A"
      }ms`
    );
    console.log(
      `   Max Response Time: ${
        stats.maxResponseTime !== -Infinity
          ? stats.maxResponseTime.toFixed(2)
          : "N/A"
      }ms`
    );
    console.log(`   Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
    console.log(`   Packet Loss: ${stats.packetLoss.toFixed(1)}%\n`);
  }

  printFinalStats() {
    console.log("\n📈 Final Test Results:");
    console.log("====================");
    console.log(`Total Pings Across All Targets: ${this.stats.total}`);
    console.log(`Total Successful: ${this.stats.successful}`);
    console.log(`Total Failed: ${this.stats.failed}`);
    console.log(
      `Overall Packet Loss: ${(
        (this.stats.failed / this.stats.total) *
        100
      ).toFixed(1)}%`
    );
    console.log("\nBy Target:");
    console.log("----------");

    this.targets.forEach((target) => {
      const stats = this.stats.byTarget.get(target.ip);
      console.log(`\n${target.name} (${target.ip}):`);
      console.log(
        `  Success Rate: ${((stats.successful / stats.total) * 100).toFixed(
          1
        )}%`
      );
      console.log(`  Avg Response: ${stats.avgResponseTime.toFixed(2)}ms`);
      console.log(
        `  Min Response: ${
          stats.minResponseTime !== Infinity
            ? stats.minResponseTime.toFixed(2)
            : "N/A"
        }ms`
      );
      console.log(
        `  Max Response: ${
          stats.maxResponseTime !== -Infinity
            ? stats.maxResponseTime.toFixed(2)
            : "N/A"
        }ms`
      );
    });
  }

  async setupWebSocketConnection(target) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${this.monitor.config.server.port}`
      );

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "start_ping",
            ip: target,
            interval: 1000,
            packetSize: 32,
          })
        );
        resolve(ws);
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data);
        if (message.type === "ping_result") {
          this.updateStats(target, message);
        }
      });

      ws.on("error", (error) => {
        console.error(`WebSocket error for ${target}:`, error);
        reject(error);
      });

      this.connections.set(target, ws);
    });
  }

  async run(duration = 10000) {
    let shutdownTimer;
    try {
      this.initializeStats();

      // Setup signal handlers
      let shutdownInProgress = false;
      const handleShutdown = async () => {
        if (shutdownInProgress) return;
        shutdownInProgress = true;

        console.log("\n📤 Initiating graceful shutdown...");

        // Clear the shutdown timer if it exists
        if (shutdownTimer) {
          clearTimeout(shutdownTimer);
        }

        await this.cleanup();
        process.exit(0);
      };

      process.on("SIGINT", handleShutdown);
      process.on("SIGTERM", handleShutdown);

      this.monitor = new PingMonitor({
        config: {
          database: {
            path: path.join(__dirname, "data"),
            filename: "load-test.db",
          },
          logging: {
            dir: path.join(__dirname, "logs"),
            level: "debug",
            filename: {
              error: "load-error.log",
              combined: "load.log",
            },
          },
          server: {
            port: 3001,
          },
        },
      });

      console.log("\n🚀 Starting load test...");
      console.log(`📡 Targets: ${this.targets.map((t) => t.name).join(", ")}`);
      console.log(`⏱️  Duration: ${duration / 1000} seconds\n`);

      await this.monitor.initialize();
      await this.monitor.start();

      console.log("✓ Monitor started");

      // Setup WebSocket connections for all targets
      const connectionPromises = this.targets.map((target) =>
        this.setupWebSocketConnection(target.ip).catch((error) => {
          console.error(
            `Failed to connect to ${target.name} (${target.ip}):`,
            error
          );
          return null;
        })
      );

      const connections = await Promise.all(connectionPromises);
      const successfulConnections = connections.filter(Boolean);

      if (successfulConnections.length === 0) {
        throw new Error("No WebSocket connections could be established");
      }

      console.log(
        `✓ Established ${successfulConnections.length}/${this.targets.length} WebSocket connections\n`
      );

      // Set up test duration timeout
      const testComplete = new Promise((resolve) => {
        shutdownTimer = setTimeout(async () => {
          console.log("\n⏱️ Test duration completed");
          await this.cleanup();
          resolve();
        }, duration);
      });

      // Wait for test completion
      await testComplete;

      // Return stats for programmatic use
      return this.stats;
    } catch (error) {
      console.error("✕ Load test failed:", error);
      await this.cleanup();
      throw error;
    }
  }

  // Add new cleanup method
  async cleanup() {
    try {
      console.log("\nCleaning up...");

      // Print final statistics
      this.printFinalStats();

      // Close all WebSocket connections
      for (const [target, ws] of this.connections.entries()) {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
            console.log(`Closed connection to ${target}`);
          }
        } catch (error) {
          console.error(`Error closing connection to ${target}:`, error);
        }
      }
      this.connections.clear();

      // Stop the monitor
      if (this.monitor) {
        console.log("Stopping monitor...");
        await this.monitor.stop();
        console.log("Monitor stopped");
      }

      console.log("✓ Cleanup completed");
    } catch (error) {
      console.error("Error during cleanup:", error);
      throw error;
    }
  }

  async setupWebSocketConnection(target) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${this.monitor.config.server.port}`
      );

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Connection timeout for ${target}`));
      }, 5000);

      ws.on("open", () => {
        clearTimeout(connectionTimeout);
        ws.send(
          JSON.stringify({
            type: "start_ping",
            ip: target,
            interval: 1000,
            packetSize: 32,
          })
        );
        resolve(ws);
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "ping_result") {
            this.updateStats(target, message);
          }
        } catch (error) {
          console.error(`Error processing message from ${target}:`, error);
        }
      });

      ws.on("error", (error) => {
        clearTimeout(connectionTimeout);
        console.error(`WebSocket error for ${target}:`, error);
        reject(error);
      });

      ws.on("close", () => {
        clearTimeout(connectionTimeout);
        console.log(`Connection to ${target} closed`);
      });

      this.connections.set(target, ws);
    });
  }
}



// Run the test
if (require.main === module) {
  const loadTest = new PingLoadTest();
  loadTest.run(60000).catch((error) => {
    console.error("Test execution failed:", error);
    process.exit(1);
  });
}

module.exports = PingLoadTest;
