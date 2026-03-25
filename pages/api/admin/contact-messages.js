// pages/api/admin/contact-messages.js — Admin: view and delete contact form submissions
const { getContactMessages, deleteContactMessage } = require('../../../lib/db');

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

  // GET — list all contact messages
  if (req.method === 'GET') {
    try {
      const rows = await getContactMessages();
      return res.status(200).json(
        rows.map(r => ({
          id:        r.id,
          name:      r.name,
          email:     r.email,
          subject:   r.subject,
          message:   r.message,
          createdAt: Number(r.created_at),
        }))
      );
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE — remove a message
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query param required' });
    try {
      await deleteContactMessage(id);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
