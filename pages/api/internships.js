// pages/api/internships.js — CRUD API for internships (pro-only GET, admin POST/PUT/DELETE)
const db = require('../../lib/db');
const { isProActive } = db;
const { randomUUID } = require('crypto');

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS internships (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      company     TEXT NOT NULL,
      description TEXT,
      departments TEXT[],
      semesters   TEXT[],
      stipend     TEXT,
      location    TEXT,
      skills      TEXT[],
      deadline    DATE,
      apply_link  TEXT,
      created_at  BIGINT NOT NULL,
      updated_at  BIGINT NOT NULL
    )
  `);
}

function checkAdmin(req, res) {
  const key = (req.headers['x-admin-key'] || '').trim();
  const expected = (process.env.ADMIN_KEY || '').trim();
  if (!expected || key !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  try {
    await initDb();
  } catch (e) {
    return res.status(500).json({ error: 'DB init failed: ' + e.message });
  }

  if (req.method === 'GET') {
    // Require a logged-in pro subscriber
    const token = req.cookies?.sessionId;
    if (!token) return res.status(401).json({ error: 'Login required' });
    let email;
    try {
      email = Buffer.from(token, 'base64').toString('utf8');
    } catch {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const pro = await isProActive(email);
    if (!pro) {
      // Return count only so the dashboard can show "X internships available (locked)"
      const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS cnt FROM internships');
      return res.status(403).json({ error: 'pro_required', count: countRows[0]?.cnt ?? 0 });
    }

    try {
      const { rows } = await db.query(
        'SELECT * FROM internships ORDER BY created_at DESC'
      );
      const mapped = rows.map(r => ({
        id: r.id,
        title: r.title,
        company: r.company,
        description: r.description,
        departments: r.departments || [],
        semesters: r.semesters || [],
        stipend: r.stipend,
        location: r.location,
        skills: r.skills || [],
        deadline: r.deadline ? r.deadline.toISOString().split('T')[0] : null,
        applyLink: r.apply_link,
        createdAt: Number(r.created_at),
        updatedAt: Number(r.updated_at),
      }));
      return res.status(200).json(mapped);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    if (!checkAdmin(req, res)) return;
    const { title, company, description, departments, semesters, stipend, location, skills, deadline, applyLink } = req.body;
    if (!title || !company) return res.status(400).json({ error: 'title and company required' });
    const now = Date.now();
    const id = randomUUID();
    try {
      await db.query(
        `INSERT INTO internships (id,title,company,description,departments,semesters,stipend,location,skills,deadline,apply_link,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, title, company, description||null, departments||[], semesters||[], stipend||null, location||null, skills||[], deadline||null, applyLink||null, now, now]
      );
      return res.status(201).json({ id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PUT') {
    if (!checkAdmin(req, res)) return;
    const { id, title, company, description, departments, semesters, stipend, location, skills, deadline, applyLink } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const now = Date.now();
    try {
      const { rowCount } = await db.query(
        `UPDATE internships SET title=$1,company=$2,description=$3,departments=$4,semesters=$5,
         stipend=$6,location=$7,skills=$8,deadline=$9,apply_link=$10,updated_at=$11 WHERE id=$12`,
        [title, company, description||null, departments||[], semesters||[], stipend||null, location||null, skills||[], deadline||null, applyLink||null, now, id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!checkAdmin(req, res)) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query param required' });
    try {
      await db.query('DELETE FROM internships WHERE id=$1', [id]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
