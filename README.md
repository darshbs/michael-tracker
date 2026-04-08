# Michael (2026) — BookMyShow Ticket Tracker

A Next.js web app that monitors BookMyShow and alerts you the moment tickets go live for **Michael (2026)** at **Prasads Multiplex PCX Screen, Hyderabad** on **April 24, 2026**.

## Features

- Server-side BookMyShow polling (no CORS issues)
- Browser push notifications when tickets go live
- Sound alert on detection
- Configurable check interval (30s to 5 min)
- Activity log
- Direct booking link on detection

## Deploy to Vercel (5 minutes)

### Option A — GitHub + Vercel (recommended)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** — done!

### Option B — Vercel CLI

```bash
npm i -g vercel
cd michael-tracker
vercel
```

Follow the prompts. Your app will be live at a `*.vercel.app` URL.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How the checker works

The `/api/check` route runs **server-side** in a Vercel serverless function:

1. Fetches the BookMyShow listing URL for Michael in Hyderabad on April 24
2. Parses HTML for mentions of Prasads Multiplex, PCX screen, and booking availability
3. Returns a status JSON: `not_listed | listed_not_open | prasads_no_pcx | prasads_live | tickets_live | error`

The frontend polls this endpoint at your chosen interval and reacts accordingly.

## Expanding later

To add more movies/cities, extend the `/api/check` route to accept query params (`?movie=...&city=...&date=...`) and build a config UI on the frontend.
