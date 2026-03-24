// Login API — authenticates user against SRM portal and stores session in Redis
// When BACKEND_URL is set (Vercel), proxies to Railway backend instead of running Playwright locally

export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
    responseLimit: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Proxy mode: forward to Railway backend when running on Vercel
  if (process.env.BACKEND_URL) {
    try {
      const r = await fetch(process.env.BACKEND_URL + '/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const cookie = r.headers.get('set-cookie');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: 'Backend unreachable. Please try again.' });
    }
  }

  const { startLogin, trackUser } = require('../../lib/scraper');
  const db = require('../../lib/db');
  const { decrypt } = require('../../lib/crypto');

  const { email, password, sessionToken, forceRefresh, remember_token } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const expectedToken = Buffer.from(email).toString('base64');

  // AUTO LOGIN (session restore)
  if (sessionToken && sessionToken === expectedToken) {
    try {
      const result = await Promise.race([
        startLogin(email, null, true, !!forceRefresh),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 250000)
        )
      ]);
      if (result.data) await trackUser(email);
      return res.status(200).json(result);
    } catch (e) {
      // Scrape failure (portal slow/down) — keep user logged in, return cached data
      if (e.isScrapeFailure) {
        return res.status(503).json({ error: 'refresh_failed', message: e.message });
      }

      // Session truly expired — attempt silent re-login with saved credentials
      if (remember_token) {
        try {
          const row = await db.getCredsForToken(remember_token);
          if (row) {
            const creds = JSON.parse(decrypt(row.encrypted_creds));
            const result = await Promise.race([
              startLogin(creds.email, creds.password, false),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 250000)
              )
            ]);
            if (!result.needsCaptcha && result.data) {
              const newSessionId = Buffer.from(creds.email).toString('base64');
              res.setHeader(
                'Set-Cookie',
                `sessionId=${newSessionId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=86400`
              );
              result.sessionToken = newSessionId;
              result.auto_relogged = true;
              await trackUser(creds.email);
              return res.status(200).json(result);
            }
          }
        } catch (reloginErr) {
          console.warn('[auto-relogin] failed:', reloginErr.message);
        }
      }

      // No saved creds or re-login failed — now it's safe to log out
      res.setHeader('Set-Cookie', 'sessionId=; Max-Age=0; Path=/');
      return res.status(401).json({ error: 'session_expired' });
    }
  }

  // FULL LOGIN
  try {
    const result = await Promise.race([
      startLogin(email, password, false),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out. SRM portal is slow — please try again.')), 250000)
      )
    ]);

    if (!result.needsCaptcha) {
      const sessionId = Buffer.from(email).toString('base64');
      res.setHeader(
        'Set-Cookie',
        `sessionId=${sessionId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=86400`
      );
      result.sessionToken = sessionId;
      if (result.data) await trackUser(email);
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}