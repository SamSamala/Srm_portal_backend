// pages/api/cron/nightly-refresh.js
// Called nightly at 1 AM to re-login all users with saved credentials and refresh their cache.
// Trigger via browser or cron: GET /api/cron/nightly-refresh?secret=<CRON_SECRET>

export default async function handler(req, res) {
  // Accept secret from query param OR header
  const secret = (req.query.secret || req.headers['x-cron-secret'] || '').trim();
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized — set CRON_SECRET env var and pass ?secret=<value>' });
  }

  const db = require('../../../lib/db');
  const { decrypt } = require('../../../lib/crypto');
  const { startLogin, trackUser } = require('../../../lib/scraper');

  let total = 0, refreshed = 0, failed = 0;

  try {
    const sessions = await db.getAllSavedSessions();
    total = sessions.length;

    for (const row of sessions) {
      try {
        const creds = JSON.parse(decrypt(row.encrypted_creds));
        const result = await Promise.race([
          startLogin(creds.email, creds.password, false),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120000)),
        ]);
        if (result && result.data && !result.needsCaptcha) {
          await trackUser(creds.email);
          refreshed++;
        } else {
          failed++;
        }
      } catch (e) {
        console.warn(`[nightly-refresh] failed for ${row.email}:`, e.message);
        failed++;
      }
      // Small delay between logins to avoid hammering SRM portal
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, total, refreshed, failed });
  }

  console.log(`[nightly-refresh] done: ${refreshed}/${total} refreshed, ${failed} failed`);
  return res.status(200).json({ ok: true, total, refreshed, failed });
}
