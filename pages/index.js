import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';

const STATUS_CONFIG = {
  idle:             { color: '#7A7060', bg: 'transparent',      label: 'Ready',          pulse: false },
  checking:         { color: '#4A90D9', bg: '#1A2F4A',          label: 'Checking…',      pulse: true  },
  not_listed:       { color: '#7A7060', bg: '#1A1A1A',          label: 'Not listed yet', pulse: false },
  listed_not_open:  { color: '#EF9F27', bg: '#4A3010',          label: 'Listed — not open', pulse: false },
  prasads_no_pcx:   { color: '#EF9F27', bg: '#4A3010',          label: 'Prasads listed — no PCX', pulse: false },
  prasads_live:     { color: '#3DBA6F', bg: '#1A4A2C',          label: 'Prasads LIVE!',  pulse: true  },
  tickets_live:     { color: '#C9A84C', bg: '#3A2800',          label: '🎬 TICKETS LIVE!', pulse: true },
  error:            { color: '#E24B4A', bg: '#4A1A1A',          label: 'Check failed',   pulse: false },
};

function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.13);
      g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.13 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.13);
      o.stop(ctx.currentTime + i * 0.13 + 0.4);
    });
  } catch (e) {}
}

export default function Home() {
  const [status, setStatus]           = useState('idle');
  const [message, setMessage]         = useState('Click "Start Monitoring" to begin.');
  const [checkedAt, setCheckedAt]     = useState(null);
  const [checkCount, setCheckCount]   = useState(0);
  const [running, setRunning]         = useState(false);
  const [interval, setInterval_]      = useState(60);
  const [notifPerm, setNotifPerm]     = useState('default');
  const [log, setLog]                 = useState([]);
  const [nextCheck, setNextCheck]     = useState(null);
  const [countdown, setCountdown]     = useState(null);
  const intervalRef                   = useRef(null);
  const countdownRef                  = useRef(null);
  const ticketsFound                  = useRef(false);
  const BMS_URL = 'https://in.bookmyshow.com/buytickets/michael-hyderabad/movie-hyd-ET00418765-MT/20260424';

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [{ time, msg, type, id: Date.now() + Math.random() }, ...prev].slice(0, 50));
  }, []);

  const doCheck = useCallback(async () => {
    if (ticketsFound.current) return;
    setStatus('checking');
    setCheckCount(c => {
      const n = c + 1;
      addLog(`Check #${n} — pinging BookMyShow…`);
      return n;
    });

    try {
      const res = await fetch('/api/check', { cache: 'no-store' });
      const data = await res.json();

      setCheckedAt(data.checkedAt);
      setStatus(data.status);
      setMessage(data.message);

      const logType = data.status === 'tickets_live' || data.status === 'prasads_live'
        ? 'success'
        : data.status === 'error' ? 'error' : 'info';
      addLog(data.message, logType);

      if (data.status === 'tickets_live' || data.status === 'prasads_live') {
        ticketsFound.current = true;
        playAlert();
        if (notifPerm === 'granted') {
          new Notification('🎬 Tickets are LIVE!', {
            body: 'Michael (2026) — Prasads Multiplex PCX, April 24. Book NOW!',
          });
        }
        clearInterval(intervalRef.current);
        clearInterval(countdownRef.current);
        setRunning(false);
      }
    } catch (err) {
      setStatus('error');
      setMessage(`Request failed: ${err.message}`);
      addLog(`Error: ${err.message}`, 'error');
    }
  }, [addLog, notifPerm]);

  const startMonitoring = useCallback(() => {
    if (running) return;
    ticketsFound.current = false;
    setRunning(true);
    addLog(`Monitoring started — checking every ${interval}s`);
    doCheck();

    intervalRef.current = setInterval(doCheck, interval * 1000);

    let remaining = interval;
    setNextCheck(Date.now() + interval * 1000);
    setCountdown(interval);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) remaining = interval;
    }, 1000);
  }, [running, interval, doCheck, addLog]);

  const stopMonitoring = useCallback(() => {
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    setRunning(false);
    setCountdown(null);
    setStatus('idle');
    setMessage('Monitoring stopped.');
    addLog('Monitoring stopped.');
  }, [addLog]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const requestNotif = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const isLive = status === 'tickets_live' || status === 'prasads_live';

  return (
    <>
      <Head>
        <title>Michael · Ticket Tracker</title>
        <meta name="description" content="BookMyShow ticket tracker for Michael (2026) at Prasads Multiplex PCX, Hyderabad" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>" />
      </Head>

      <div style={styles.page}>
        {/* Ambient bg */}
        <div style={styles.ambientTop} />
        <div style={styles.ambientBottom} />

        <div style={styles.wrapper}>

          {/* ── HERO ── */}
          <header style={styles.hero}>
            <div style={styles.heroBadge}>LIVE TICKET TRACKER</div>
            <h1 style={styles.heroTitle}>MICHAEL</h1>
            <p style={styles.heroSub}>The Official Biopic · King of Pop</p>
            <div style={styles.heroMeta}>
              <span style={styles.metaPill}>April 24, 2026</span>
              <span style={styles.metaDot}>·</span>
              <span style={styles.metaPill}>Prasads Multiplex</span>
              <span style={styles.metaDot}>·</span>
              <span style={styles.metaPill}>PCX Screen</span>
              <span style={styles.metaDot}>·</span>
              <span style={styles.metaPill}>IMAX</span>
            </div>
          </header>

          {/* ── STATUS CARD ── */}
          <div style={{ ...styles.statusCard, background: isLive ? 'rgba(201,168,76,0.08)' : 'var(--bg-card)', borderColor: isLive ? 'var(--gold)' : 'var(--border)' }}>
            <div style={styles.statusTop}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...styles.statusDot, background: cfg.color, boxShadow: cfg.pulse ? `0 0 12px ${cfg.color}` : 'none', animation: cfg.pulse ? 'pulse 1.2s infinite' : 'none' }} />
                <span style={{ ...styles.statusLabel, color: cfg.color }}>{cfg.label}</span>
              </div>
              {checkedAt && (
                <span style={styles.checkedAt}>
                  Last checked {new Date(checkedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <p style={styles.statusMsg}>{message}</p>

            {running && countdown !== null && !ticketsFound.current && (
              <div style={styles.countdownBar}>
                <div style={{ ...styles.countdownFill, width: `${(countdown / interval) * 100}%` }} />
                <span style={styles.countdownText}>Next check in {countdown}s</span>
              </div>
            )}

            {isLive && (
              <a href={BMS_URL} target="_blank" rel="noopener noreferrer" style={styles.bookBtn}>
                BOOK NOW ON BOOKMYSHOW →
              </a>
            )}
          </div>

          {/* ── CONTROLS ── */}
          <div style={styles.controlsRow}>
            {!running ? (
              <button style={styles.btnStart} onClick={startMonitoring}>
                ▶ Start Monitoring
              </button>
            ) : (
              <button style={styles.btnStop} onClick={stopMonitoring}>
                ■ Stop
              </button>
            )}
            <button style={styles.btnSecondary} onClick={doCheck} disabled={running && status === 'checking'}>
              Check Once
            </button>
            <a href={BMS_URL} target="_blank" rel="noopener noreferrer" style={styles.btnLink}>
              Open BMS ↗
            </a>
          </div>

          {/* ── INTERVAL + NOTIF ── */}
          <div style={styles.settingsRow}>
            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>Check every</label>
              <select
                style={styles.select}
                value={interval}
                onChange={e => setInterval_(Number(e.target.value))}
                disabled={running}
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>

            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>Browser alerts</label>
              {notifPerm === 'granted' ? (
                <span style={{ ...styles.notifBadge, background: '#1A4A2C', color: '#3DBA6F' }}>✓ Enabled</span>
              ) : notifPerm === 'denied' ? (
                <span style={{ ...styles.notifBadge, background: '#4A1A1A', color: '#E24B4A' }}>Blocked</span>
              ) : (
                <button style={styles.notifBtn} onClick={requestNotif}>Enable Notifications</button>
              )}
            </div>

            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>Total checks</label>
              <span style={styles.checkCount}>{checkCount}</span>
            </div>
          </div>

          {/* ── LOG ── */}
          <div style={styles.logCard}>
            <div style={styles.logHeader}>
              <span style={styles.logTitle}>Activity Log</span>
              <button style={styles.clearBtn} onClick={() => setLog([])}>Clear</button>
            </div>
            <div style={styles.logBody}>
              {log.length === 0 && (
                <div style={styles.logEmpty}>No activity yet.</div>
              )}
              {log.map(entry => (
                <div key={entry.id} style={{ ...styles.logEntry, color: entry.type === 'success' ? '#3DBA6F' : entry.type === 'error' ? '#E24B4A' : 'var(--text-muted)' }}>
                  <span style={styles.logTime}>{entry.time}</span>
                  <span>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── HOW IT WORKS ── */}
          <div style={styles.howCard}>
            <h3 style={styles.howTitle}>How it works</h3>
            <div style={styles.steps}>
              {[
                ['01', 'Every interval, this app calls a server-side API that fetches the BookMyShow listing for Michael (2026) in Hyderabad on April 24.'],
                ['02', 'The server parses the HTML response looking for Prasads Multiplex and the PCX screen in the results.'],
                ['03', 'The moment PCX bookings go live, you get a sound alert, browser notification, and a direct booking link.'],
                ['04', 'Keep this tab open in background. Tickets for IMAX releases at Prasads go fast — stay ahead.'],
              ].map(([n, t]) => (
                <div key={n} style={styles.step}>
                  <span style={styles.stepNum}>{n}</span>
                  <span style={styles.stepText}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <footer style={styles.footer}>
            <p>Built for MJ fans · <a href={BMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-dim)' }}>BookMyShow listing</a></p>
          </footer>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { animation-fill-mode: both; }
      `}</style>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  ambientTop: {
    position: 'fixed',
    top: -200,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 600,
    height: 400,
    background: 'radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  ambientBottom: {
    position: 'fixed',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    background: 'radial-gradient(ellipse, rgba(201,168,76,0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  wrapper: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 640,
    margin: '0 auto',
    padding: '3rem 1.5rem 4rem',
  },

  // Hero
  hero: {
    textAlign: 'center',
    marginBottom: '2.5rem',
    animation: 'fadeIn 0.6s ease',
  },
  heroBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.2em',
    color: 'var(--gold)',
    border: '0.5px solid var(--gold-dim)',
    padding: '4px 14px',
    borderRadius: 2,
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 'clamp(64px, 15vw, 96px)',
    letterSpacing: '0.05em',
    color: 'var(--text)',
    lineHeight: 1,
    marginBottom: 8,
    background: 'linear-gradient(180deg, #F0EAD6 0%, #C9A84C 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    fontSize: 13,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    marginBottom: 20,
  },
  heroMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },
  metaPill: {
    fontSize: 11,
    color: 'var(--gold)',
    background: 'rgba(201,168,76,0.08)',
    border: '0.5px solid rgba(201,168,76,0.2)',
    padding: '3px 10px',
    borderRadius: 2,
    letterSpacing: '0.05em',
  },
  metaDot: {
    color: 'var(--text-dim)',
    fontSize: 12,
  },

  // Status card
  statusCard: {
    border: '0.5px solid',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    marginBottom: '1rem',
    transition: 'all 0.3s ease',
    animation: 'fadeIn 0.5s ease 0.1s',
  },
  statusTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.05em',
  },
  checkedAt: {
    fontSize: 11,
    color: 'var(--text-dim)',
    letterSpacing: '0.02em',
  },
  statusMsg: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  countdownBar: {
    marginTop: 14,
    height: 2,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  countdownFill: {
    height: '100%',
    background: 'var(--gold-dim)',
    borderRadius: 1,
    transition: 'width 1s linear',
  },
  countdownText: {
    position: 'absolute',
    right: 0,
    top: 4,
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: '0.05em',
  },
  bookBtn: {
    display: 'block',
    marginTop: 16,
    background: 'var(--gold)',
    color: '#0A0A0A',
    textAlign: 'center',
    padding: '12px 24px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.1em',
    textDecoration: 'none',
    transition: 'opacity 0.15s',
  },

  // Controls
  controlsRow: {
    display: 'flex',
    gap: 8,
    marginBottom: '1rem',
    flexWrap: 'wrap',
    animation: 'fadeIn 0.5s ease 0.2s',
  },
  btnStart: {
    flex: 1,
    minWidth: 160,
    padding: '10px 20px',
    background: 'var(--gold)',
    color: '#0A0A0A',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnStop: {
    flex: 1,
    minWidth: 160,
    padding: '10px 20px',
    background: 'transparent',
    color: '#E24B4A',
    border: '0.5px solid #E24B4A',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.08em',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '0.5px solid var(--border)',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnLink: {
    padding: '10px 18px',
    background: 'transparent',
    color: 'var(--gold-dim)',
    border: '0.5px solid var(--border)',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
  },

  // Settings row
  settingsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    animation: 'fadeIn 0.5s ease 0.3s',
  },
  settingItem: {
    flex: 1,
    minWidth: 140,
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border)',
    borderRadius: 6,
    padding: '10px 14px',
  },
  settingLabel: {
    display: 'block',
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: '0.1em',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  select: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    width: '100%',
  },
  notifBadge: {
    display: 'inline-block',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 3,
  },
  notifBtn: {
    background: 'transparent',
    border: '0.5px solid var(--border-bright)',
    color: 'var(--gold)',
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: '0.04em',
  },
  checkCount: {
    fontSize: 20,
    fontFamily: "'Bebas Neue', sans-serif",
    color: 'var(--gold)',
    letterSpacing: '0.05em',
  },

  // Log
  logCard: {
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border)',
    borderRadius: 8,
    marginBottom: '1.5rem',
    overflow: 'hidden',
    animation: 'fadeIn 0.5s ease 0.4s',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--border)',
  },
  logTitle: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
  },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  logBody: {
    maxHeight: 180,
    overflowY: 'auto',
    padding: '8px 0',
  },
  logEmpty: {
    fontSize: 13,
    color: 'var(--text-dim)',
    padding: '8px 14px',
  },
  logEntry: {
    display: 'flex',
    gap: 12,
    padding: '4px 14px',
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.5,
  },
  logTime: {
    color: 'var(--text-dim)',
    flexShrink: 0,
    fontSize: 11,
  },

  // How it works
  howCard: {
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border)',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    animation: 'fadeIn 0.5s ease 0.5s',
  },
  howTitle: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  step: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  stepNum: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    color: 'var(--gold-dim)',
    lineHeight: 1.2,
    flexShrink: 0,
  },
  stepText: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.7,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--text-dim)',
    letterSpacing: '0.05em',
  },
};
