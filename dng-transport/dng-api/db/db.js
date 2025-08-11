// db/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize session settings on each new connection
pool.on('connection', async (conn) => {
  try {
    await conn.query("SET time_zone = '+00:00'");
    await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci");
  } catch (e) {
    console.error('DB session init error:', e.message);
  }
});

module.exports = pool;
