const EVENT_CODE = 'ET00470110';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'Missing city' });

  const apiUrl = `https://in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14.3.4&language=en&eventCode=${EVENT_CODE}&regionCode=${city}&subRegion=${city}`;

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
    const dates = (json?.ShowDetails || [])
      .map(s => s.Date)
      .filter(Boolean);

    return res.status(200).json({ dates });
  } catch (err) {
    return res.status(500).json({ dates: [], error: err.message });
  }
}
