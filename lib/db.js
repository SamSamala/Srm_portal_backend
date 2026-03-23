// lib/db.js — PostgreSQL pool singleton with student cache and saved sessions support
const { Pool } = require('pg');

let pool;

if (!pool) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  });
}

const STUDENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function initStudentCache() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_cache (
      email      TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_sessions (
      remember_token  TEXT PRIMARY KEY,
      email           TEXT NOT NULL,
      encrypted_creds TEXT NOT NULL,
      created_at      BIGINT NOT NULL
    )
  `);
}

async function getStudentCache(email) {
  try {
    const r = await pool.query(
      'SELECT data, updated_at FROM student_cache WHERE email=$1',
      [email]
    );
    if (!r.rows.length) return null;
    const { data, updated_at } = r.rows[0];
    if (Date.now() - Number(updated_at) > STUDENT_CACHE_TTL) return null;
    return JSON.parse(data);
  } catch(e) {
    return null;
  }
}

async function setStudentCache(email, data) {
  try {
    await pool.query(
      `INSERT INTO student_cache (email, data, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET data=$2, updated_at=$3`,
      [email, JSON.stringify(data), Date.now()]
    );
  } catch(e) {}
}

async function saveCreds(remember_token, email, encrypted_creds) {
  await pool.query(
    `INSERT INTO saved_sessions (remember_token, email, encrypted_creds, created_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (remember_token) DO UPDATE SET encrypted_creds=$3`,
    [remember_token, email, encrypted_creds, Date.now()]
  );
}

async function getCredsForToken(remember_token) {
  const { rows } = await pool.query(
    'SELECT email, encrypted_creds FROM saved_sessions WHERE remember_token=$1',
    [remember_token]
  );
  return rows[0] || null;
}

async function deleteCredsForToken(remember_token) {
  await pool.query('DELETE FROM saved_sessions WHERE remember_token=$1', [remember_token]);
}

// Initialize tables on startup (non-blocking)
initStudentCache().catch(() => {});

module.exports = pool;
module.exports.getStudentCache    = getStudentCache;
module.exports.setStudentCache    = setStudentCache;
module.exports.saveCreds          = saveCreds;
module.exports.getCredsForToken   = getCredsForToken;
module.exports.deleteCredsForToken = deleteCredsForToken;
