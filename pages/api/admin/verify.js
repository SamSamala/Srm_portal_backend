// pages/api/admin/verify.js — checks admin key without touching DB
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json({ ok: true });
}
