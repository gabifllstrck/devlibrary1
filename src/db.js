// Conexão com o MySQL (pool = conjunto de conexões reaproveitadas)
require('dotenv').config();
const mysql = require('mysql2/promise');

const ssl = process.env.DB_SSL === 'true'
  ? {
      rejectUnauthorized: true,
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
    }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'devlibrary',
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // datas chegam como texto "2026-10-21" (evita problemas de fuso horário)
});

module.exports = pool;
