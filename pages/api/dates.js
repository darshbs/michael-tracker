const EVENT_CODE = 'ET00470110';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store'); // fix 304 caching

  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'Missing city' });

  // This endpoint returns all available dates without a dateCode
  const apiUrl = `https://in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14.3.4&language=en&eventCode=${EVENT_CODE}&regionCode=${city}&subRegion=${city}`;

  try {
    const r = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36',
        'x-region-code': city,
        'x-appcode': 'MOBAND2',
        Referer: 'https://in.bookmyshow.com/',
      },
      cache: 'no-store',
    });

    const text = await r.text();
    console.log('dates raw response:', text.slice(0, 300));

    const json = JSON.parse(text);

    const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const dates = [...new Set(
      (json?.ShowDetails || [])
        .map(s => s.Date)
        .filter(Boolean)
        .filter(d => d >= today)
    )].sort();

    console.log('available dates:', dates);
    return res.status(200).json({ dates });
  } catch (err) {
    console.error('dates error:', err.message);
    return res.status(500).json({ dates: [], error: err.message });
  }
}
