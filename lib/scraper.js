// Scraper — HTTP-based authentication and data extraction for SRM portal
// Replaces Playwright browser automation with direct HTTP requests + cheerio parsing
const redis = require('./redis');
const { getStudentCache, setStudentCache } = require('./db');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

const SIGNIN_PAGE = 'https://academia.srmist.edu.in/accounts/p/10002227248/signin';
const SIGNIN_AC   = 'https://academia.srmist.edu.in/accounts/signin.ac';
const PAGE_URL_BASE = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/';
const BASE_HEADERS = {
  'Origin': 'https://academia.srmist.edu.in',
  'Referer': 'https://academia.srmist.edu.in/accounts/p/10002227248/signin',
  'User-Agent': UA,
};

async function trackUser(email) {
  try {
    await redis.sadd('srm:users', email);
  } catch(e) {
    console.warn('User tracking failed (non-fatal):', e.message);
  }
}

// ─── COOKIE JAR ──────────────────────────────────────────────────────────────

class CookieJar {
  constructor() { this.cookies = {}; }

  update(response) {
    // getSetCookie() returns individual Set-Cookie headers (Node 18.15+)
    const setCookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/);
    for (const sc of setCookies) {
      if (!sc) continue;
      const [pair] = sc.split(';');
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (name) this.cookies[name] = value;
    }
  }

  toString() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  toJSON() { return { ...this.cookies }; }

  static fromJSON(obj) {
    const jar = new CookieJar();
    jar.cookies = { ...obj };
    return jar;
  }
}

function cookiesToString(cookies) {
  if (typeof cookies === 'string') return cookies;
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ─── HTTP LOGIN ──────────────────────────────────────────────────────────────

async function httpLogin(email, password) {
  const jar = new CookieJar();

  // Step 1: Load signin page to get iamcsr CSRF cookie
  console.log('Step 1: Loading signin page...');
  const r0 = await fetch(SIGNIN_PAGE, {
    headers: BASE_HEADERS,
    redirect: 'manual',
  });
  jar.update(r0);
  // Follow redirects manually to capture all cookies
  if (r0.status >= 300 && r0.status < 400) {
    const loc = r0.headers.get('location');
    if (loc) {
      const r0b = await fetch(loc, { headers: { ...BASE_HEADERS, Cookie: jar.toString() }, redirect: 'manual' });
      jar.update(r0b);
    }
  }

  // Step 2: POST credentials to signin.ac
  console.log('Step 2: Posting credentials...');
  const payload = new URLSearchParams({
    username: email,
    password: password,
    client_portal: 'true',
    portal: '10002227248',
    servicename: 'ZohoCreator',
    serviceurl: 'https://academia.srmist.edu.in/',
    is_ajax: 'true',
    grant_type: 'password',
    service_language: 'en',
  });

  const r1 = await fetch(SIGNIN_AC, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': jar.toString(),
    },
    body: payload.toString(),
    redirect: 'manual',
  });
  jar.update(r1);

  const loginText = await r1.text();
  let loginData;
  try {
    loginData = JSON.parse(loginText);
  } catch (e) {
    throw new Error('Unexpected login response. Portal may be down.');
  }

  if (loginData.error) {
    const msg = loginData.error.msg || loginData.error.message || JSON.stringify(loginData.error);
    if (/captcha/i.test(msg) || /too many/i.test(msg)) {
      throw new Error('CAPTCHA required — too many login attempts. Please wait 15-30 minutes and try again.');
    }
    throw new Error(msg);
  }

  const data = loginData.data || {};
  const accessToken = data.access_token;
  const oauthorizeUri = data.oauthorize_uri;

  if (!accessToken || !oauthorizeUri) {
    throw new Error('Unexpected login response structure. Keys: ' + Object.keys(data).join(', '));
  }

  // Step 3: GET oauthorize — use HASH1 only (strip #HASH2#flag fragment)
  console.log('Step 3: OAuth handshake...');
  const hash1 = accessToken.split('#')[0];
  const authUrl = `${oauthorizeUri}&access_token=${hash1}&token_type=Bearer`;

  const r2 = await fetch(authUrl, {
    headers: { ...BASE_HEADERS, Cookie: jar.toString() },
    redirect: 'manual',
  });
  jar.update(r2);

  // Step 4: Follow redirect to zohoportal callback
  if (r2.status >= 300 && r2.status < 400) {
    const callbackUrl = r2.headers.get('location');
    if (callbackUrl) {
      console.log('Step 4: Following callback redirect...');
      const r3 = await fetch(callbackUrl, {
        headers: { ...BASE_HEADERS, Referer: authUrl, Cookie: jar.toString() },
        redirect: 'manual',
      });
      jar.update(r3);

      // Follow any further redirects
      if (r3.status >= 300 && r3.status < 400) {
        const nextUrl = r3.headers.get('location');
        if (nextUrl) {
          const r3b = await fetch(nextUrl, {
            headers: { ...BASE_HEADERS, Cookie: jar.toString() },
            redirect: 'manual',
          });
          jar.update(r3b);
        }
      }
    }
  }

  // Step 5: POST back to academia to complete session (replicates JS postRedirection)
  console.log('Step 5: Completing session...');
  const iamcsrValue = jar.cookies['iamcsr'] || '';
  const r4 = await fetch('https://academia.srmist.edu.in/', {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://accounts.zohoportal.com/',
      'Cookie': jar.toString(),
    },
    body: `iamcsrcoo=${encodeURIComponent(iamcsrValue)}`,
    redirect: 'manual',
  });
  jar.update(r4);

  // Follow any final redirects
  if (r4.status >= 300 && r4.status < 400) {
    const finalUrl = r4.headers.get('location');
    if (finalUrl) {
      const r4b = await fetch(finalUrl, {
        headers: { ...BASE_HEADERS, Cookie: jar.toString() },
        redirect: 'manual',
      });
      jar.update(r4b);
    }
  }

  console.log('Login complete. Cookies acquired:', Object.keys(jar.cookies).length);
  return jar.toJSON();
}

// ─── PAGE FETCHING ───────────────────────────────────────────────────────────

function jsUnescape(s) {
  s = s.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/\\([^nrtu\\])/g, '$1');
  return s;
}

async function fetchPage(cookies, viewLinkName) {
  const cookieStr = cookiesToString(cookies);
  const url = PAGE_URL_BASE + viewLinkName;

  console.log('Fetching page:', viewLinkName);
  const res = await fetch(url, {
    headers: {
      'Origin': 'https://academia.srmist.edu.in',
      'User-Agent': UA,
      'Cookie': cookieStr,
    },
    redirect: 'follow',
  });

  const html = await res.text();

  const marker = `document.getElementById("zc-viewcontainer_${viewLinkName}").innerHTML = pageSanitizer.sanitize('`;
  const startIdx = html.indexOf(marker);

  if (startIdx === -1) {
    console.warn('Page marker not found for:', viewLinkName);
    return null;
  }

  const contentStart = startIdx + marker.length;
  const contentEnd = html.indexOf("'", contentStart);
  if (contentEnd === -1) {
    console.warn('Could not find closing quote for:', viewLinkName);
    return null;
  }

  const rawContent = html.substring(contentStart, contentEnd);
  return jsUnescape(rawContent);
}

// ─── HTML TO TEXT ────────────────────────────────────────────────────────────

function htmlToText(html) {
  const $ = cheerio.load(html);

  // Insert structural markers to match browser innerText behavior:
  // - tabs between table cells
  // - newlines between table rows and at <br> tags
  $('td, th').each(function () {
    $(this).append('\t');
  });
  $('tr').each(function () {
    $(this).append('\n');
  });
  $('br').replaceWith('\n');
  $('div, p').each(function () {
    $(this).append('\n');
  });

  return $.root().text();
}

// ─── SESSION MANAGEMENT ─────────────────────────────────────────────────────

async function saveSession(cookies, email) {
  await redis.set(`session:${email}`, JSON.stringify(cookies), 'EX', 86400);
  console.log('Session saved in Redis for:', email);
}

// ─── DATA SCRAPING ───────────────────────────────────────────────────────────

async function scrapeAll(cookies) {
  const cookieStr = cookiesToString(cookies);
  console.log('Starting data scrape...');

  // 1. Fetch My_Attendance page → student info + attendance + marks
  const attHtml = await fetchPage(cookieStr, 'My_Attendance');
  if (!attHtml) throw new Error('Session expired or attendance page not found');
  const attText = htmlToText(attHtml);

  const student = parseStudent(attText);
  const batch = parseInt(student.batch) || 1;
  console.log('Student:', student.name, '| Batch:', batch);

  // 2. Fetch Unified Timetable
  const batchSuffix = batch === 1 ? 'Batch_1' : 'batch_' + batch;
  const unifiedPage = 'Unified_Time_Table_2025_' + batchSuffix;
  const unifiedHtml = await fetchPage(cookieStr, unifiedPage);
  const unifiedTTText = unifiedHtml ? htmlToText(unifiedHtml) : '';

  // 3. Fetch My Timetable (for lab/practical slots + faculty names)
  const myTTHtml = await fetchPage(cookieStr, 'My_Time_Table_2023_24');
  const myTTText = myTTHtml ? htmlToText(myTTHtml) : '';

  // 4. Parse attendance and marks
  let attendance = parseAttendance(attText);
  let marks = parseMarks(attText);

  // Normalize marks codes to match attendance codes
  const attCodeMap = {};
  for (const c of attendance) {
    attCodeMap[c.code] = c.code;
    attCodeMap[c.code.replace(/[A-Z]$/, '')] = c.code;
  }
  marks = marks.map(m => ({
    ...m,
    code: attCodeMap[m.code] || m.code,
  }));

  // 5. Build timetable
  const slotMap = parseSlotMap(attText, myTTText);
  const timetable = buildTimetable(unifiedTTText, slotMap);

  console.log('Courses:', attendance.length, '| Slots:', Object.keys(slotMap).length, '| TT:', timetable.length);

  // 6. Fetch planners (both ODD and EVEN for full academic year)
  const _now = new Date(), _yr = _now.getFullYear(), _mo = _now.getMonth();
  const _ayStart = _mo >= 6 ? _yr : _yr - 1;
  const _ayEnd   = String(_ayStart + 1).slice(-2);
  const _planners = [
    `Academic_Planner_${_ayStart}_${_ayEnd}_ODD`,
    `Academic_Planner_${_ayStart}_${_ayEnd}_EVEN`,
  ];

  let plannerData = {};
  for (const plannerPage of _planners) {
    try {
      console.log('Fetching planner:', plannerPage);
      const plannerHtml = await fetchPage(cookieStr, plannerPage);
      if (!plannerHtml) { console.warn('Planner page not found:', plannerPage); continue; }
      const plannerText = htmlToText(plannerHtml);
      const entries = parsePlanner(plannerText);

      // Sanity check: verify planner is serving correct semester data
      if (Object.keys(entries).length > 0) {
        const hasOddMonths  = Object.keys(entries).some(k => parseInt(k.split('-')[1]) >= 7);
        const hasEvenMonths = Object.keys(entries).some(k => parseInt(k.split('-')[1]) <= 6);
        if (plannerPage.includes('_ODD') && !hasOddMonths) {
          console.warn('ODD planner has only EVEN-semester entries — skipping:', plannerPage);
          continue;
        }
        if (plannerPage.includes('_EVEN') && !hasEvenMonths) {
          console.warn('EVEN planner has only ODD-semester entries — skipping:', plannerPage);
          continue;
        }
      }

      Object.assign(plannerData, entries);
      console.log('Planner', plannerPage, 'entries:', Object.keys(entries).length, '| Total:', Object.keys(plannerData).length);
    } catch(e) {
      console.warn('Planner scrape failed (non-fatal):', plannerPage, e.message);
    }
  }

  if (Object.keys(plannerData).length === 0) plannerData = null;

  if (plannerData) {
    const keys = Object.keys(plannerData).sort();
    const byMonth = {};
    keys.forEach(k => { const ym = k.slice(0,7); byMonth[ym] = (byMonth[ym]||0)+1; });
    console.log('plannerData month summary:', Object.entries(byMonth).map(([m,c])=>`${m}:${c}`).join(', '));
  }

  return { student, attendance, marks, timetable, plannerData };
}

// ─── BACKGROUND REFRESH ─────────────────────────────────────────────────────

async function backgroundRefresh(email) {
  const lockKey = `refresh_lock:${email}`;
  const locked = await redis.set(lockKey, '1', 'EX', 180, 'NX').catch(() => null);
  if (!locked) { console.log('Background refresh already running for:', email); return; }
  try {
    const saved = await redis.get(`session:${email}`);
    if (!saved) { console.log('No Redis session for background refresh:', email); return; }
    const cookies = JSON.parse(saved);
    const cookieStr = cookiesToString(cookies);

    // Test if session is still valid
    const testHtml = await fetchPage(cookieStr, 'My_Attendance');
    if (!testHtml) {
      console.log('Background refresh: session expired for', email);
      return;
    }

    const data = await scrapeAll(cookies);
    await redis.set(`data:v6:${email}`, JSON.stringify({ ...data, refreshedAt: Date.now() }), 'EX', 3600).catch(() => {});
    setStudentCache(email, data).catch(() => {});
    console.log('Background refresh complete for:', email);
  } catch(e) {
    console.warn('Background refresh failed:', e.message);
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

// ─── MAIN ENTRY POINTS ──────────────────────────────────────────────────────

async function startLogin(email, password, useSession, forceRefresh = false) {
  if (useSession) {
    // Fast path: serve cached data from Redis
    if (!forceRefresh) {
      try {
        const cachedData = await redis.get(`data:v6:${email}`);
        if (cachedData) {
          console.log('Serving cached data for:', email);
          const parsed = JSON.parse(cachedData);
          const age = Date.now() - (parsed.refreshedAt || 0);
          if (age > 10 * 60 * 1000) backgroundRefresh(email).catch(() => {});
          return { needsCaptcha: false, data: parsed };
        }
        // Postgres fallback (24hr TTL)
        const pgData = await getStudentCache(email);
        if (pgData) {
          console.log('Serving Postgres-cached data for:', email);
          redis.set(`data:v6:${email}`, JSON.stringify(pgData), 'EX', 3600).catch(() => {});
          backgroundRefresh(email).catch(() => {});
          return { needsCaptcha: false, data: pgData };
        }
      } catch(e) {
        console.warn('Redis data cache read failed (non-fatal):', e.message);
      }
    } else {
      console.log('Force refresh: bypassing Redis cache for:', email);
    }

    // Try restoring session from Redis cookies
    console.log('Trying Redis session for:', email);
    const saved = await redis.get(`session:${email}`);

    if (saved) {
      try {
        const cookies = JSON.parse(saved);
        const cookieStr = cookiesToString(cookies);

        // Test if session is still valid by fetching a page
        const testHtml = await fetchPage(cookieStr, 'My_Attendance');
        if (testHtml) {
          console.log('Session restored from Redis!');
          try {
            const data = await scrapeAll(cookies);
            try { await redis.set(`data:v6:${email}`, JSON.stringify(data), 'EX', 3600); } catch(e) {}
            setStudentCache(email, data).catch(() => {});
            return { needsCaptcha: false, data };
          } catch (scrapeErr) {
            console.warn('scrapeAll failed, falling back to cache:', scrapeErr.message);
            const cachedRaw = await redis.get(`data:v6:${email}`).catch(() => null);
            if (cachedRaw) return { needsCaptcha: false, data: JSON.parse(cachedRaw), stale: true };
            const pgData = await getStudentCache(email).catch(() => null);
            if (pgData) return { needsCaptcha: false, data: pgData, stale: true };
            throw Object.assign(scrapeErr, { isScrapeFailure: true });
          }
        }
        console.log('Redis session expired');
      } catch (e) {
        if (e.isScrapeFailure) throw e;
        console.warn('Session restore failed:', e.message);
      }
    } else {
      console.log('No session in Redis');
    }

    // No valid session — need password for fresh login
    if (!password) {
      throw new Error('Session expired. Please log in again.');
    }
  }

  // Full login via HTTP
  console.log('Performing full HTTP login for:', email);
  const cookies = await httpLogin(email, password);
  await saveSession(cookies, email);

  const data = await scrapeAll(cookies);
  try { await redis.set(`data:v6:${email}`, JSON.stringify(data), 'EX', 3600); } catch(e) {}
  setStudentCache(email, data).catch(() => {});
  return { needsCaptcha: false, data };
}

async function solveCaptcha(_sessionId, _solution) {
  throw new Error('CAPTCHA solving is not available. Please wait 15-30 minutes and try logging in again.');
}

async function logoutUser(email) {
  await redis.del(`session:${email}`);
  await redis.del(`data:v6:${email}`);
  console.log('Session deleted from Redis:', email);
}

// ─── PARSERS (unchanged from original) ───────────────────────────────────────

function parseStudent(text) {
  function g(re) { const m = text.match(re); return m && m[1] ? m[1].trim() : ''; }
  return {
    regNo:      g(/Registration Number:\s*([A-Z0-9]+)/i),
    name:       g(/Name:\s*([^\n]+)/i),
    program:    g(/Program:\s*([^\n]+)/i),
    department: g(/Department:\s*([^\n]+)/i),
    semester:   g(/Semester:\s*(\d+)/i),
    batch:      g(/Batch\s*:\s*(\d+)/i),
  };
}

function parseAttendance(text) {
  const courses = [];
  const section = text.split(/Internal Marks/i)[0] || text;
  const blocks  = section.split(/\n(?=\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3}\n)/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const cm = lines[0].match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})$/);
    if (!cm) continue;
    const rest = lines.slice(1).join(' ');
    const nm   = rest.match(/(\d+)\s+(\d+)\s+([\d.]+)\s*$/);
    if (!nm) continue;
    const type  = rest.includes('Practical') ? 'Practical' : 'Theory';
    const nameM = rest.match(/(?:Regular|Elective|Mandatory)\s+(.+?)\s+(?:Theory|Practical)/);
    courses.push({
      code:       cm[1],
      name:       nameM ? nameM[1].trim() : '',
      type,
      conducted:  parseInt(nm[1]),
      absent:     parseInt(nm[2]),
      percentage: parseFloat(nm[3]),
    });
  }
  return courses;
}

function parseMarks(text) {
  const marks = [];
  const si = text.search(/Internal Marks/i);
  if (si === -1) return marks;
  const blocks = text.substring(si).split(/\n(?=\d{2}[A-Z]{2,7}\d{3,4}[A-Z\d]{0,4}\s+(?:Theory|Practical|Lab|Audit|Project))/);

  for (const block of blocks) {
    const cm = block.match(/^(\d{2}[A-Z]{2,7}\d{3,4}[A-Z\d]{0,4})\s+(Theory|Practical|Lab|Audit|Project)/);
    if (!cm) continue;
    const tests = [];
    const re = /(F[TLJP]-[IVX]+)\/([ \d.]+)\s*\n?\s*([\d.]+|Abs)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      tests.push({ name: m[1], maxMarks: parseFloat(m[2]), scored: m[3] === 'Abs' ? null : parseFloat(m[3]) });
    }
    marks.push({ code: cm[1], type: cm[2], tests });
  }
  return marks;
}

function parseSlotMap(attText, myTTText) {
  const slotMap = {};

  // STEP 1: parse theory slots from attendance page
  const section = attText.split(/Internal Marks/i)[0] || attText;
  const blocks  = section.split(/\n(?=\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3}\n)/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const codeLine = lines[0].match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})$/);
    if (!codeLine) continue;
    const code = codeLine[1];
    const rest = lines.slice(1).join(' ');
    const type = rest.includes('Practical') ? 'Practical' : 'Theory';
    const nameM = rest.match(/(?:Regular|Elective|Mandatory)\s+(.+?)\s+(?:Theory|Practical)/);
    const name  = nameM ? nameM[1].trim() : '';
    const roomAttM = rest.match(/\(\d+\)\s+[A-Z][A-Z0-9-]*\s+(\S+)\s+\d+\s+\d+/);
    const roomAtt  = roomAttM ? roomAttM[1] : '';

    if (type === 'Theory') {
      const slotM = rest.match(/\(\d+\)\s+([A-Z][A-Z0-9-]*)\s+/);
      if (!slotM) continue;
      const slots = slotM[1].trim().split('-').map(s => s.trim()).filter(Boolean);
      for (const slot of slots) {
        slotMap[slot] = { code, name, type, room: roomAtt };
        console.log('Theory slot:', slot, '->', code, name);
      }
    } else {
      slotMap['__prac__' + code] = { code, name, type, room: roomAtt };
    }
  }

  // STEP 2: parse faculty names + P## slots from My_Time_Table page
  if (myTTText) {
    console.log('Parsing My_Time_Table for lab slots...');
    const ttLines = myTTText.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of ttLines) {
      const cols = line.split('\t').map(c => c.trim());

      const codeStr = (cols.length >= 9 && cols[1]) ? cols[1] : '';
      const codeM   = codeStr.match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})$/)
                   || line.match(/(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})/);
      if (!codeM) continue;
      const code = codeM[1];

      const facultyRaw = cols.length >= 8 ? cols[7] : '';
      const faculty = facultyRaw.replace(/\s*\(\d+\)\s*$/, '').trim();

      const slotRaw = cols.length >= 9 ? cols[8] : '';
      const roomCol  = cols.length >= 10 ? cols[9] : '';

      if (/^[A-Z]$/.test(slotRaw) && slotMap[slotRaw] && slotMap[slotRaw].code === code) {
        if (faculty) slotMap[slotRaw].faculty = faculty;
      }

      const pracKey = '__prac__' + code;
      if (!slotMap[pracKey]) continue;

      if (faculty) slotMap[pracKey].faculty = faculty;

      const slotM = line.match(/\b(P\d+)(?:\s*-\s*(P\d+))?\b/);
      if (!slotM) continue;

      const startSlot = parseInt(slotM[1].replace('P', ''));
      const endSlot   = slotM[2] ? parseInt(slotM[2].replace('P', '')) : startSlot;

      for (let n = startSlot; n <= endSlot; n++) {
        slotMap['P' + n] = { ...slotMap[pracKey] };
        if (roomCol) slotMap['P' + n].room = roomCol;
        console.log('Lab slot: P' + n, '->', code, slotMap[pracKey].name);
      }
    }

    Object.keys(slotMap).forEach(k => {
      if (k.startsWith('__prac__')) delete slotMap[k];
    });
  }

  console.log('SlotMap keys:', Object.keys(slotMap));
  return slotMap;
}

const FALLBACK_TIMES = [
  '08:00-08:50','08:50-09:40','09:45-10:35','10:40-11:30',
  '11:35-12:25','12:30-01:20','01:25-02:15','02:20-03:10',
  '03:10-04:00','04:00-04:50','04:50-05:30','05:30-06:10'
];

function parseUnifiedTimetable(text) {
  const beforeDay1 = text.split(/Day\s*1/i)[0] || '';
  const timeMatches = beforeDay1.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g) || [];
  const times = timeMatches.length >= 12
    ? timeMatches.slice(0, 12).map(t => t.replace(/\s+/g, ''))
    : FALLBACK_TIMES;

  const dayRows = {};
  const dayPattern = /Day\s*(\d)\s*([\s\S]*?)(?=Day\s*\d|Lab Slots|$)/gi;
  let match;

  while ((match = dayPattern.exec(text)) !== null) {
    const dayNum  = match[1];
    const dayKey  = 'Day ' + dayNum;
    const rawBody = match[2];

    const slotPattern = /([A-Z][A-Z0-9]*)(?:\s*\/\s*X)?/g;
    const slots = [];
    let sm;

    while ((sm = slotPattern.exec(rawBody)) !== null) {
      const s = sm[1].trim();
      if (['FROM','TO','LAB','SLOTS','THEORY','HOUR','DAY','ORDER'].includes(s)) continue;
      if (/^[A-Z]$/.test(s) || /^P\d+$/.test(s) || /^L\d+$/.test(s)) {
        slots.push(s);
      }
    }

    if (slots.length >= 6) {
      dayRows[dayKey] = slots;
      console.log('Day', dayNum, 'slots:', slots);
    }
  }

  return { times, dayRows };
}

function buildTimetable(unifiedText, slotMap) {
  const { times, dayRows } = parseUnifiedTimetable(unifiedText);
  const result = [];

  Object.keys(dayRows).forEach(day => {
    dayRows[day].forEach((slot, i) => {
      const course = slotMap[slot] || null;
      result.push({
        day,
        period: i + 1,
        time:   times[i] || ('Period ' + (i + 1)),
        slot,
        code:    course ? course.code    : null,
        name:    course ? course.name    : null,
        type:    course ? course.type    : null,
        room:    course ? course.room    : null,
        faculty: course ? course.faculty : null,
      });
    });
  });

  return result;
}

function parsePlanner(text) {
  const result = {};
  const MONTH_ABBR = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let headerIdx = -1;
  const months = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split('\t').map(c => c.trim());
    if (cells.some(c => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*'/i.test(c))) {
      headerIdx = i;
      console.log('Planner header row (idx=' + i + '):', JSON.stringify(cells));
      cells.forEach((c, idx) => {
        const m = c.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*'(\d{2})/i);
        if (m) {
          months.push({
            month:      MONTH_ABBR[m[1].toLowerCase()],
            year:       2000 + parseInt(m[2]),
            groupStart: idx - 2,
          });
        }
      });
      console.log('Planner months found:', months.map(m => `${m.month+1}/${m.year} groupStart=${m.groupStart}`));
      break;
    }
  }

  if (months.length === 0) {
    console.log('Planner: header row not found. First 10 lines:', lines.slice(0, 10));
    return result;
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split('\t').map(c => c.trim());

    for (const { month, year, groupStart } of months) {
      if (groupStart < 0) continue;
      const dateStr = cells[groupStart]     || '';
      const event   = cells[groupStart + 2] || '';
      const doStr   = cells[groupStart + 3] || '';

      const dayNum = parseInt(dateStr);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

      const dow = new Date(year, month, dayNum).getDay();
      if (dow === 0 || dow === 6) continue;

      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOrder = parseInt(doStr);

      result[key] = {
        order: (!isNaN(dayOrder) && dayOrder >= 1 && dayOrder <= 5) ? dayOrder : null,
        event: event || null,
      };
    }
  }

  console.log('Planner entries parsed:', Object.keys(result).length);
  return result;
}

module.exports = { startLogin, solveCaptcha, logoutUser, trackUser };
