const { startLogin } = require('../../lib/scraper');

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

  const { email, password, sessionToken } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const expectedToken = Buffer.from(email).toString('base64');

  // AUTO LOGIN (session restore)
  if (sessionToken && sessionToken === expectedToken) {
    try {
      const result = await Promise.race([
        startLogin(email, null, true),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 250000)
        )
      ]);
      return res.status(200).json(result);
    } catch (e) {
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
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}