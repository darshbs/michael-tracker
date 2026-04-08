// pages/api/check.js
// Server-side proxy — avoids CORS, keeps checks reliable

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const BMS_URL =
    'https://in.bookmyshow.com/movies/hyderabad/michael/buytickets/ET00470110';

  try {
    const response = await fetch(BMS_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        Referer: 'https://in.bookmyshow.com/',
      },
      cache: 'no-store',
    });

    const html = await response.text();
    const lower = html.toLowerCase();

    // Parse what we find
    const hasPrasads =
      lower.includes('prasads') || lower.includes('prasad');
    const hasPCX =
      lower.includes('pcx') ||
      lower.includes('premiere circuit') ||
      lower.includes('prem circuit');
    const hasBookNow =
      lower.includes('book now') ||
      lower.includes('booknow') ||
      lower.includes('select seats') ||
      lower.includes('buy tickets');
    const isNotOpen =
      lower.includes('not available') ||
      lower.includes('coming soon') ||
      lower.includes('notify me') ||
      lower.includes('no shows') ||
      lower.includes('no showtimes');

    let status = 'not_listed';
    let message = 'Movie not yet listed for this date on BookMyShow.';

    if (isNotOpen && !hasBookNow) {
      status = 'listed_not_open';
      message = 'Movie is listed but bookings are not open yet.';
    } else if (hasPrasads && !hasPCX && hasBookNow) {
      status = 'prasads_no_pcx';
      message = 'Prasads Multiplex is bookable but PCX screen not available yet.';
    } else if (hasPrasads && hasPCX && hasBookNow) {
      status = 'tickets_live';
      message = 'TICKETS LIVE! Prasads PCX screen is available for booking!';
    } else if (hasPrasads && hasBookNow) {
      status = 'prasads_live';
      message = 'Prasads Multiplex tickets are live! (Verify PCX on site)';
    } else if (lower.includes('michael') && lower.includes('jackson')) {
      status = 'listed_not_open';
      message = 'Movie is listed on BookMyShow but no Hyderabad shows open yet.';
    }

    return res.status(200).json({
      status,
      message,
      checkedAt: new Date().toISOString(),
      bmsUrl: BMS_URL,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: `Check failed: ${err.message}`,
      checkedAt: new Date().toISOString(),
    });
  }
}
