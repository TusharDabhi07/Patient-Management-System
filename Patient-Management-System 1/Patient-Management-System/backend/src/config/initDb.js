const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'schema.sql');
const ER_DUP_KEYNAME = 'ER_DUP_KEYNAME';
const ERRNO_DUP_KEYNAME = 1061;

const CONNECT_RETRIES = 10;
const CONNECT_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Strip "--" comment lines and split the schema into individual statements.
function parseStatements(sql) {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return withoutComments
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

async function connectWithRetry() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
    // No database selected: schema.sql creates and selects pms_db itself.
  };

  let lastError;
  for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
    try {
      return await mysql.createConnection(config);
    } catch (err) {
      lastError = err;
      console.warn(
        `Database connection attempt ${attempt}/${CONNECT_RETRIES} failed: ${err.message}`
      );
      if (attempt < CONNECT_RETRIES) await sleep(CONNECT_DELAY_MS);
    }
  }
  throw lastError;
}

async function initDb() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = parseStatements(sql);

  const connection = await connectWithRetry();
  try {
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (err) {
        const isIndex = /^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(statement);
        const isDupKey = err.code === ER_DUP_KEYNAME || err.errno === ERRNO_DUP_KEYNAME;
        if (isIndex && isDupKey) continue; // index already exists
        throw err;
      }
    }
    console.log('Database schema applied successfully.');
  } finally {
    await connection.end();
  }
}

initDb()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
