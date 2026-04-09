const CITIES = require('../../lib/cities');

const EVENT_CODE = 'ET00470110';
const MOVIE_SLUG = 'michael';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { cities: citiesParam, date } = req.query;
  if (!citiesParam || !date)
    return res.status(400).json({ error: 'Missing cities or date param' });

  const selectedCodes = citiesParam.split(',');
  const selectedCities = CITIES.filter(c => selectedCodes.includes(c.code));

  const results = await Promise.all(
    selectedCities.map(async (city) => {
      const bmsUrl = `https://in.bookmyshow.com/movies/${city.slug}/${MOVIE_SLUG}/buytickets/${EVENT_CODE}/${date}`;
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

        const body = (text + html).toLowerCase();
        const hasVenues = body.includes('venuename') || body.includes('cinemaname');
        const hasShowtimes = body.includes('showtime') || body.includes('sessionid');
        const notOpen = body.includes('notavailable') || body.includes('no shows') || body.includes('coming soon') || body.includes('notify me');

        let theatres = [];
        try {
          const json = JSON.parse(text);
          const venues = json?.ShowDetails || json?.BookMyShow?.arrEvent?.[0]?.arrVenues || [];
          theatres = venues.map(v => v.VenueName || v.venueName || v.CinemaName).filter(Boolean);
        } catch (_) {}

        let status, message;
        if (hasShowtimes && hasVenues && !notOpen) {
          status = 'tickets_live';
          message = theatres.length > 0 ? `Live at ${theatres.length} theatre${theatres.length > 1 ? 's' : ''}` : 'Showtimes live — book now!';

          const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
          await fetch(`${appUrl}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `🎬 <b>Michael tickets LIVE in ${city.label}!</b>\n\nBook now 👇\n${bmsUrl}`,
            }),
          });
        } else if (hasVenues || body.includes('michael')) {
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
