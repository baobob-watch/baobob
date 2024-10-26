# @baobab/ping Testing Documentation

This document outlines test scenarios and examples for the @baobab/ping module. It includes standalone tests, integration tests, and a GUI example.

## Test Scenarios

### Scenario 1: Basic Ping Monitoring
Test basic ping functionality with default settings.

```javascript
// test-basic.js
const { PingMonitor } = require('@baobab/ping');
const path = require('path');

async function testBasic() {
    const monitor = new PingMonitor({
        config: {
            database: {
                path: path.join(__dirname, 'data'),
                filename: 'basic-test.db'
            },
            logging: {
                dir: path.join(__dirname, 'logs'),
                level: 'debug',
                filename: {
                    error: 'basic-error.log',
                    combined: 'basic.log'
                }
            },
            server: {
                port: 3000
            }
        }
    });

    try {
        await monitor.initialize();
        await monitor.start();
        console.log('✓ Monitor started');

        // Test ping request
        const response = await fetch('http://localhost:3000/api/ping/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: '8.8.8.8',
                duration: 10000 // 10 seconds test
            })
        });

        const result = await response.json();
        console.log('✓ Ping response:', result);

        // Wait for test completion
        await new Promise(resolve => setTimeout(resolve, 11000));
        await monitor.stop();
        console.log('✓ Test completed successfully');
    } catch (error) {
        console.error('✕ Test failed:', error);
        process.exit(1);
    }
}

testBasic();
```

### Scenario 2: High Load Testing
Test multiple concurrent ping sessions.

```javascript
// test-load.js
const { PingMonitor } = require('@baobab/ping');
const path = require('path');

async function testLoad() {
    const monitor = new PingMonitor({
        config: {
            database: {
                path: path.join(__dirname, 'data'),
                filename: 'load-test.db'
            },
            logging: {
                dir: path.join(__dirname, 'logs'),
                level: 'debug',
                filename: {
                    error: 'load-error.log',
                    combined: 'load.log'
                }
            },
            server: {
                port: 3001
            }
        }
    });

    const targets = [
        '8.8.8.8',
        '1.1.1.1',
        'google.com',
        'cloudflare.com'
    ];

    try {
        await monitor.initialize();
        await monitor.start();
        console.log('✓ Monitor started');

        // Start multiple ping sessions
        const requests = targets.map(ip => 
            fetch('http://localhost:3001/api/ping/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip,
                    duration: 30000 // 30 seconds test
                })
            })
        );

        await Promise.all(requests);
        console.log('✓ All ping sessions started');

        // Wait for test completion
        await new Promise(resolve => setTimeout(resolve, 31000));
        await monitor.stop();
        console.log('✓ Load test completed successfully');
    } catch (error) {
        console.error('✕ Load test failed:', error);
        process.exit(1);
    }
}

testLoad();
```

### Scenario 3: Error Handling
Test various error conditions and recovery.

```javascript
// test-errors.js
const { PingMonitor } = require('@baobab/ping');
const path = require('path');

async function testErrors() {
    const monitor = new PingMonitor({
        config: {
            database: {
                path: path.join(__dirname, 'data'),
                filename: 'error-test.db'
            },
            logging: {
                dir: path.join(__dirname, 'logs'),
                level: 'debug',
                filename: {
                    error: 'error-test.log',
                    combined: 'error-combined.log'
                }
            },
            server: {
                port: 3002
            }
        }
    });

    try {
        await monitor.initialize();
        await monitor.start();
        console.log('✓ Monitor started');

        // Test 1: Invalid IP
        const invalidIpResponse = await fetch('http://localhost:3002/api/ping/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: 'invalid-ip',
                duration: 5000
            })
        });
        console.log('✓ Invalid IP test:', invalidIpResponse.status === 400);

        // Test 2: Invalid parameters
        const invalidParamsResponse = await fetch('http://localhost:3002/api/ping/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: '8.8.8.8',
                timeout: -1
            })
        });
        console.log('✓ Invalid params test:', invalidParamsResponse.status === 400);

        // Test 3: Unreachable host
        const unreachableResponse = await fetch('http://localhost:3002/api/ping/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: '192.168.255.255',
                duration: 5000
            })
        });
        console.log('✓ Unreachable host test completed');

        await monitor.stop();
        console.log('✓ Error handling test completed successfully');
    } catch (error) {
        console.error('✕ Error handling test failed:', error);
        process.exit(1);
    }
}

testErrors();
```

### Scenario 4: Integration Testing
Test integration with an existing Express application.

```javascript
// test-integration.js
const express = require('express');
const { PingMonitor } = require('@baobab/ping');
const path = require('path');

async function testIntegration() {
    const app = express();
    
    // Existing routes
    app.get('/status', (req, res) => {
        res.json({ status: 'ok' });
    });

    const monitor = new PingMonitor({
        config: {
            database: {
                path: path.join(__dirname, 'data'),
                filename: 'integration-test.db'
            },
            logging: {
                dir: path.join(__dirname, 'logs'),
                level: 'debug',
                filename: {
                    error: 'integration-error.log',
                    combined: 'integration.log'
                }
            }
        },
        app
    });

    try {
        await monitor.initialize();
        
        const server = app.listen(3003, () => {
            console.log('✓ Server started on port 3003');
        });

        // Test existing route
        const statusResponse = await fetch('http://localhost:3003/status');
        console.log('✓ Status endpoint:', await statusResponse.json());

        // Test ping route
        const pingResponse = await fetch('http://localhost:3003/api/ping/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: '8.8.8.8',
                duration: 5000
            })
        });
        console.log('✓ Ping endpoint:', await pingResponse.json());

        // Wait for test completion
        await new Promise(resolve => setTimeout(resolve, 6000));
        server.close();
        console.log('✓ Integration test completed successfully');
    } catch (error) {
        console.error('✕ Integration test failed:', error);
        process.exit(1);
    }
}

testIntegration();
```

## GUI Example Application

Create a full-featured ping monitoring dashboard:


<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ping Monitor Dashboard</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .controls {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .form-group {
            margin-bottom: 10px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
        }
        input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: #0056b3;
        }
        .chart {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 20px;
        }
        .stat-card {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
        }
        .status {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ping Monitor Dashboard</h1>
            <div id="connection-status"></div>
        </div>

        <div class="controls">
            <div class="form-group">
                <label for="host">Host:</label>
                <input type="text" id="host" placeholder="e.g., 8.8.8.8 or google.com">
            </div>
            <div class="form-group">
                <label for="interval">Interval (ms):</label>
                <input type="number" id="interval" value="1000" min="100" max="5000">
            </div>
            <div class="form-group">
                <label for="packetSize">Packet Size:</label>
                <input type="number" id="packetSize" value="32" min="32" max="65507">
            </div>
            <div class="form-group">
                <button id="startBtn">Start Monitoring</button>
                <button id="stopBtn" disabled>Stop</button>
            </div>
        </div>

        <div id="status" class="status"></div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" id="currentPing">-</div>
                <div class="stat-label">Current (ms)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="avgPing">-</div>
                <div class="stat-label">Average (ms)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="minPing">-</div>
                <div class="stat-label">Min (ms)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="maxPing">-</div>
                <div class="stat-label">Max (ms)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="lossRate">0%</div>
                <div class="stat-label">Packet Loss</div>
            </div>
        </div>

        <div class="chart" id="chart"></div>
    </div>

    <script>
        // D3.js chart setup and WebSocket handling code here
        // ... (Previous D3.js code) ...
    </script>
</body>
</html>