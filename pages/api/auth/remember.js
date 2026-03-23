// pages/api/auth/remember.js — encrypts credentials server-side, returns opaque token
import db from '../../../lib/db';
import { encrypt } from '../../../lib/crypto';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const remember_token = randomUUID();
    const encrypted_creds = encrypt(JSON.stringify({ email, password }));
    await db.saveCreds(remember_token, email, encrypted_creds);
    return res.status(200).json({ remember_token });
  } catch (e) {
    console.error('[remember]', e.message);
    return res.status(500).json({ error: 'Failed to save credentials' });
  }
}
