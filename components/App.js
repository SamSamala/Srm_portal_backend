// Root app component — manages auth state and renders Landing or Dashboard
import { useState, useEffect } from 'react';
import Landing from './Landing';
import Dashboard from './Dashboard';
import { getDayOrder } from './Dashboard';

const LS_DATA_KEY  = 'srm_data_cache';
const LS_DATA_TIME = 'srm_data_cache_ts';
const LS_CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('srm_dark') !== '0');
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
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showSaveLogin, setShowSaveLogin] = useState(false);
  const [isFirstLogin,  setIsFirstLogin]  = useState(false);
  // Subscription state
  const [isPro,       setIsPro]       = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  function saveDataCache(jsonData) {
    try {
      const now = Date.now();
      localStorage.setItem(LS_DATA_KEY, JSON.stringify(jsonData));
      localStorage.setItem(LS_DATA_TIME, String(now));
      setLastUpdatedTs(now);
    } catch(e) {}
  }

  function proceedAfterLogin() {
    if (!localStorage.getItem('campushub_sub_shown')) {
      setShowSubscribe(true);
    } else {
      setView('dashboard');
    }
  }

  // Fetch subscription status from server (called after every login)
  async function fetchSubStatus() {
    try {
      const res = await fetch('/api/billing/status');
      if (res.ok) {
        const json = await res.json();
        setIsPro(!!json.isPro);
      }
    } catch(e) {}
  }

  // Persist dark mode preference
  //hi
  useEffect(() => { localStorage.setItem('srm_dark', dark ? '1' : '0'); }, [dark]);

  // On mount: check for saved session + localStorage data cache
  useEffect(() => {
    // One-time migration: delete any legacy plaintext credentials
    if (localStorage.getItem('srm_saved_creds')) localStorage.removeItem('srm_saved_creds');

    const token         = localStorage.getItem('srm_session_token');
    const savedEmail    = localStorage.getItem('srm_session_email');
    const rememberToken = localStorage.getItem('srm_remember_token');
    if (!token || !savedEmail) {
      if (rememberToken) { autoLoginWithToken(rememberToken); }
      else { setView('landing'); }
      return;
    }
    setSavedToken(token); setEmail(savedEmail);
    const cachedRaw = localStorage.getItem(LS_DATA_KEY);
    const cachedTs  = parseInt(localStorage.getItem(LS_DATA_TIME) || '0');
    const isStale   = !cachedRaw || (Date.now() - cachedTs) >= LS_CACHE_MAX_AGE;
    if (cachedRaw && !isStale) {
      try {
        setData(JSON.parse(cachedRaw)); setLastUpdatedTs(cachedTs); setView('dashboard');
        fetchSubStatus();
        backgroundRefresh(savedEmail, token, false);
        return;
      } catch(e) {}
    }
    if (isStale && rememberToken) {
      if (cachedRaw) {
        try {
          setData(JSON.parse(cachedRaw)); setLastUpdatedTs(cachedTs); setView('dashboard');
          fetchSubStatus();
          backgroundRefreshWithToken(rememberToken);
          return;
        } catch(e) {}
      }
      autoLoginWithToken(rememberToken); return;
    }
    autoLogin(savedEmail, token);
  }, []);

  // Background refresh (silent — keeps showing existing data while fetching)
  // Data on screen only updates AFTER the full fetch completes (spinner stops first)
  async function backgroundRefresh(emailArg, token, forceRefresh) {
    setDataLoading(true);
    let freshData = null;
    let expired   = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 270000);
      const rememberToken = localStorage.getItem('srm_remember_token');
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailArg, password: null, sessionToken: token, forceRefresh, remember_token: rememberToken }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();

      if (res.status === 401 || json.error === 'session_expired') {
        expired = true;
      } else if (res.ok && json.data) {
        // If backend silently re-logged in (session expired but remember_token worked), update session token
        if (json.sessionToken) {
          localStorage.setItem('srm_session_token', json.sessionToken);
          setSavedToken(json.sessionToken);
        }
        freshData = json.data;
      }
    } catch(e) {
      // Network/timeout error — keep existing data silently
    } finally {
      // Stop spinner first, then apply new data so UI doesn't flash mid-spin
      setDataLoading(false);
      if (expired) {
        const expiredRememberToken = localStorage.getItem('srm_remember_token');
        if (expiredRememberToken) {
          backgroundRefreshWithToken(expiredRememberToken);
        } else {
          // Session expired, no saved login — redirect to login but keep data cache intact
          // so user sees their data immediately after re-logging in
          localStorage.removeItem('srm_session_token'); localStorage.removeItem('srm_session_email');
          setSavedToken(''); setData(null); setView('login');
        }
      } else if (freshData) {
        setData(freshData);
        if (forceRefresh) {
          saveDataCache(freshData);
        } else {
          try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(freshData)); } catch(e) {}
        }
      }
    }
  }

  async function backgroundRefreshWithToken(rememberToken) {
    setDataLoading(true);
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remember_token: rememberToken }) });
      const json = await res.json();
      if (res.ok && json.data && !json.needsCaptcha) {
        if (json.sessionToken) {
          const em = json.data?.student?.email || localStorage.getItem('srm_session_email');
          localStorage.setItem('srm_session_token', json.sessionToken);
          localStorage.setItem('srm_session_email', em || '');
          setSavedToken(json.sessionToken);
          if (em) setEmail(em);
        }
        setData(json.data);
        try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(json.data)); } catch(e) {}
      } else if (json.error === 'invalid_token' || json.error === 'credentials_expired') {
        localStorage.removeItem('srm_remember_token');
      }
    } catch(e) {} finally { setDataLoading(false); }
  }

  async function autoLoginWithToken(rememberToken) {
    setIsFirstLogin(false); setLoading(true); setView('loading');
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remember_token: rememberToken }) });
      const json = await res.json();
      if (res.ok && json.data && !json.needsCaptcha) {
        if (json.sessionToken) {
          const em = json.data?.student?.email || '';
          localStorage.setItem('srm_session_token', json.sessionToken);
          localStorage.setItem('srm_session_email', em);
          setSavedToken(json.sessionToken);
          if (em) setEmail(em);
        }
        setData(json.data); saveDataCache(json.data);
        fetchSubStatus();
        setView('dashboard');
      } else {
        localStorage.removeItem('srm_remember_token');
        setView('landing');
      }
    } catch(e) { setView('landing'); } finally { setLoading(false); }
  }

  // Auto-login with saved session token (shows spinner — used when no cache)
  async function autoLogin(emailArg, token) {
    try {
      setLoading(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 270000);

      const rememberToken = localStorage.getItem('srm_remember_token');
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailArg, password: null, sessionToken: token, remember_token: rememberToken }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const json = await res.json();

      if (res.ok && json.data && !json.needsCaptcha) {
        if (json.sessionToken) {
          localStorage.setItem('srm_session_token', json.sessionToken);
          setSavedToken(json.sessionToken);
        }
        setData(json.data);
        saveDataCache(json.data);
        fetchSubStatus();
        setView('dashboard');
      } else if (res.status === 401 || json.error === 'session_expired') {
        const expiredRememberToken = localStorage.getItem('srm_remember_token');
        localStorage.removeItem('srm_session_token'); localStorage.removeItem('srm_session_email'); setSavedToken('');
        if (expiredRememberToken) { setLoading(false); autoLoginWithToken(expiredRememberToken); return; }
        setView('login');
      } else { setView('landing'); }
    } catch (e) { setView('landing'); } finally { setLoading(false); }
  }

  // Manual login
  async function handleLogin(e) {
    e?.preventDefault();
    if (!email || !pass) { setError('Enter email and password.'); return; }
    setError('');
    setIsFirstLogin(!localStorage.getItem('srm_session_token'));
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
        fetchSubStatus();
        if (!localStorage.getItem('srm_remember_token') && !localStorage.getItem('srm_save_login_declined')) {
          setShowSaveLogin(true);
        } else { proceedAfterLogin(); }
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
        fetchSubStatus();
        if (!localStorage.getItem('srm_remember_token') && !localStorage.getItem('srm_save_login_declined')) {
          setShowSaveLogin(true);
        } else { proceedAfterLogin(); }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // First-time subscribe prompt
  async function handleSubscribe(subscribe) {
    localStorage.setItem('campushub_sub_shown', '1');
    if (subscribe) {
      try {
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch (e) {}
    }
    setShowSubscribe(false);
    setView('dashboard');
  }

  // Razorpay upgrade flow
  async function startUpgrade() {
    setShowUpgrade(false);
    try {
      const orderRes = await fetch('/api/billing/create-order', { method: 'POST' });
      if (!orderRes.ok) {
        const j = await orderRes.json().catch(() => ({}));
        if (j.error === 'already_pro') { setIsPro(true); return; }
        alert('Could not start payment. Please try again.');
        return;
      }
      const { orderId, keyId } = await orderRes.json();

      await new Promise((resolve, reject) => {
        if (window.Razorpay) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load payment gateway'));
        document.body.appendChild(s);
      });

      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: keyId,
          order_id: orderId,
          amount: 5000,
          currency: 'INR',
          name: 'CampusHub Pro',
          description: 'Pro access — ₹50',
          theme: { color: dark ? '#4f8dff' : '#2563eb' },
          handler: async function(response) {
            try {
              const verRes = await fetch('/api/billing/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
              });
              if (verRes.ok) {
                setIsPro(true);
              } else {
                alert('Payment received but verification failed. Please contact support.');
              }
            } catch(e) {
              alert('Verification error. Please contact support.');
            }
            resolve();
          },
          modal: { ondismiss: resolve },
        });
        rzp.open();
      });
    } catch(e) {
      alert(e.message || 'Payment failed. Please try again.');
    }
  }

  // Logout
  async function logout() {
    localStorage.removeItem('srm_session_token');
    localStorage.removeItem('srm_session_email');
    localStorage.removeItem('srm_remember_token');
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
    setIsPro(false);
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
    isFirstLogin,
    onManualRefresh: () => backgroundRefresh(email, savedToken, true),
    isPro,
    onUpgrade: () => setShowUpgrade(true),
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

  // Save Login prompt (after first successful manual login)
  if (showSaveLogin) return (
    <SaveLoginPrompt
      dark={dark}
      onYes={async () => {
        try {
          const res = await fetch('/api/auth/remember', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
          const json = await res.json();
          if (res.ok && json.remember_token) localStorage.setItem('srm_remember_token', json.remember_token);
        } catch(e) {}
        setShowSaveLogin(false); proceedAfterLogin();
      }}
      onNo={() => {
        localStorage.setItem('srm_save_login_declined', '1');
        setShowSaveLogin(false); proceedAfterLogin();
      }}
    />
  );

  // Subscribe prompt (first-time login only)
  if (showSubscribe) return <SubscribePrompt email={email} dark={dark} onDone={handleSubscribe} />;

  return (
    <>
      <Dashboard {...shared} />
      {showUpgrade && (
        <UpgradeModal
          dark={dark}
          onClose={() => setShowUpgrade(false)}
          onPay={startUpgrade}
        />
      )}
    </>
  );
}

function UpgradeModal({ dark, onClose, onPay }) {
  const surf   = dark ? '#0c1120' : '#fff';
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)';
  const text   = dark ? '#eef2ff' : '#1a1510';
  const text2  = dark ? '#8896b3' : '#6b6155';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
      onClick={onClose}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}`}</style>
      <div style={{background:surf,border:'1px solid '+border,borderRadius:20,
        padding:'32px 28px',maxWidth:360,width:'100%',
        boxShadow:'0 24px 48px rgba(0,0,0,.4)',animation:'fadeUp .3s ease both'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:32,textAlign:'center',marginBottom:12}}>🔒</div>
        <div style={{fontSize:20,fontWeight:800,color:text,textAlign:'center',marginBottom:8}}>
          Upgrade to Access
        </div>
        <div style={{fontSize:13,color:text2,lineHeight:1.65,textAlign:'center',marginBottom:20}}>
          Internship listings are a <strong style={{color:text}}>Pro</strong> feature. Get full access to all available openings for just <strong style={{color:'#4f8dff'}}>₹50</strong>.
        </div>
        <ul style={{listStyle:'none',padding:0,margin:'0 0 22px',display:'flex',flexDirection:'column',gap:8}}>
          {['Browse all internship listings','New openings added regularly'].map(f=>(
            <li key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:text2}}>
              <span style={{color:'#22d17a',fontWeight:700,fontSize:16,lineHeight:1}}>✓</span>{f}
            </li>
          ))}
        </ul>
        <button onClick={onPay} style={{width:'100%',padding:'13px',borderRadius:10,
          border:'none',background:'linear-gradient(135deg,#4f8dff,#7c5cfc)',color:'#fff',
          fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:10,transition:'opacity .15s'}}
          onMouseOver={e=>e.currentTarget.style.opacity='.88'}
          onMouseOut={e=>e.currentTarget.style.opacity='1'}>
          Upgrade — ₹50 →
        </button>
        <button onClick={onClose} style={{width:'100%',padding:'11px',borderRadius:10,
          border:'1px solid '+border,background:'transparent',color:text2,
          fontSize:13,fontWeight:500,cursor:'pointer'}}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

function SaveLoginPrompt({ dark, onYes, onNo }) {
  const bg=dark?'#04060d':'#f5f0e8', surf=dark?'#0c1120':'#fff', border=dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.09)', text=dark?'#eef2ff':'#1a1510', text2=dark?'#8896b3':'#6b6155';
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:bg,padding:16,fontFamily:'Plus Jakarta Sans,sans-serif'}}>
<style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}`}</style>
      <div style={{background:surf,border:'1px solid '+border,borderRadius:20,padding:'32px 28px',maxWidth:380,width:'100%',boxShadow:'0 24px 48px rgba(0,0,0,.3)',animation:'fadeUp .4s ease both'}}>
        <div style={{fontSize:32,marginBottom:12,textAlign:'center'}}>&#128274;</div>
        <div style={{fontSize:20,fontWeight:800,color:text,marginBottom:6,textAlign:'center'}}>Save login?</div>
        <div style={{fontSize:13,color:text2,lineHeight:1.6,textAlign:'center',marginBottom:24}}>
          We will automatically refresh your data daily so it is ready when you open the app.
        </div>
        <button onClick={onYes} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#4f8dff,#7c5cfc)',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:8}}
          onMouseOver={e=>e.currentTarget.style.opacity='.88'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>Yes, keep me logged in</button>
        <button onClick={onNo} style={{width:'100%',padding:'11px',borderRadius:10,border:'1px solid '+border,background:'transparent',color:text2,fontSize:13,cursor:'pointer'}}
          onMouseOver={e=>e.currentTarget.style.borderColor='#4f8dff'} onMouseOut={e=>e.currentTarget.style.borderColor=border}>No thanks</button>
      </div>
    </div>
  );
}

function SubscribePrompt({ email, dark, onDone }) {
  const bg = dark ? '#04060d' : '#f5f0e8';
  const surf = dark ? '#0c1120' : '#fff';
  const border = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)';
  const text = dark ? '#eef2ff' : '#1a1510';
  const text2 = dark ? '#8896b3' : '#6b6155';
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:bg,padding:16,fontFamily:'Plus Jakarta Sans,sans-serif'}}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}`}</style>
      <div style={{background:surf,border:'1px solid '+border,borderRadius:20,
        padding:'32px 28px',maxWidth:380,width:'100%',
        boxShadow:'0 24px 48px rgba(0,0,0,.3)',animation:'fadeUp .4s ease both'}}>
        <div style={{fontSize:32,marginBottom:12,textAlign:'center'}}>📬</div>
        <div style={{fontSize:20,fontWeight:800,color:text,marginBottom:6,textAlign:'center'}}>Stay in the loop</div>
        <div style={{fontSize:13,color:text2,lineHeight:1.6,textAlign:'center',marginBottom:22}}>
          Get notified about new internship postings and campus updates directly to your inbox.
        </div>
        <div style={{background:dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.04)',
          border:'1px solid '+border,borderRadius:10,padding:'10px 14px',
          fontSize:13,color:text2,marginBottom:20,wordBreak:'break-all'}}>
          {email}
        </div>
        <button onClick={()=>onDone(true)} style={{width:'100%',padding:'12px',borderRadius:10,
          border:'none',background:'linear-gradient(135deg,#4f8dff,#7c5cfc)',color:'#fff',
          fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:8,transition:'opacity .15s'}}
          onMouseOver={e=>e.currentTarget.style.opacity='.88'}
          onMouseOut={e=>e.currentTarget.style.opacity='1'}>
          Subscribe →
        </button>
        <button onClick={()=>onDone(false)} style={{width:'100%',padding:'11px',borderRadius:10,
          border:'1px solid '+border,background:'transparent',color:text2,
          fontSize:13,fontWeight:500,cursor:'pointer',transition:'all .15s'}}
          onMouseOver={e=>e.currentTarget.style.borderColor='#4f8dff'}
          onMouseOut={e=>e.currentTarget.style.borderColor=border}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
