const path = require("path");
const { PingMonitor } = require("./src");

async function testMonitor() {
  // Test standalone mode
  console.log("Testing standalone mode...");
  const monitor = new PingMonitor({
    config: {
      database: {
        path: path.join(__dirname, "test-data"),
        filename: "test-ping.db",
      },
      logging: {
        dir: path.join(__dirname, "test-logs"),
        level: "debug",
        filename: {
          error: "test-error.log",
          combined: "test-combined.log",
        },
      },
      server: {
        port: 3030,
        staticDir: path.join(__dirname, "public"),
      },
    },
  });

  try {
    await monitor.initialize();
    await monitor.start();
    console.log("✓ Monitor started successfully");

    // Test a ping request
    const app = monitor.getApp();
    const response = await fetch("http://localhost:3030/api/ping/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ip: "8.8.8.8",
        timeout: 1000,
        packetSize: 32,
        duration: 5000,
      }),
    });

    console.log("✓ Ping API response:", await response.json());

    // Wait for some data
    await new Promise((resolve) => setTimeout(resolve, 6000));

    await monitor.stop();
    console.log("✓ Monitor stopped successfully");
  } catch (error) {
    console.error("✕ Test failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  testMonitor();
}
