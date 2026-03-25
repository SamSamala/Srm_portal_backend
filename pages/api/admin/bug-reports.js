// pages/api/admin/bug-reports.js — Admin: view, update, delete bug reports
const { getBugReports, updateBugReportStatus, deleteBugReport } = require('../../../lib/db');

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

  // GET — list all bug reports (optionally filter by status)
  if (req.method === 'GET') {
    try {
      const rows = await getBugReports();
      const { status } = req.query;
      const filtered = status ? rows.filter(r => r.status === status) : rows;
      return res.status(200).json(
        filtered.map(r => ({
          id:          r.id,
          email:       r.email,
          subject:     r.subject,
          description: r.description,
          status:      r.status,
          createdAt:   Number(r.created_at),
        }))
      );
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH — update status (open | resolved | wont_fix)
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id and status required' });
    const allowed = ['open', 'resolved', 'wont_fix'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    try {
      await updateBugReportStatus(id, status);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE — remove a report
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query param required' });
    try {
      await deleteBugReport(id);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
