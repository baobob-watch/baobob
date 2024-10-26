const { PingMonitor } = require("@baobab/ping");
const path = require("path");
const WebSocket = require("ws");

async function testBasic() {
  const monitor = new PingMonitor({
    config: {
      database: {
        path: path.join(__dirname, "data"),
        filename: "basic-test.db",
      },
      logging: {
        dir: path.join(__dirname, "logs"),
        level: "debug",
        filename: {
          error: "basic-error.log",
          combined: "basic.log",
        },
      },
      server: {
        port: 3000,
      },
    },
  });

  let ws;
  let pingStats = {
    total: 0,
    success: 0,
    failed: 0,
    min: Infinity,
    max: -Infinity,
    avg: 0,
    sum: 0,
  };

  try {
    await monitor.initialize();
    await monitor.start();
    console.log("\n🚀 Monitor started");
    console.log("-------------------");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("📡 Connecting to WebSocket...");

    // Create WebSocket connection promise
    const wsConnected = new Promise((resolve, reject) => {
      ws = new WebSocket("ws://localhost:3000");

      ws.on("open", () => {
        console.log("🔌 WebSocket connected\n");
        ws.send(
          JSON.stringify({
            type: "start_ping",
            ip: "192.168.1.1",
            interval: 1000,
          })
        );
        resolve();
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "ping_result") {
          pingStats.total++;

          const timestamp = new Date(message.timestamp).toLocaleTimeString();
          if (message.success && message.responseTime !== null) {
            pingStats.success++;
            pingStats.sum += message.responseTime;
            pingStats.min = Math.min(pingStats.min, message.responseTime);
            pingStats.max = Math.max(pingStats.max, message.responseTime);
            pingStats.avg = pingStats.sum / pingStats.success;
            console.log(
              `[${timestamp}] ✓ Response time: ${message.responseTime.toFixed(
                2
              )}ms`
            );
          } else {
            pingStats.failed++;
            console.log(`[${timestamp}] ✗ Failed to ping ${message.ip}`);
          }

          // Show stats every 5 pings
          if (pingStats.total % 5 === 0) {
            console.log("\n📊 Current Statistics:");
            console.log(
              `   Successful: ${pingStats.success}/${pingStats.total}`
            );
            console.log(
              `   Min: ${
                pingStats.min !== Infinity ? pingStats.min.toFixed(2) : "N/A"
              }ms`
            );
            console.log(
              `   Max: ${
                pingStats.max !== -Infinity ? pingStats.max.toFixed(2) : "N/A"
              }ms`
            );
            console.log(`   Avg: ${pingStats.avg.toFixed(2)}ms`);
            console.log(
              `   Packet Loss: ${(
                (pingStats.failed / pingStats.total) *
                100
              ).toFixed(1)}%\n`
            );
          }
        }
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      });

      setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
    });

    await wsConnected;

    // Run for 30 seconds
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log("\n📊 Final Statistics:");
    console.log("-------------------");
    console.log(`Total Pings: ${pingStats.total}`);
    console.log(`Successful: ${pingStats.success}`);
    console.log(`Failed: ${pingStats.failed}`);
    console.log(
      `Min: ${pingStats.min !== Infinity ? pingStats.min.toFixed(2) : "N/A"}ms`
    );
    console.log(
      `Max: ${pingStats.max !== -Infinity ? pingStats.max.toFixed(2) : "N/A"}ms`
    );
    console.log(`Avg: ${pingStats.avg.toFixed(2)}ms`);
    console.log(
      `Packet Loss: ${((pingStats.failed / pingStats.total) * 100).toFixed(1)}%`
    );
    console.log("-------------------");
  } catch (error) {
    console.error("✕ Test failed:", error);
    process.exit(1);
  } finally {
    if (ws) {
      ws.close();
    }
    await monitor.stop();
  }
}

testBasic().catch(console.error);
