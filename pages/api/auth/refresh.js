// pages/api/auth/refresh.js — decrypts stored credentials and re-authenticates
import db from '../../../lib/db';
import { decrypt } from '../../../lib/crypto';
import { startLogin } from '../../../lib/scraper';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
    responseLimit: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { remember_token } = req.body || {};
  if (!remember_token) return res.status(400).json({ error: 'remember_token required' });
  try {
    const row = await db.getCredsForToken(remember_token);
    if (!row) return res.status(401).json({ error: 'invalid_token' });

    let creds;
    try {
      creds = JSON.parse(decrypt(row.encrypted_creds));
    } catch (e) {
      await db.deleteCredsForToken(remember_token);
      return res.status(401).json({ error: 'invalid_token' });
    }

    // Use scraper directly (we are the Railway backend)
    const result = await startLogin(creds.email, creds.password);

    if (!result || result.needsCaptcha) {
      await db.deleteCredsForToken(remember_token);
      return res.status(401).json({ error: 'credentials_expired' });
    }

    if (result.data) {
      db.setStudentCache(creds.email, result.data).catch(() => {});
    }

    // Set sessionId cookie (same as login.js) so subsequent requests are authenticated
    const sessionId = Buffer.from(creds.email).toString('base64');
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=31536000`);
    result.sessionToken = sessionId;

    return res.status(200).json(result);
  } catch (e) {
    console.error('[refresh]', e.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
