import { useState, useEffect } from 'react';
import Landing from './Landing';
import Dashboard from './Dashboard';
import { getDayOrder } from './Dashboard';

export default function App() {
  const [dark,        setDark]        = useState(false);
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

  useEffect(() => {
  const token = localStorage.getItem('srm_session_token');
  const savedEmail = localStorage.getItem('srm_session_email');

  if (token && savedEmail) {
    setSavedToken(token);
    setEmail(savedEmail);

    autoLogin(savedEmail, token); // 👈 THIS LINE
  }
}, []);
  async function handleLogin(e) {
    e?.preventDefault();
    if (!email || !pass) { setError('Enter email and password.'); return; }
    setError(''); setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2min timeout
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, sessionToken: savedToken }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Login failed');
      setLoading(false);
      if (json.needsCaptcha) {
        setCapImg(json.captchaImage); setSessId(json.sessionId); setView('captcha');
      } else {
        if (json.sessionToken && typeof window !== 'undefined') {
          localStorage.setItem('srm_session_token', json.sessionToken);
          localStorage.setItem('srm_session_email', email);
        }
        setView('dashboard');
        setDataLoading(true);
        setData(json.data);
        setDataLoading(false);
      }
    } catch (err) {
      setLoading(false);
      if (err.name === 'AbortError') setError('Request timed out. SRM portal may be down. Please try again.');
      else setError(err.message);
    }
  }

  async function handleCaptcha(e) {
    e?.preventDefault();
    if (!capSol) { setError('Enter CAPTCHA text.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessId, solution: capSol }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'CAPTCHA failed');
      setLoading(false);
      if (json.needsCaptcha) {
        setCapImg(json.captchaImage); setCapSol(''); setError('Wrong CAPTCHA. Try again.');
      } else {
        if (json.sessionToken && typeof window !== 'undefined') {
          localStorage.setItem('srm_session_token', json.sessionToken);
          localStorage.setItem('srm_session_email', email);
        }
        setView('dashboard');
        setDataLoading(true);
        setData(json.data);
        setDataLoading(false);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  }

  async function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('srm_session_token');
    localStorage.removeItem('srm_session_email');
  }
  setSavedToken('');
  try { await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); } catch (e) {}
  setView('landing'); setData(null); setEmail(''); setPass('');
}


// 👇 ADD THIS RIGHT HERE (same file, below logout)

async function autoLogin(email, token) {
  try {
    setDataLoading(true);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'AUTO_LOGIN',
        sessionToken: token
      })
    });

    const json = await res.json();

    if (res.ok && !json.needsCaptcha && json.data) {
  console.log("AutoLogin success:", json);

  setData(json.data);
  setView('dashboard');

} else {
  console.log("AutoLogin failed:", json);

  // ❗ DO NOT logout (this was killing your session)
  setView('landing');
}

  } catch (e) {
    logout();
  } finally {
    setDataLoading(false);
  }
}

  const shared = {
    dark, setDark, view, setView, data, setData,
    email, setEmail, pass, setPass,
    loading, setLoading, error, setError,
    capImg, setCapImg, capSol, setCapSol, sessId, setSessId,
    savedToken, setSavedToken, showPass, setShowPass,
    dataLoading, setDataLoading,
    handleLogin, handleCaptcha, logout,
  };

  if (view === 'loading') {return <div style={{padding:20}}>Checking session...</div>;}
  return <Dashboard {...shared} />;
}