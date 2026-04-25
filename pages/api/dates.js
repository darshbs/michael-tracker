const EVENT_CODE = 'ET00470110';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'Missing city' });

  // Generate next 14 dates from today
  const datesToCheck = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    datesToCheck.push(d.toISOString().slice(0,10).replace(/-/g,''));
  }

  // Check each date in parallel
  const results = await Promise.all(
    datesToCheck.map(async (dateCode) => {
      const apiUrl = `https://in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14.3.4&language=en&eventCode=${EVENT_CODE}&regionCode=${city}&subRegion=${city}&dateCode=${dateCode}`;
      try {
        const r = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36',
            'x-region-code': city,
            Referer: 'https://in.bookmyshow.com/',
          },
          cache: 'no-store',
        });
        const json = await r.json();
        const hasShows = (json?.ShowDetails || []).some(s => s.Date === dateCode);
        return hasShows ? dateCode : null;
      } catch (_) {
        return null;
      }
    })
  );

  const dates = results.filter(Boolean);
  console.log('available dates:', dates);
  return res.status(200).json({ dates });
}
