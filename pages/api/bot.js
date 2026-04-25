export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const { message } = req.body;
  if (!message) return res.status(200).json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text || '';
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (text.startsWith('/start')) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `👋 Welcome to <b>Moonwalk Alert</b>!\n\nYour Telegram Chat ID is:\n\n<code>${chatId}</code>\n\nCopy this and paste it on the tracker site to get notified when Michael movie tickets go live in your city! 🎬\n\n<a href="https://michael-tracker.vercel.app">michael-tracker.vercel.app</a>`,
      }),
    });
  }

  return res.status(200).json({ ok: true });
}
