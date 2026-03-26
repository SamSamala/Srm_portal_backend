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

async function getAllSavedSessions() {
  const { rows } = await pool.query('SELECT remember_token, email, encrypted_creds FROM saved_sessions');
  return rows;
}

// ── Bug Reports ──────────────────────────────────────────────────────────────

async function initBugReports() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id          TEXT PRIMARY KEY,
      email       TEXT,
      subject     TEXT NOT NULL,
      description TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  BIGINT NOT NULL
    )
  `);
}

async function insertBugReport(id, email, subject, description) {
  await pool.query(
    `INSERT INTO bug_reports (id, email, subject, description, status, created_at)
     VALUES ($1,$2,$3,$4,'open',$5)`,
    [id, email || null, subject, description, Date.now()]
  );
}

async function getBugReports() {
  const { rows } = await pool.query(
    'SELECT * FROM bug_reports ORDER BY created_at DESC'
  );
  return rows;
}

async function updateBugReportStatus(id, status) {
  await pool.query('UPDATE bug_reports SET status=$1 WHERE id=$2', [status, id]);
}

async function deleteBugReport(id) {
  await pool.query('DELETE FROM bug_reports WHERE id=$1', [id]);
}

// ── Contact Messages ─────────────────────────────────────────────────────────

async function initContactMessages() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      subject    TEXT,
      message    TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);
}

async function insertContactMessage(id, name, email, subject, message) {
  await pool.query(
    `INSERT INTO contact_messages (id, name, email, subject, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, name, email, subject || null, message, Date.now()]
  );
}

async function getContactMessages() {
  const { rows } = await pool.query(
    'SELECT * FROM contact_messages ORDER BY created_at DESC'
  );
  return rows;
}

async function deleteContactMessage(id) {
  await pool.query('DELETE FROM contact_messages WHERE id=$1', [id]);
}

// ── Subscriptions ────────────────────────────────────────────────────────────

async function initSubscriptions() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      email                    TEXT PRIMARY KEY,
      plan                     TEXT NOT NULL DEFAULT 'free',
      status                   TEXT NOT NULL DEFAULT 'active',
      razorpay_subscription_id TEXT,
      razorpay_customer_id     TEXT,
      current_period_end       BIGINT,
      created_at               BIGINT NOT NULL,
      updated_at               BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub_id
      ON subscriptions(razorpay_subscription_id)
  `);
}

async function getSubscription(email) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM subscriptions WHERE email=$1',
      [email]
    );
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

async function upsertSubscription(email, fields) {
  const now = Date.now();
  const {
    plan = 'pro',
    status = 'active',
    razorpay_subscription_id = null,
    razorpay_customer_id = null,
    current_period_end = null,
  } = fields;
  await pool.query(
    `INSERT INTO subscriptions
       (email, plan, status, razorpay_subscription_id, razorpay_customer_id, current_period_end, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     ON CONFLICT (email) DO UPDATE SET
       plan                     = COALESCE($2, subscriptions.plan),
       status                   = $3,
       razorpay_subscription_id = COALESCE($4, subscriptions.razorpay_subscription_id),
       razorpay_customer_id     = COALESCE($5, subscriptions.razorpay_customer_id),
       current_period_end       = COALESCE($6, subscriptions.current_period_end),
       updated_at               = $7`,
    [email, plan, status, razorpay_subscription_id, razorpay_customer_id, current_period_end, now]
  );
}

async function cancelSubscription(email) {
  await pool.query(
    `UPDATE subscriptions SET status='canceled', updated_at=$1 WHERE email=$2`,
    [Date.now(), email]
  );
}

async function isProActive(email) {
  try {
    const row = await getSubscription(email);
    if (!row) return false;
    return row.plan === 'pro' && row.status === 'active' && Number(row.current_period_end) > Date.now();
  } catch (e) {
    return false;
  }
}

async function getAllSubscriptions() {
  const { rows } = await pool.query(
    'SELECT email, plan, status, current_period_end, created_at, updated_at FROM subscriptions ORDER BY updated_at DESC'
  );
  return rows;
}

async function adminGrantPro(email) {
  const now = Date.now();
  const current_period_end = now + 30 * 24 * 60 * 60 * 1000; // 30 days
  await pool.query(
    `INSERT INTO subscriptions (email, plan, status, current_period_end, created_at, updated_at)
     VALUES ($1,'pro','active',$2,$3,$3)
     ON CONFLICT (email) DO UPDATE SET
       plan='pro', status='active', current_period_end=$2, updated_at=$3`,
    [email, current_period_end, now]
  );
}

async function adminRevokePro(email) {
  await pool.query(
    `UPDATE subscriptions SET plan='free', status='active', updated_at=$1 WHERE email=$2`,
    [Date.now(), email]
  );
}

// Initialize tables on startup (non-blocking)
initStudentCache().catch(() => {});
initSubscriptions().catch(() => {});
initBugReports().catch(() => {});
initContactMessages().catch(() => {});

module.exports = pool;
module.exports.getStudentCache    = getStudentCache;
module.exports.setStudentCache    = setStudentCache;
module.exports.saveCreds          = saveCreds;
module.exports.getCredsForToken   = getCredsForToken;
module.exports.deleteCredsForToken = deleteCredsForToken;
module.exports.getAllSavedSessions = getAllSavedSessions;
module.exports.getSubscription      = getSubscription;
module.exports.upsertSubscription   = upsertSubscription;
module.exports.cancelSubscription   = cancelSubscription;
module.exports.isProActive          = isProActive;
module.exports.getAllSubscriptions  = getAllSubscriptions;
module.exports.adminGrantPro        = adminGrantPro;
module.exports.adminRevokePro       = adminRevokePro;
module.exports.insertBugReport      = insertBugReport;
module.exports.getBugReports        = getBugReports;
module.exports.updateBugReportStatus = updateBugReportStatus;
module.exports.deleteBugReport      = deleteBugReport;
module.exports.insertContactMessage = insertContactMessage;
module.exports.getContactMessages   = getContactMessages;
module.exports.deleteContactMessage = deleteContactMessage;
