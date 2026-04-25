const CITIES = require('../../lib/cities');

const EVENT_CODE = 'ET00470110';
const MOVIE_SLUG = 'michael';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { cities: citiesParam, date, telegramId } = req.query;
  if (!citiesParam || !date)
    return res.status(400).json({ error: 'Missing cities or date param' });

  const selectedCodes = citiesParam.split(',');
  const selectedCities = CITIES.filter(c => selectedCodes.includes(c.code));

  const results = await Promise.all(
    selectedCities.map(async (city) => {
      const bmsUrl = `https://in.bookmyshow.com/movies/${city.slug}/${MOVIE_SLUG}/buytickets/${EVENT_CODE}/${date}`;

      // Don't notify for past dates
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      if (date < today) {
        return { city: city.label, code: city.code, status: 'not_listed', message: 'Date has passed.', theatres: [], bmsUrl };
      }
      const apiUrl = `https://in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14.3.4&language=en&eventCode=${EVENT_CODE}&regionCode=${city.code}&subRegion=${city.code}&dateCode=${date}`;

      try {
        const r = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36',
            'x-region-code': city.code,
            Referer: 'https://in.bookmyshow.com/',
          },
          cache: 'no-store',
        });

        const text = await r.text();

        let html = '';
        if (!r.ok || !text.includes('venueCode')) {
          const r2 = await fetch(bmsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'text/html',
              Referer: 'https://in.bookmyshow.com/',
            },
            cache: 'no-store',
          });
          html = await r2.text();
        }

        console.log('API response:', text.slice(0, 500));
        console.log('HTML response:', html.slice(0, 500));
        const body = (text + html).toLowerCase();
        let theatres = [];
        let hasActualShowtimes = false;

        try {
          const json = JSON.parse(text);
          console.log('ShowDetails count:', (json?.ShowDetails || []).length);
          console.log('Raw dates:', (json?.ShowDetails || []).map(s => s.Date));
          const showDetails = json?.ShowDetails;

          if (Array.isArray(showDetails) && showDetails.length > 0) {
            const venues = showDetails[0]?.Venues || showDetails[0]?.arrVenues || [];
            theatres = venues
              .map(v => v.VenueName || v.venueName || v.CinemaName)
              .filter(Boolean);
            // Only mark as live if actual venues with sessions exist
            hasActualShowtimes = theatres.length > 0 || venues.length > 0;
          }
        } catch (_) { }

        const notOpen = body.includes('notavailable') || body.includes('no shows') || body.includes('coming soon') || body.includes('notify me');

        let status, message;
        if (hasActualShowtimes && !notOpen) {
          status = 'tickets_live';
          message = theatres.length > 0 ? `Live at ${theatres.length} theatre${theatres.length > 1 ? 's' : ''}` : 'Showtimes live — book now!';

          const token = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = telegramId || process.env.TELEGRAM_CHAT_ID; // user's ID or fallback to yours
          const notifMsg = `🎬 <b>Michael tickets LIVE in ${city.label}!</b>\n\nBook now 👇\n${bmsUrl}`;

          if (token && chatId) {
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: notifMsg, parse_mode: 'HTML' }),
              });
            } catch (err) {
              console.error('Telegram error:', err);
            }
          }
        } else if (body.includes('michael')) {
          status = 'listed_not_open';
          message = 'Listed but not open yet.';
        } else {
          status = 'not_listed';
          message = 'Not listed yet.';
        }

        return { city: city.label, code: city.code, status, message, theatres, bmsUrl };
      } catch (err) {
        return { city: city.label, code: city.code, status: 'error', message: err.message, theatres: [], bmsUrl };
      }
    })
  );

  return res.status(200).json({
    results,
    anyLive: results.some(r => r.status === 'tickets_live'),
    checkedAt: new Date().toISOString(),
  });
}

