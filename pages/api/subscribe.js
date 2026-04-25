import redis from '../../lib/redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { chatId, cities, date } = req.body;
  if (!chatId || !cities || !date)
    return res.status(400).json({ error: 'Missing fields' });

  const key = `sub:${chatId}:${date}`;
  await redis.set(key, JSON.stringify({ chatId, cities, date }), { ex: 60 * 60 * 24 * 30 }); // 30 day expiry

  // Add to index so check.js can find all subs
  await redis.sadd('subscriptions', key);

  return res.status(200).json({ ok: true });
}
