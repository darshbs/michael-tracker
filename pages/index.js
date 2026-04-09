import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import CITIES from '../lib/cities';

const STATUS_CFG = {
  idle:            { color: '#7A7060', pulse: false },
  checking:        { color: '#4A90D9', pulse: true  },
  not_listed:      { color: '#4A4438', pulse: false },
  listed_not_open: { color: '#EF9F27', pulse: false },
  tickets_live:    { color: '#C9A84C', pulse: true  },
  error:           { color: '#E24B4A', pulse: false },
};

function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.13);
      g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.13 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.13);
      o.stop(ctx.currentTime + i * 0.13 + 0.4);
    });
  } catch (_) {}
}

const BMS_BOOK_URL = (slug, date) =>
  `https://in.bookmyshow.com/movies/${slug}/michael/buytickets/ET00470110/${date}`;

export default function Home() {
  const today = new Date();
  const defaultDate = '20260424';
  const formatInput = d => `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  const parseDate = v => v.replace(/-/g, '');

  const [selectedCities, setSelectedCities] = useState(['HYD']);
  const [date, setDate] = useState(defaultDate);
  const [interval_, setInterval_] = useState(60);
  const [running, setRunning] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [results, setResults] = useState([]);
  const [globalStatus, setGlobalStatus] = useState('idle');
  const [checkedAt, setCheckedAt] = useState(null);
  const [log, setLog] = useState([]);
  const [notifPerm, setNotifPerm] = useState('default');
  const intervalRef = useRef(null);
  const cdRef = useRef(null);
  const foundRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  const addLog = useCallback((msg, type = 'info') => {
    const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(p => [{ t, msg, type, id: Date.now() + Math.random() }, ...p].slice(0, 60));
  }, []);

  const doCheck = useCallback(async () => {
    if (foundRef.current) return;
    setGlobalStatus('checking');
    setCheckCount(c => c + 1);
    addLog(`Checking ${selectedCities.length} cit${selectedCities.length > 1 ? 'ies' : 'y'}…`);

    try {
      const r = await fetch(`/api/check?cities=${selectedCities.join(',')}&date=${date}`, { cache: 'no-store' });
      const data = await r.json();
      setResults(data.results || []);
      setCheckedAt(data.checkedAt);

      if (data.anyLive) {
        setGlobalStatus('tickets_live');
        foundRef.current = true;
        playAlert();
        addLog('TICKETS LIVE in one or more cities!', 'success');
        if (notifPerm === 'granted') {
          new Notification('🎬 Michael tickets are LIVE!', { body: 'Book now on BookMyShow!' });
        }
        clearInterval(intervalRef.current);
        clearInterval(cdRef.current);
        setRunning(false);
      } else {
        setGlobalStatus('idle');
        const liveCount = (data.results || []).filter(r => r.status === 'listed_not_open').length;
        addLog(liveCount > 0 ? `${liveCount} cit${liveCount > 1 ? 'ies' : 'y'} listed but not open` : 'No cities live yet');
      }
    } catch (err) {
      setGlobalStatus('error');
      addLog(`Error: ${err.message}`, 'error');
    }
  }, [selectedCities, date, notifPerm, addLog]);

  const start = useCallback(() => {
    if (running || selectedCities.length === 0) return;
    foundRef.current = false;
    setRunning(true);
    addLog(`Started — checking every ${interval_}s`);
    doCheck();
    intervalRef.current = setInterval(doCheck, interval_ * 1000);
    let cd = interval_;
    setCountdown(cd);
    cdRef.current = setInterval(() => { cd -= 1; setCountdown(cd); if (cd <= 0) cd = interval_; }, 1000);
  }, [running, selectedCities, interval_, doCheck, addLog]);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current); clearInterval(cdRef.current);
    setRunning(false); setCountdown(null); setGlobalStatus('idle');
    addLog('Stopped.');
  }, [addLog]);

  useEffect(() => () => { clearInterval(intervalRef.current); clearInterval(cdRef.current); }, []);

  const toggleCity = code => setSelectedCities(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  const cfg = STATUS_CFG[globalStatus] || STATUS_CFG.idle;

  return (
    <>
      <Head>
        <title>Michael · Ticket Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" />
      </Head>

      <div style={s.page}>
        <div style={s.glow} />
        <div style={s.wrap}>

          {/* HERO */}
          <header style={s.hero}>
            <div style={s.badge}>BOOKMYSHOW TICKET TRACKER</div>
            <h1 style={s.title}>MICHAEL</h1>
            <p style={s.sub}>The Official Biopic · King of Pop</p>
          </header>

          {/* CONFIG */}
          <div style={s.card}>
            <div style={s.cardLabel}>Select cities</div>
            <div style={s.cityGrid}>
              {CITIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => toggleCity(c.code)}
                  style={{ ...s.cityBtn, ...(selectedCities.includes(c.code) ? s.cityBtnOn : {}) }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ ...s.card, flex: 1, marginBottom: 0 }}>
              <div style={s.cardLabel}>Date</div>
              <input
                type="date"
                value={formatInput(date)}
                min="2026-04-24"
                onChange={e => setDate(parseDate(e.target.value))}
                style={s.dateInput}
              />
            </div>
            <div style={{ ...s.card, flex: 1, marginBottom: 0 }}>
              <div style={s.cardLabel}>Check every</div>
              <select value={interval_} onChange={e => setInterval_(+e.target.value)} disabled={running} style={s.select}>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>
          </div>

          {/* STATUS */}
          <div style={{ ...s.statusCard, borderColor: cfg.color + '55' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...s.dot, background: cfg.color, boxShadow: cfg.pulse ? `0 0 10px ${cfg.color}` : 'none', animation: cfg.pulse ? 'pulse 1.2s infinite' : 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: cfg.color, letterSpacing: '0.04em' }}>
                  {globalStatus === 'checking' ? 'Checking…' : globalStatus === 'tickets_live' ? '🎬 TICKETS LIVE!' : globalStatus === 'idle' && running ? 'Monitoring…' : globalStatus === 'error' ? 'Error' : 'Ready'}
                </span>
              </div>
              {checkedAt && <span style={s.dimText}>Last checked {new Date(checkedAt).toLocaleTimeString('en-IN')}</span>}
            </div>

            {running && countdown !== null && (
              <div style={{ marginTop: 12, position: 'relative' }}>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                  <div style={{ height: '100%', width: `${(countdown / interval_) * 100}%`, background: '#7A6228', borderRadius: 1, transition: 'width 1s linear' }} />
                </div>
                <span style={{ ...s.dimText, fontSize: 10, marginTop: 4, display: 'block' }}>Next check in {countdown}s</span>
              </div>
            )}

            {/* Per-city results */}
            {results.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map(r => {
                  const c = r.status === 'tickets_live' ? '#C9A84C' : r.status === 'listed_not_open' ? '#EF9F27' : r.status === 'error' ? '#E24B4A' : '#4A4438';
                  const city = CITIES.find(ci => ci.code === r.code);
                  return (
                    <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, border: `0.5px solid ${c}33` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, color: '#F0EAD6' }}>{r.city}</span>
                        <span style={{ fontSize: 11, color: '#4A4438' }}>{r.message}</span>
                      </div>
                      {r.status === 'tickets_live' && (
                        <a href={r.bmsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#C9A84C', textDecoration: 'none', border: '0.5px solid #C9A84C55', padding: '2px 8px', borderRadius: 3 }}>
                          Book →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CONTROLS */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {!running
              ? <button style={s.btnPrimary} onClick={start} disabled={selectedCities.length === 0}>▶ Start Monitoring</button>
              : <button style={s.btnStop} onClick={stop}>■ Stop</button>
            }
            <button style={s.btnSec} onClick={doCheck} disabled={globalStatus === 'checking'}>Check Once</button>
            {notifPerm !== 'granted' && (
              <button style={s.btnSec} onClick={async () => { const p = await Notification.requestPermission(); setNotifPerm(p); }}>
                Enable Alerts
              </button>
            )}
            {notifPerm === 'granted' && <span style={{ ...s.dimText, display: 'flex', alignItems: 'center', padding: '0 8px' }}>✓ Alerts on</span>}
          </div>

          {/* LOG */}
          <div style={s.logCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '0.5px solid #1A1A1A' }}>
              <span style={{ ...s.dimText, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Log · {checkCount} checks</span>
              <button style={{ background: 'none', border: 'none', color: '#4A4438', fontSize: 11, cursor: 'pointer' }} onClick={() => setLog([])}>Clear</button>
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px 0' }}>
              {log.length === 0 && <div style={{ padding: '6px 12px', color: '#4A4438', fontSize: 12 }}>No activity yet.</div>}
              {log.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 10, padding: '3px 12px', fontSize: 12, color: e.type === 'success' ? '#3DBA6F' : e.type === 'error' ? '#E24B4A' : '#9A8A78' }}>
                  <span style={{ flexShrink: 0, color: '#3A3028', fontSize: 11 }}>{e.t}</span>
                  <span>{e.msg}</span>
                </div>
              ))}
            </div>
          </div>

          <footer style={{ textAlign: 'center', fontSize: 11, color: '#7A6A58', paddingTop: 16, paddingBottom: 8 }}>
            Created for Michael Fans with love. ·{' '}
              <a href="https://github.com/darshbs/michael-tracker" target="_blank" rel="noopener noreferrer" style={{ color: '#7A6228', textDecoration: 'none' }}>
                GitHub
              </a>
          </footer>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
        select option { background: #111; }
      `}</style>
    </>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#0A0A0A', position: 'relative', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" },
  glow: { position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 500, height: 400, background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)', pointerEvents: 'none' },
  wrap: { position: 'relative', maxWidth: 640, margin: '0 auto', padding: '2.5rem 1.25rem 3rem' },
  hero: { textAlign: 'center', marginBottom: '2rem' },
  badge: { display: 'inline-block', fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', color: '#C9A84C', border: '0.5px solid #7A6228', padding: '3px 12px', borderRadius: 2, marginBottom: 12 },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(56px, 14vw, 88px)', letterSpacing: '0.06em', background: 'linear-gradient(180deg, #F0EAD6 0%, #C9A84C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginBottom: 6 },
  sub: { fontSize: 12, color: '#5A5040', letterSpacing: '0.1em' },
  card: { background: '#111', border: '0.5px solid #1E1E1E', borderRadius: 8, padding: '12px 14px', marginBottom: 10 },
  cardLabel: { fontSize: 10, color: '#7A6A58', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 },
  cityGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  cityBtn: { background: 'transparent', border: '0.5px solid #2A2A2A', color: '#9A8A78', fontSize: 12, padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }, 
  cityBtnOn: { background: 'rgba(201,168,76,0.1)', border: '0.5px solid #7A6228', color: '#C9A84C' },
  dateInput: { background: 'transparent', border: 'none', color: '#F0EAD6', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%', cursor: 'pointer' },
  select: { background: 'transparent', border: 'none', color: '#F0EAD6', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%', cursor: 'pointer' },
  statusCard: { background: '#111', border: '0.5px solid', borderRadius: 8, padding: '14px 16px', marginBottom: 10, transition: 'border-color 0.3s' },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  dimText: { fontSize: 11, color: '#8A7A68' },
  btnPrimary: { flex: 1, minWidth: 150, padding: '10px 20px', background: '#C9A84C', color: '#0A0A0A', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 500, letterSpacing: '0.07em', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnStop: { flex: 1, minWidth: 150, padding: '10px 20px', background: 'transparent', color: '#E24B4A', border: '0.5px solid #E24B4A', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnSec: { padding: '10px 16px', background: 'transparent', color: '#5A5040', border: '0.5px solid #1E1E1E', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  logCard: { background: '#111', border: '0.5px solid #1E1E1E', borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
};
