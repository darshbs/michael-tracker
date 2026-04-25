import redis from '../../lib/redis';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Load all subscriptions from Redis
  const keys = await redis.smembers('subscriptions');
  const subs = (await Promise.all(keys.map(k => redis.get(k)))).filter(Boolean).map(s => typeof s === 'string' ? JSON.parse(s) : s);

  // Also support direct query params (for browser/GitHub Actions use)
  const { cities: citiesParam, date: dateParam, telegramId } = req.query;
  if (citiesParam && dateParam) {
    subs.push({ chatId: telegramId || process.env.TELEGRAM_CHAT_ID, cities: citiesParam.split(','), date: dateParam });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allResults = [];

  for (const sub of subs) {
    const { chatId, cities, date } = sub;
    const CITIES_LIST = require('../../lib/cities');
    const selectedCities = CITIES_LIST.filter(c => cities.includes(c.code));

    const results = await Promise.all(selectedCities.map(async (city) => {
      const bmsUrl = `https://in.bookmyshow.com/movies/${city.slug}/michael/buytickets/ET00470110/${date}`;
      const apiUrl = `https://in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14.3.4&language=en&eventCode=ET00470110&regionCode=${city.code}&subRegion=${city.code}&dateCode=${date}`;

      try {
        const r = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36', 'x-region-code': city.code, Referer: 'https://in.bookmyshow.com/' },
          cache: 'no-store',
        });
        const text = await r.text();
        let html = '';
        if (!r.ok || !text.includes('venueCode')) {
          const r2 = await fetch(bmsUrl, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html', Referer: 'https://in.bookmyshow.com/' }, cache: 'no-store' });
          html = await r2.text();
        }

        const body = (text + html).toLowerCase();
        let hasActualShowtimes = false;
        let theatres = [];
        try {
          const json = JSON.parse(text);
          const venues = json?.ShowDetails?.[0]?.Venues || json?.ShowDetails?.[0]?.arrVenues || [];
          theatres = venues.map(v => v.VenueName || v.venueName || v.CinemaName).filter(Boolean);
          hasActualShowtimes = venues.length > 0;
        } catch (_) {}

        const notOpen = body.includes('notavailable') || body.includes('no shows') || body.includes('coming soon') || body.includes('notify me');
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        if (date < today) return { city: city.label, code: city.code, status: 'not_listed', message: 'Date has passed.', theatres: [], bmsUrl };

        let status, message;
        if (hasActualShowtimes && !notOpen) {
          status = 'tickets_live';
          message = theatres.length > 0 ? `Live at ${theatres.length} theatre${theatres.length > 1 ? 's' : ''}` : 'Showtimes live — book now!';

          if (token && chatId) {
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: `🎬 <b>Michael tickets LIVE in ${city.label}!</b>\n\nBook now 👇\n${bmsUrl}`, parse_mode: 'HTML' }),
              });
              // Remove subscription after notifying
              await redis.del(`sub:${chatId}:${date}`);
              await redis.srem('subscriptions', `sub:${chatId}:${date}`);
            } catch (err) { console.error('Telegram error:', err); }
          }
        } else if (body.includes('michael')) {
          status = 'listed_not_open'; message = 'Listed but not open yet.';
        } else {
          status = 'not_listed'; message = 'Not listed yet.';
        }
        return { city: city.label, code: city.code, status, message, theatres, bmsUrl };
      } catch (err) {
        return { city: city.label, code: city.code, status: 'error', message: err.message, theatres: [], bmsUrl };
      }
    }));
    allResults.push(...results);
  }

  const uniqueResults = allResults.filter((r, i, arr) => arr.findIndex(x => x.code === r.code) === i);
  return res.status(200).json({ results: uniqueResults, anyLive: uniqueResults.some(r => r.status === 'tickets_live'), checkedAt: new Date().toISOString() });
}
