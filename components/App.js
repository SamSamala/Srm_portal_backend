import { useState, useEffect } from 'react';
import Landing from './Landing';
import Dashboard from './Dashboard';
import { getDayOrder } from './Dashboard';

const LS_DATA_KEY  = 'srm_data_cache';
const LS_DATA_TIME = 'srm_data_cache_ts';
const LS_CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours

export default function App() {
  const [dark, setDark] = useState(false);
  const [view,        setView]        = useState('loading');
  const [email,       setEmail]       = useState('');
  const [pass,        setPass]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [data,        setData]        = useState(null);
  const [capImg,      setCapImg]      = useState('');
  const [capSol,      setCapSol]      = useState('');
  const [sessId,      setSessId]      = useState('');
  const [savedToken,  setSavedToken]  = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastUpdatedTs, setLastUpdatedTs] = useState(0);

  function saveDataCache(jsonData) {
    try {
      const now = Date.now();
      localStorage.setItem(LS_DATA_KEY, JSON.stringify(jsonData));
      localStorage.setItem(LS_DATA_TIME, String(now));
      setLastUpdatedTs(now);
    } catch(e) {}
  }

  // On mount: check for saved session + localStorage data cache
  useEffect(() => {
    const token      = localStorage.getItem('srm_session_token');
    const savedEmail = localStorage.getItem('srm_session_email');

    if (!token || !savedEmail) { setView('landing'); return; }

    setSavedToken(token);
    setEmail(savedEmail);

    // Try to show cached data immediately (instant display)
    const cachedRaw = localStorage.getItem(LS_DATA_KEY);
    const cachedTs  = parseInt(localStorage.getItem(LS_DATA_TIME) || '0');

    if (cachedRaw && (Date.now() - cachedTs) < LS_CACHE_MAX_AGE) {
      try {
        setData(JSON.parse(cachedRaw));
        setLastUpdatedTs(cachedTs);
        setView('dashboard');
        // Silently refresh in background (no spinner)
        backgroundRefresh(savedEmail, token, false);
        return;
      } catch(e) {}
    }

    // No usable cache — normal auto-login with spinner
    autoLogin(savedEmail, token);
  }, []);

  // Background refresh (silent — keeps showing existing data while fetching)
  async function backgroundRefresh(emailArg, token, forceRefresh) {
    setDataLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 270000);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailArg, password: null, sessionToken: token, forceRefresh }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();

      if (res.status === 401 || json.error === 'session_expired') {
        localStorage.removeItem('srm_session_token');
        localStorage.removeItem('srm_session_email');
        localStorage.removeItem(LS_DATA_KEY);
        localStorage.removeItem(LS_DATA_TIME);
        setSavedToken('');
        setData(null);
        setView('login');
      } else if (res.ok && json.data) {
        setData(json.data);
        saveDataCache(json.data);
      }
      // On network/timeout error: keep showing existing data silently
    } catch(e) {}
    finally {
      setDataLoading(false);
    }
  }

  // Auto-login with saved session token (shows spinner — used when no cache)
  async function autoLogin(emailArg, token) {
    try {
      setLoading(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 270000);

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailArg, password: null, sessionToken: token }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const json = await res.json();

      if (res.ok && json.data && !json.needsCaptcha) {
        setData(json.data);
        saveDataCache(json.data);
        setView('dashboard');
      } else if (res.status === 401 || json.error === 'session_expired') {
        localStorage.removeItem('srm_session_token');
        localStorage.removeItem('srm_session_email');
        setSavedToken('');
        setView('login');
      } else {
        setView('landing');
      }
    } catch (e) {
      setView('landing');
    } finally {
      setLoading(false);
    }
  }

  // Manual login
  async function handleLogin(e) {
    e?.preventDefault();
    if (!email || !pass) { setError('Enter email and password.'); return; }
    setError('');
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 270000);

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Login failed');

      if (json.needsCaptcha) {
        setCapImg(json.captchaImage);
        setSessId(json.sessionId);
        setView('captcha');
      } else {
        if (json.sessionToken) {
          localStorage.setItem('srm_session_token', json.sessionToken);
          localStorage.setItem('srm_session_email', email);
          setSavedToken(json.sessionToken);
        }
        setData(json.data);
        saveDataCache(json.data);
        setView('dashboard');
      }
    } catch (err) {
      if (err.name === 'AbortError') setError('Request timed out. SRM portal may be down. Please try again.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // CAPTCHA solve
  async function handleCaptcha(e) {
    e?.preventDefault();
    if (!capSol) { setError('Enter CAPTCHA text.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessId, solution: capSol }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'CAPTCHA failed');

      if (json.needsCaptcha) {
        setCapImg(json.captchaImage);
        setCapSol('');
        setError('Wrong CAPTCHA. Try again.');
      } else {
        if (json.sessionToken) {
          localStorage.setItem('srm_session_token', json.sessionToken);
          localStorage.setItem('srm_session_email', email);
          setSavedToken(json.sessionToken);
        }
        setData(json.data);
        saveDataCache(json.data);
        setView('dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Logout
  async function logout() {
    localStorage.removeItem('srm_session_token');
    localStorage.removeItem('srm_session_email');
    localStorage.removeItem(LS_DATA_KEY);
    localStorage.removeItem(LS_DATA_TIME);
    setSavedToken('');
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (e) {}
    setData(null);
    setEmail('');
    setPass('');
    setLastUpdatedTs(0);
    setView('landing');
  }

  const shared = {
    dark, setDark,
    view, setView,
    data, setData,
    email, setEmail,
    pass, setPass,
    loading, setLoading,
    error, setError,
    capImg, setCapImg,
    capSol, setCapSol,
    sessId, setSessId,
    savedToken, setSavedToken,
    showPass, setShowPass,
    dataLoading, setDataLoading,
    handleLogin, handleCaptcha, logout,
    lastUpdatedTs,
    onManualRefresh: () => backgroundRefresh(email, savedToken, true),
  };

  // Checking session (instant — only shows during useEffect)
  if (view === 'loading') return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: dark ? '#04060d' : '#f5f0e8',
      color: dark ? '#eef2ff' : '#1a1510',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 13,
      gap: 10,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        border: '2px solid rgba(79,141,255,.3)',
        borderTopColor: '#4f8dff',
        animation: 'spin .7s linear infinite',
      }}/>
      Checking session...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Landing page
  if (view === 'landing') return (
    <Landing
      onLogin={() => setView('login')}
      dark={dark}
      setDark={setDark}
    />
  );

  // Everything else (login, captcha, dashboard) handled inside Dashboard
  return <Dashboard {...shared} />;
}
