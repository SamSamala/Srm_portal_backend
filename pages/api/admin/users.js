// Admin API — returns list of unique user emails tracked in Redis
const redis = require('../../../lib/redis');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const secret = (req.headers['x-admin-key'] || '').trim();
  const expected = (process.env.ADMIN_KEY || '').trim();
  if (!secret || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const emails = await redis.smembers('srm:users');
  return res.status(200).json({
    count: emails.length,
    emails: emails.sort(),
  });
}
