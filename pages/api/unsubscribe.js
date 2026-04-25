import redis from '../../lib/redis';

export default async function handler(req, res) {
  const { chatId, date } = req.query;
  const key = `sub:${chatId}:${date}`;
  await redis.del(key);
  await redis.srem('subscriptions', key);
  return res.status(200).json({ ok: true });
}
