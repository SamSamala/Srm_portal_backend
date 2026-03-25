// pages/api/admin/subscribers.js — List and manage Pro subscribers (admin only)
const { getAllSubscriptions, adminGrantPro, adminRevokePro } = require('../../../lib/db');

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
  if (!checkAdmin(req, res)) return;

  // GET — list all subscriptions
  if (req.method === 'GET') {
    try {
      const rows = await getAllSubscriptions();
      const now = Date.now();
      const subscribers = rows.map(r => ({
        email:           r.email,
        plan:            r.plan,
        status:          r.status,
        isPro:           r.plan === 'pro' && r.status === 'active' && Number(r.current_period_end) > now,
        currentPeriodEnd: r.current_period_end ? Number(r.current_period_end) : null,
        createdAt:       Number(r.created_at),
        updatedAt:       Number(r.updated_at),
      }));
      return res.status(200).json({ subscribers });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — grant or revoke pro access
  // body: { email, action: 'grant' | 'revoke' }
  if (req.method === 'POST') {
    const { email, action } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    if (!['grant', 'revoke'].includes(action)) return res.status(400).json({ error: 'action must be grant or revoke' });
    try {
      if (action === 'grant') {
        await adminGrantPro(email);
      } else {
        await adminRevokePro(email);
      }
      return res.status(200).json({ ok: true, email, action });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
