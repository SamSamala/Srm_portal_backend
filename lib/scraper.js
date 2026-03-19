const redis = require('./redis');
const { chromium } = require('playwright');

const PORTAL_URL = 'https://academia.srmist.edu.in/portal/academia-academic-services/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

const sessions = {};

function makeId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function saveSession(context, email) {
  const state = await context.storageState();
  await redis.set(`session:${email}`, JSON.stringify(state), 'EX', 86400);
  console.log('Session saved in Redis for:', email);
}

async function loginWithBrowser(email, password) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to portal...');
    await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    let frame = await getLoginFrame(page);
    await frame.waitForSelector('#login_id, input[type="email"]', { timeout: 15000 });
    await frame.fill('#login_id, input[type="email"]', email);
    await frame.waitForTimeout(500);
    await frame.click('#nextbtn');
    await page.waitForTimeout(2000);
    frame = await getLoginFrame(page);
    await frame.waitForSelector('#password, input[type="password"]', { timeout: 15000 });
    await frame.fill('#password, input[type="password"]', password);
    await frame.waitForTimeout(500);
    await frame.click('#nextbtn');
    await page.waitForTimeout(4000);
    await handleIntermediatePages(page);
    console.log('Post-login URL:', page.url());

    const currentUrl = page.url();
    if (currentUrl.includes('signin') || currentUrl.includes('accounts')) {
      try {
        const errFrame = await getLoginFrame(page);
        const pwdVisible = await errFrame.$('#password, input[type="password"]').catch(() => null);
        if (pwdVisible) {
          const errEl = await errFrame.$('.disp-err, [class*="error" i]').catch(() => null);
          const errText = errEl ? await errEl.textContent().catch(() => '') : '';
          await redis.del(`session:${email}`);
          await browser.close();
          throw new Error(errText.trim() || 'Invalid email or password.');
        }
        const captchaEl = await errFrame.$('input[id*="captcha" i], #captchaText').catch(() => null);
        if (captchaEl) {
          const frameEl = await page.$('iframe');
          let b64;
          try { b64 = await frameEl.screenshot({ type: 'png' }); } catch(e) { b64 = await page.screenshot({ type: 'png' }); }
          const sessionId = makeId();
          sessions[sessionId] = { browser, context, page, email };
          setTimeout(() => { if(sessions[sessionId]) sessions[sessionId].browser.close().catch(() => {}); delete sessions[sessionId]; }, 300000);
          return { needsCaptcha: true, sessionId, captchaImage: 'data:image/png;base64,' + b64.toString('base64') };
        }
      } catch(e) { if (e.message !== 'getLoginFrame error') throw e; }
      await browser.close();
      throw new Error('Login failed. Please check your credentials.');
    }

    console.log('Login OK. Scraping data...');
    let data;
    try {
      data = await scrapeAll(page);
    } catch(scrapeErr) {
      await browser.close();
      throw new Error('Logged in but failed to load data: ' + scrapeErr.message);
    }

    await saveSession(context, email);
    await browser.close();
    try { await redis.set(`data:v3:${email}`, JSON.stringify(data), 'EX', 600); } catch(e) {}
    return { needsCaptcha: false, data };

  } catch(err) { await browser.close(); throw err; }
}

async function getLoginFrame(page) {
  await page.waitForSelector('iframe', { timeout: 15000 });
  await page.waitForTimeout(2000);
  const frames = page.frames();
  for (const f of frames) {
    if (f.url().includes('signin') || f.url().includes('accounts')) return f;
  }
  const iframeEl = await page.$('iframe');
  return await iframeEl.contentFrame();
}

function isIntermediatePage(url) {
  return url.includes('block-sessions') || url.includes('preannouncement') ||
    url.includes('announcement') || url.includes('signin-block') || url.includes('sessions-reminder');
}

async function handleIntermediatePages(page) {
  let attempts = 0;
  while (isIntermediatePage(page.url()) && attempts < 6) {
    attempts++;
    console.log('Intermediate page ' + attempts + ':', page.url());
    const clicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a, button'));
      const u = all.find(l => l.innerText && /understand/i.test(l.innerText));
      if (u) { u.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return u.innerText.trim(); }
      const t = all.find(l => l.innerText && /terminate/i.test(l.innerText));
      if (t) { t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return t.innerText.trim(); }
      return null;
    });
    console.log('Clicked:', clicked);
    await page.waitForTimeout(3000);
    console.log('URL now:', page.url());
  }
}

async function navigateToPage(page, pageName) {
  console.log('Navigating to page:', pageName);
  const url = 'https://academia.srmist.edu.in/#Page:' + pageName;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction((pageName) => {
    const text = document.body.innerText || '';
    if (pageName.includes('Unified_Time_Table')) return /Day\s*\d+/i.test(text) && text.length > 800;
    if (pageName === 'My_Time_Table_2023_24') return text.includes('Course Code') && text.length > 800;
    if (pageName === 'My_Attendance') return text.includes('Registration Number') && text.length > 800;
    if (pageName.includes('Academic_Planner')) return /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(text) && !text.includes('My Time Table AY');
    return text.length > 1000;
  }, pageName, { timeout: pageName.includes('Academic_Planner') ? 35000 : 20000 });

  const text = await page.evaluate(() => document.body.innerText);
  console.log(`Page "${pageName}" READY len=${text.length}`);
  return text;
}

async function scrapeAll(page) {
  const cur = page.url();
  if (!cur.includes('academia.srmist.edu.in/portal') || cur.includes('redirectFromLogin') || cur.includes('accounts')) {
    await page.goto('https://academia.srmist.edu.in/portal/academia-academic-services/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
  }

  console.log('Starting page scrape...');

  const attText  = await navigateToPage(page, 'My_Attendance');
  const student  = parseStudent(attText);
  const batch    = parseInt(student.batch) || 1;
  console.log('Student:', student.name, '| Batch:', batch);

  const batchSuffix   = batch === 1 ? 'Batch_1' : 'batch_' + batch;
  const unifiedPage   = 'Unified_Time_Table_2025_' + batchSuffix;
  const unifiedTTText = await navigateToPage(page, unifiedPage);

  // ── DEBUG: log My_Time_Table to see P## slot format ──
  const myTTText = await navigateToPage(page, 'My_Time_Table_2023_24');
  console.log('=== MY_TT RAW ===');
  console.log(myTTText);
  console.log('=== MY_TT END ===');
  // ─────────────────────────────────────────────────────

  const attendance = parseAttendance(attText);
  const marks      = parseMarks(attText);
  const slotMap    = parseSlotMap(attText, myTTText);
  const timetable  = buildTimetable(unifiedTTText, slotMap);

  console.log('Courses:', attendance.length, '| Slots:', Object.keys(slotMap).length, '| TT:', timetable.length);

  const plannerPage = new Date().getMonth() >= 6
    ? 'Academic_Planner_2025_26_ODD'
    : 'Academic_Planner_2025_26_EVEN';

  let plannerData = null;
  try {
    console.log('Fetching planner:', plannerPage);
    const plannerText = await navigateToPage(page, plannerPage);
    console.log('=== PLANNER RAW (first 800) ===\n', plannerText.slice(0, 800));
    plannerData = parsePlanner(plannerText);
  } catch(e) {
    console.warn('Planner scrape failed (non-fatal):', e.message);
  }

  return { student, attendance, marks, timetable, plannerData };
}

async function startLogin(email, password, useSession) {
  if (useSession) {
    // Fast path: serve cached data from Redis (avoids launching Playwright)
    try {
      const cachedData = await redis.get(`data:v3:${email}`);
      if (cachedData) {
        console.log('Serving cached data for:', email);
        return { needsCaptcha: false, data: JSON.parse(cachedData) };
      }
    } catch(e) {
      console.warn('Redis data cache read failed (non-fatal):', e.message);
    }

    console.log('Trying Redis session for:', email);
    const saved = await redis.get(`session:${email}`);

    if (!saved) {
      console.log('No session in Redis');
      return loginWithBrowser(email, password);
    }

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
    });
    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: 720 },
      storageState: JSON.parse(saved)
    });
    const page = await context.newPage();

    try {
      await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const url = page.url();
      if (!url.includes('signin') && !url.includes('accounts')) {
        console.log('Session restored from Redis!');
        const data = await scrapeAll(page);
        await browser.close();
        try { await redis.set(`data:v3:${email}`, JSON.stringify(data), 'EX', 600); } catch(e) {}
        return { needsCaptcha: false, data };
      }
      console.log('Redis session expired');
      await browser.close();
      return loginWithBrowser(email, password);
    } catch (e) {
      await browser.close();
      throw e;
    }
  }

  return loginWithBrowser(email, password);
}

async function solveCaptcha(sessionId, solution) {
  const session = sessions[sessionId];
  if (!session) throw new Error('Session expired.');
  const { browser, page, email } = session;
  try {
    const frame = await getLoginFrame(page);
    await frame.fill('input[id*="captcha" i], #captchaText', solution);
    await frame.click('#nextbtn');
    await page.waitForTimeout(4000);
    await handleIntermediatePages(page);
    const currentUrl = page.url();
    if (currentUrl.includes('signin') || currentUrl.includes('accounts')) {
      const frameEl = await page.$('iframe');
      const b64 = await frameEl.screenshot({ type: 'png' }).catch(() => page.screenshot({ type: 'png' }));
      return { needsCaptcha: true, sessionId, captchaImage: 'data:image/png;base64,' + b64.toString('base64'), error: 'Wrong CAPTCHA.' };
    }
    let data;
    try { data = await scrapeAll(page); }
    catch(e) { await browser.close(); delete sessions[sessionId]; throw new Error('CAPTCHA OK but data load failed: ' + e.message); }
    await browser.close();
    delete sessions[sessionId];
    await saveSession(page.context(), email);
    try { await redis.set(`data:v3:${email}`, JSON.stringify(data), 'EX', 600); } catch(e) {}
    return { needsCaptcha: false, data };
  } catch(err) { await browser.close(); delete sessions[sessionId]; throw err; }
}

async function logoutUser(email) {
  await redis.del(`session:${email}`);
  await redis.del(`data:v3:${email}`);
  console.log('Session deleted from Redis:', email);
}

// ─── PARSERS ──────────────────────────────────────────────────────────────────

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
  const blocks = text.substring(si).split(/\n(?=\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3}\s+(?:Theory|Practical))/);

  for (const block of blocks) {
    const cm = block.match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})\s+(Theory|Practical)/);
    if (!cm) continue;
    const tests = [];
    const re = /(F[TLJ]-[IVX]+)\/([ \d.]+)\s*\n?\s*([\d.]+|Abs)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      tests.push({ name: m[1], maxMarks: parseFloat(m[2]), scored: m[3] === 'Abs' ? null : parseFloat(m[3]) });
    }
    marks.push({ code: cm[1], type: cm[2], tests });
  }
  return marks;
}

// Now accepts both attText and myTTText
function parseSlotMap(attText, myTTText) {
  const slotMap = {};

  // ── STEP 1: parse theory slots from attendance page ──
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
      // Store practical temporarily by code — we'll assign P## slots from myTTText
      slotMap['__prac__' + code] = { code, name, type, room: roomAtt };
    }
  }

  // ── STEP 2: parse faculty names + P## slots from My_Time_Table page ──
  // Tab-separated columns: S.No | Code | Title | Credit | Type | Category | CourseType | Faculty(ID) | Slot | Room | Year
  if (myTTText) {
    console.log('Parsing My_Time_Table for lab slots...');
    const ttLines = myTTText.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of ttLines) {
      const cols = line.split('\t').map(c => c.trim());

      // Use tab-parsed code (col 1) when available, fall back to regex
      const codeStr = (cols.length >= 9 && cols[1]) ? cols[1] : '';
      const codeM   = codeStr.match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})$/)
                   || line.match(/(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})/);
      if (!codeM) continue;
      const code = codeM[1];

      // Extract faculty name (remove employee ID in parentheses)
      const facultyRaw = cols.length >= 8 ? cols[7] : '';
      const faculty = facultyRaw.replace(/\s*\(\d+\)\s*$/, '').trim();

      const slotRaw = cols.length >= 9 ? cols[8] : '';
      const roomCol  = cols.length >= 10 ? cols[9] : '';

      // Theory slot: single letter (e.g. "B", "C")
      if (/^[A-Z]$/.test(slotRaw) && slotMap[slotRaw] && slotMap[slotRaw].code === code) {
        if (faculty) slotMap[slotRaw].faculty = faculty;
      }

      // Practical / Lab Based Theory: P## range
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

    // Clean up temp practical keys
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

  // Find the header row: contains "Dt" and month abbreviations like "Jan '26"
  let headerIdx = -1;
  const months = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split('\t').map(c => c.trim());
    if (cells.some(c => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*'/i.test(c))) {
      headerIdx = i;
      cells.forEach((c, idx) => {
        const m = c.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*'(\d{2})/i);
        if (m) {
          months.push({
            month:      MONTH_ABBR[m[1].toLowerCase()],
            year:       2000 + parseInt(m[2]),
            groupStart: idx - 2,  // Dt is 2 columns before the month name cell
          });
        }
      });
      break;
    }
  }

  if (months.length === 0) {
    console.log('Planner: header row not found');
    return result;
  }

  // Parse data rows after header
  // Each group of 5 columns: [Dt, Day, Event, DayOrder, Separator]
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split('\t').map(c => c.trim());

    for (const { month, year, groupStart } of months) {
      if (groupStart < 0) continue;
      const dateStr = cells[groupStart]     || '';
      const event   = cells[groupStart + 2] || '';
      const doStr   = cells[groupStart + 3] || '';

      const dayNum = parseInt(dateStr);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

      // Skip weekends — they're handled separately in the frontend
      const dow = new Date(year, month, dayNum).getDay();
      if (dow === 0 || dow === 6) continue;

      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOrder = parseInt(doStr);

      // Store ALL weekday entries: working days, holidays, events, and semester breaks
      // event is the raw text (e.g. "New Year's Day - Holiday", "Last Working Day for B.Tech", "Holi")
      // order is null for non-working days (holiday, break, enrollment, etc.)
      result[key] = {
        order: (!isNaN(dayOrder) && dayOrder >= 1 && dayOrder <= 5) ? dayOrder : null,
        event: event || null,
      };
    }
  }

  console.log('Planner entries parsed:', Object.keys(result).length);
  return result;
}

module.exports = { startLogin, solveCaptcha, logoutUser };