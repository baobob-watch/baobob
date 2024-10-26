# Ping Monitor

A real-time network monitoring tool built with Node.js that allows you to track and visualize ping response times for any IP address or hostname. The application provides a clean web interface with real-time graphs and statistics.

<!-- ![Ping Monitor Screenshot](../../doc/images/ping-monitor-screenshot.jpg) -->

## Features

- Real-time ping monitoring with configurable parameters
- Interactive D3.js visualization of response times
- Live statistics (min, max, average response times)
- Configurable timeout, packet size, and duration
- Historical data storage using SQLite
- Cross-platform support (Windows, Linux, macOS)
- WebSocket-based real-time updates
- Responsive web interface
- Error handling and status notifications

## Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- ICMP ping permissions on your system

## Installation

1. Clone the repository:
```bash
npm i @baobob/ping
```

2. Usage:
```js

const { PingMonitor } = require("@baobab/ping");
const path = require("path");
const WebSocket = require("ws");

async function displayDatabaseStats(db) {
  try {
    const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                MIN(response_time) as min_time,
                MAX(response_time) as max_time,
                AVG(response_time) as avg_time
            FROM ping_results
            WHERE ip = '8.8.8.8'
        `);

    console.log("\n📊 Database Statistics:");
    console.log("----------------------");
    console.log(`Total Records: ${stats.total}`);
    console.log(`Successful Pings: ${stats.successful}`);
    console.log(`Failed Pings: ${stats.total - stats.successful}`);
    console.log(`Min Response Time: ${stats.min_time?.toFixed(2) || "N/A"}ms`);
    console.log(`Max Response Time: ${stats.max_time?.toFixed(2) || "N/A"}ms`);
    console.log(`Avg Response Time: ${stats.avg_time?.toFixed(2) || "N/A"}ms`);
    console.log("----------------------");

    // Show last 5 records
    const lastRecords = await db.all(`
            SELECT * FROM ping_results 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);

    console.log("\nLast 5 Records:");
    console.log("----------------------");
    lastRecords.forEach((record) => {
      const time = new Date(record.timestamp).toLocaleTimeString();
      const status = record.success ? "✓" : "✗";
      const responseTime = record.success
        ? `${record.response_time}ms`
        : "Failed";
      console.log(`[${time}] ${status} ${responseTime}`);
    });
    console.log("----------------------\n");
  } catch (error) {
    console.error("Error displaying database stats:", error);
  }
}

async function testBasic() {
  let monitor = null;
  let ws = null;
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
    monitor = new PingMonitor({
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
            ip: "8.8.8.8",
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

    // Display database statistics
    await displayDatabaseStats(monitor.getDatabase());
  } catch (error) {
    console.error("✕ Test failed:", error);
    process.exit(1);
  } finally {
    if (ws) {
      ws.close();
    }
    if (monitor) {
      await monitor.stop();
    }
  }
}

testBasic().catch(console.error);


```

The application will be available at `http://localhost:3000`


## Configuration

> Docs work in progress

### API Endpoints

The application provides the following REST API endpoints:

```bash
# Start monitoring a host
POST /api/ping/start
{
    "ip": "8.8.8.8",
    "timeout": 1000,
    "packetSize": 32,
    "duration": 60000
}

# Get historical data
GET /api/ping/history
```

Logs are stored in the `logs` directory:
- `error.log`: Error messages
- `combined.log`: All application logs

## Contributing

1. We are looking for contributors
## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- D3.js for visualization
- SQLite for data storage
- Express.js for the web server
- WebSocket for real-time communication

## Author

innocentwkc
- GitHub: [@innocentwkc](https://github.com/innocentwkc)
- Email: hello@innocentwkc.com

## Support

For support, email hello@innocentwkc.com or create an issue in the GitHub repository.