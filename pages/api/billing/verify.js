// pages/api/billing/verify.js — DISABLED: Pro subscriptions are no longer available
export default function handler(req, res) {
  return res.status(410).json({ error: 'Subscriptions are no longer available.' });
}
