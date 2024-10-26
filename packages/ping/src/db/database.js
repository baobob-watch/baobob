const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const fs = require("fs").promises;

/**
 * Initialize database connection and schema
 * @param {Object} config - Database configuration
 * @param {string} config.path - Database directory path
 * @param {string} config.filename - Database filename
 * @returns {Promise<Object>} Database connection
 */
async function initializeDatabase(config) {
  try {
    // Ensure database directory exists
    await fs.mkdir(config.path, { recursive: true });

    const dbPath = path.join(config.path, config.filename);

    // Enable verbose mode in development
    if (process.env.NODE_ENV !== "production") {
      sqlite3.verbose();
    }

    // Open database connection
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Enable foreign keys
    await db.run("PRAGMA foreign_keys = ON");

    // Create tables
    await db.exec(`
            CREATE TABLE IF NOT EXISTS ping_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip TEXT NOT NULL,
                response_time REAL,
                packet_size INTEGER,
                timeout INTEGER,
                success INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_ping_timestamp 
            ON ping_results(timestamp);

            CREATE INDEX IF NOT EXISTS idx_ping_ip 
            ON ping_results(ip);
        `);

    // Verify database connection and structure
    const tableCheck = await db.get(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='ping_results'
        `);

    if (!tableCheck) {
      throw new Error("Database initialization failed: tables not created");
    }

    return db;
  } catch (error) {
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

/**
 * Save ping result to database
 * @param {Object} db - Database connection
 * @param {Object} result - Ping result
 * @returns {Promise<void>}
 */
async function savePingResult(db, result) {
  const { ip, responseTime, packetSize, timeout, success } = result;

  await db.run(
    `
        INSERT INTO ping_results (
            ip, response_time, packet_size, timeout, success
        ) VALUES (?, ?, ?, ?, ?)
    `,
    [ip, responseTime, packetSize, timeout, success ? 1 : 0]
  );
}

/**
 * Get ping history
 * @param {Object} db - Database connection
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of results
 * @param {string} [options.ip] - Filter by IP address
 * @returns {Promise<Array>} Ping results
 */
async function getPingHistory(db, options = { limit: 1000 }) {
  let query = `
        SELECT 
            id,
            timestamp,
            ip,
            response_time as responseTime,
            packet_size as packetSize,
            timeout,
            success
        FROM ping_results
    `;

  const params = [];
  if (options.ip) {
    query += " WHERE ip = ?";
    params.push(options.ip);
  }

  query += ` 
        ORDER BY timestamp DESC 
        LIMIT ?
    `;
  params.push(options.limit);

  return await db.all(query, params);
}

module.exports = {
  initializeDatabase,
  savePingResult,
  getPingHistory,
};
