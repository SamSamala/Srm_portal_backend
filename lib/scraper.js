const redis = require('./redis');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PORTAL_URL = 'https://academia.srmist.edu.in/portal/academia-academic-services/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

const sessions = {};


function makeId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }



async function saveSession(context, email) {
  const state = await context.storageState();
  await redis.set(`session:${email}`, JSON.stringify(state), 'EX', 86400); // 1 day
  console.log('Session saved in Redis for:', email);
}




// -- Playwright login + API interception -------------------------------------
async function loginWithBrowser(email, password) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Intercept all XHR/fetch requests to find Zoho Creator API calls
  const capturedRequests = [];
  page.on('request', function(req) {
    const url = req.url();
    const method = req.method();
    if (
      (url.includes('zc.csez.com') || url.includes('zohoapis') || url.includes('creatorapp') || url.includes('report') || url.includes('academia.srmist.edu.in/api')) &&
      (method === 'GET' || method === 'POST')
    ) {
      capturedRequests.push({ url, method, headers: req.headers() });
    }
  });

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
      // Check for wrong password
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
        // CAPTCHA
        const captchaEl = await errFrame.$('input[id*="captcha" i], #captchaText').catch(function(){return null;});
        if (captchaEl) {
          const frameEl = await page.$('iframe');
          let b64;
          try { b64 = await frameEl.screenshot({ type: 'png' }); } catch(e) { b64 = await page.screenshot({ type: 'png' }); }
          const sessionId = makeId();
          sessions[sessionId] = { browser, context, page, email };
          setTimeout(function() { if(sessions[sessionId]) sessions[sessionId].browser.close().catch(function(){}); delete sessions[sessionId]; }, 300000);
          return { needsCaptcha: true, sessionId, captchaImage: 'data:image/png;base64,'+b64.toString('base64') };
        }
      } catch(e) { if (e.message !== 'getLoginFrame error') throw e; }
      await browser.close();
      throw new Error('Login failed. Please check your credentials.');
    }

    // Login succeeded - now navigate to pages and intercept the API calls
    console.log('Login OK. Intercepting API calls...');

    // Navigate to attendance page and capture requests
    await navigateToPage(page, 'My_Attendance');
    await page.waitForTimeout(3000);
    await navigateToPage(page, 'My_Time_Table_2023_24');
    await page.waitForTimeout(2000);
    await navigateToPage(page, 'My_Attendance'); // revisit to scrape

    console.log('Captured', capturedRequests.length, 'API requests');
    capturedRequests.forEach(function(r) { console.log(' -', r.method, r.url.substring(0,120)); });

    
    

    // Scrape data using browser (first time)
    console.log('Scraping data with browser...');
    let data;
    try {
      data = await scrapeAll(page);
    } catch(scrapeErr) {
      await browser.close();
      throw new Error('Logged in but failed to load data: ' + scrapeErr.message);
    }
    
    await saveSession(context, email);
    await browser.close();
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
    const clicked = await page.evaluate(function() {
      const all = Array.from(document.querySelectorAll('a, button'));
      const u = all.find(function(l) { return l.innerText && /understand/i.test(l.innerText); });
      if (u) { u.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return u.innerText.trim(); }
      const t = all.find(function(l) { return l.innerText && /terminate/i.test(l.innerText); });
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
  const signals = {
    'My_Attendance': ['Registration Number','Course Code','Hours Conducted','Attn %'],
    'My_Time_Table_2023_24': ['S.No','Course Code','Slot','Room No','Course Title'],
    'default': ['Day 1','Day 2','Hour/Day','FROM','Batch'],
  };
  const sigs = signals[pageName] || signals['default'];

  // Use full navigation - more reliable than hash change
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

// 🔥 WAIT FOR REAL DATA (NOT JUST TEXT)
await page.waitForFunction((pageName) => {
  const text = document.body.innerText || '';

  if (pageName.includes('Unified_Time_Table')) {
  return /Day\s*\d+/i.test(text) && text.length > 800;
}

  if (pageName === 'My_Time_Table_2023_24') {
    return text.includes('Course Code') && text.length > 800;
  }

  if (pageName === 'My_Attendance') {
    return text.includes('Registration Number') && text.length > 800;
  }

  return text.length > 1000;
}, pageName, { timeout: 20000 });

const text = await page.evaluate(() => document.body.innerText);

console.log(`Page "${pageName}" READY len=${text.length}`);

return text;}

async function scrapeAll(page) {
  // Ensure we're on the portal base
  const cur = page.url();
  if (!cur.includes('academia.srmist.edu.in/portal') || cur.includes('redirectFromLogin') || cur.includes('accounts')) {
    await page.goto('https://academia.srmist.edu.in/portal/academia-academic-services/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
  }

  console.log('Starting page scrape...');

  const attText       = await navigateToPage(page, 'My_Attendance');
  const student       = parseStudent(attText);
  const batch         = parseInt(student.batch) || 1;
  console.log('Student:', student.name, '| Batch:', batch);

  const batchSuffix   = batch === 1 ? 'Batch_1' : 'batch_' + batch;
  const unifiedPage   = 'Unified_Time_Table_2025_' + batchSuffix;

  // Save unified URL to apiSession for future direct fetches

  const myTTText      = await navigateToPage(page, 'My_Time_Table_2023_24');
  const unifiedTTText = await navigateToPage(page, unifiedPage);
  console.log("RAW LINE SAMPLE:", lines.slice(0, 20));

  const attendance    = parseAttendance(attText);
  const marks         = parseMarks(attText);
  const slotMap       = parseSlotMap(myTTText);
  const timetable     = buildTimetable(unifiedTTText, slotMap);

  console.log('Courses:', attendance.length, '| Slots:', Object.keys(slotMap).length, '| TT:', timetable.length);
  return { student, attendance, marks, timetable };
}

async function startLogin(email, password, useSession) {
  // Fast path: try direct API fetch if user has a saved session
 

if (useSession) {
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
      return { needsCaptcha: false, data };
    }

    console.log('Redis session expired');
    await browser.close();

  } catch (e) {
    await browser.close();
    throw e;
  }
}
  // Full browser login
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
      const b64 = await frameEl.screenshot({ type: 'png' }).catch(function(){ return page.screenshot({ type: 'png' }); });
      return { needsCaptcha: true, sessionId, captchaImage: 'data:image/png;base64,'+b64.toString('base64'), error: 'Wrong CAPTCHA.' };
    }
    const browserCookies = await page.context().cookies();
    let data;
    try { data = await scrapeAll(page); }
    catch(e) { await browser.close(); delete sessions[sessionId]; throw new Error('CAPTCHA OK but data load failed: ' + e.message); }
    await browser.close(); delete sessions[sessionId];
    await saveSession(page.context(), email);
    return { needsCaptcha: false, data };
  } catch(err) { await browser.close(); delete sessions[sessionId]; throw err; }
}

async function logoutUser(email) {
  await redis.del(`session:${email}`);
  console.log('Session deleted from Redis:', email);
}

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
  const blocks = section.split(/\n(?=\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3}\n)/);
  for (let b = 0; b < blocks.length; b++) {
    const lines = blocks[b].split('\n').map(function(l){return l.trim();}).filter(Boolean);
    if (lines.length < 2) continue;
    const cm = lines[0].match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})$/);
    if (!cm) continue;
    const rest = lines.slice(1).join(' ');
    const nm = rest.match(/(\d+)\s+(\d+)\s+([\d.]+)\s*$/);
    if (!nm) continue;
    const type = rest.includes('Practical') ? 'Practical' : 'Theory';
    const nameM = rest.match(/(?:Regular|Elective|Mandatory)\s+(.+?)\s+(?:Theory|Practical)/);
    courses.push({ code: cm[1], name: nameM ? nameM[1].trim() : '', type, conducted: parseInt(nm[1]), absent: parseInt(nm[2]), percentage: parseFloat(nm[3]) });
  }
  return courses;
}

function parseMarks(text) {
  const marks = [];
  const si = text.search(/Internal Marks/i);
  if (si === -1) return marks;
  const blocks = text.substring(si).split(/\n(?=\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3}\s+(?:Theory|Practical))/);
  for (let b = 0; b < blocks.length; b++) {
    const cm = blocks[b].match(/^(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})\s+(Theory|Practical)/);
    if (!cm) continue;
    const tests = [];
    const re = /(F[TLJ]-[IVX]+)\/([ \d.]+)\s*\n?\s*([\d.]+|Abs)/g;
    let m;
    while ((m = re.exec(blocks[b])) !== null) {
      tests.push({ name: m[1], maxMarks: parseFloat(m[2]), scored: m[3]==='Abs'?null:parseFloat(m[3]) });
    }
    marks.push({ code: cm[1], type: cm[2], tests });
  }
  return marks;
}

function parseSlotMap(text) {
  const slotMap = {};
  const lines = text.split('\n').map(function(l){return l.trim();}).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\d+\s+\d{2}[A-Z]{2,5}\d{3}/.test(line)) continue;
    const cm = line.match(/\d+\s+(\d{2}[A-Z]{2,5}\d{3}[A-Z]{0,3})\s+(.+?)\s+\d+\s+Regular/);
    if (!cm) continue;
    const type = line.includes('Practical') ? 'Practical' : 'Theory';
    const af = line.match(/\(\d+\)\s+([\w-]+)\s+/);
    if (!af) continue;
    const rm = line.match(/\(\d+\)\s+[\w-]+\s+(.+?)\s+AY/);
    const slots = af[1].split('-').map(function(s){return s.trim();}).filter(function(s){return s.length>0;});
    for (let j = 0; j < slots.length; j++) {
      slotMap[slots[j]] = { code: cm[1], name: cm[2].trim(), type, room: rm?rm[1].trim():'' };
    }
  }
  return slotMap;
}

const FALLBACK_TIMES=['08:00-08:50','08:50-09:40','09:45-10:35','10:40-11:30','11:35-12:25','12:30-01:20','01:25-02:15','02:20-03:10','03:10-04:00','04:00-04:50','04:50-05:30','05:30-06:10'];

function parseUnifiedTimetable(text) {
  const lines = text.split('\n').map(function(l){return l.trim();}).filter(Boolean);
  let startTimes=[],endTimes=[];
  for (let i=0;i<lines.length;i++) {
    if (/^Day\s*\d+/i.test(lines[i])) break;
    const full = lines[i].match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g);
    if (full && full.length>=6) return { times:full.map(function(t){return t.replace(/\s+/g,'');}), dayRows:extractDayRows(lines) };
    const bare = lines[i].match(/\d{2}:\d{2}/g);
    if (bare && bare.length>=6) { if(!startTimes.length) startTimes=bare; else if(!endTimes.length) endTimes=bare; }
  }
  const times=(startTimes.length>=6&&endTimes.length>=6)?startTimes.slice(0,12).map(function(s,i){return s+'-'+endTimes[i];}):FALLBACK_TIMES;
  return { times, dayRows:extractDayRows(lines) };
}

function extractDayRows(lines) {
  const dayRows = {};

  for (let i = 0; i < lines.length; i++) {
    const dm = lines[i].match(/^(Day\s*\d+)\s+(.*)/i);
    if (!dm) continue;

    const day = dm[1].replace(/\s+/, ' ');

    // ✅ STEP 1: Split intelligently (tabs OR multiple spaces)
    const rawSlots = dm[2]
      .split(/\t|\s{2,}/)
      .map(s => s.trim())
      .filter(Boolean);

    // ✅ STEP 2: Normalize each slot
    const slots = rawSlots.map(s => {
      return s
        .replace(/\s*\/\s*X/gi, '') // remove /X
        .replace(/\s+/g, '')       // remove inner spaces
        .trim()
        .toUpperCase();
    }).filter(Boolean);

    // ✅ STEP 3: Only accept meaningful rows
    if (slots.length >= 6) {
      dayRows[day] = slots;
    }

    console.log(`Parsed ${day}:`, slots);
  }

  console.log('Final Day rows:', JSON.stringify(dayRows, null, 2));
  return dayRows;
}

function buildTimetable(unifiedText, slotMap) {
  const {times,dayRows}=parseUnifiedTimetable(unifiedText);
  const result=[];
  Object.keys(dayRows).forEach(function(day){
    dayRows[day].forEach(function(slot,i){
      const course=slotMap[slot]||null;
      result.push({day,period:i+1,time:times[i]||('Period '+(i+1)),slot,
        code:course?course.code:null,name:course?course.name:null,
        type:course?course.type:null,room:course?course.room:null});
    });
  });
  return result;
}

module.exports = { startLogin, solveCaptcha, logoutUser };