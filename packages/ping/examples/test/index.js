// test.js
const { PingMonitor } = require('@baobab/ping');
const path = require('path');

async function main() {
    const monitor = new PingMonitor({
        config: {
            database: {
                path: path.join(__dirname, 'data'),
                filename: 'ping.db'
            },
            logging: {
                dir: path.join(__dirname, 'logs'),
                level: 'debug',
                filename: {
                    error: 'error.log',
                    combined: 'combined.log'
                }
            },
            server: {
                port: 3000,
                staticDir: path.join(__dirname, 'public')
            }
        }
    });

    try {
        await monitor.initialize();
        await monitor.start();
        console.log('Monitor started successfully');

        // Keep process running
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            await monitor.stop();
            process.exit(0);
        });
    } catch (error) {
        console.error('Failed to start monitor:', error);
        process.exit(1);
    }
}

main();