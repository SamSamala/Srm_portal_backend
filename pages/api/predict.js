// pages/api/predict.js — server-side attendance predictor using cached student data
import db from '../../lib/db';
import { getPlannerInfo } from '../../lib/planner';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, from, to } = req.body || {};
  if (!email || !from || !to) return res.status(400).json({ error: 'email, from, to required' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });

  try {
    const studentData = await db.getStudentCache(email);
    if (!studentData) return res.status(404).json({ error: 'No data cached for this user. Please log in first.' });

    const att = studentData.attendance || [];
    const tt = Array.isArray(studentData.timetable) ? studentData.timetable : [];
    const plannerData = studentData.plannerData || null;

    const ttByDay = { 'Day 1':[], 'Day 2':[], 'Day 3':[], 'Day 4':[], 'Day 5':[] };
    tt.forEach(p => { if (ttByDay[p.day]) ttByDay[p.day].push(p); });

    // Days from today up to (but not including) 'from' are treated as attended
    const today = new Date(); today.setHours(0,0,0,0);
    const fromDate = new Date(from); fromDate.setHours(0,0,0,0);
    const gapByCode = {};
    if (fromDate > today) {
      const gapCur = new Date(today);
      while (gapCur < fromDate) {
        const info = getPlannerInfo(new Date(gapCur), plannerData);
        if (info && info.order && !info._weekend && !(info.event || '').toLowerCase().includes('holiday')) {
          (ttByDay['Day ' + info.order] || []).forEach(p => {
            gapByCode[p.code] = (gapByCode[p.code] || 0) + 1;
          });
        }
        gapCur.setDate(gapCur.getDate() + 1);
      }
    }

    // Days in the from→to range are treated as absent
    const absentDays = [];
    const end = new Date(to); end.setHours(0,0,0,0);
    const cur = new Date(fromDate);
    while (cur <= end) {
      const info = getPlannerInfo(new Date(cur), plannerData);
      if (info && info.order && !info._weekend) {
        if (!(info.event || '').toLowerCase().includes('holiday')) {
          absentDays.push({ date: cur.toISOString().split('T')[0], order: info.order });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    const absentByCode = {}, conductedByCode = {};
    absentDays.forEach(({ order }) => {
      (ttByDay['Day ' + order] || []).forEach(p => {
        absentByCode[p.code] = (absentByCode[p.code] || 0) + 1;
        conductedByCode[p.code] = (conductedByCode[p.code] || 0) + 1;
      });
    });

    const hasTT = tt.length > 0;
    const results = att.map(c => {
      const gap  = hasTT ? (gapByCode[c.code] || 0) : Object.keys(gapByCode).length === 0 ? 0 : absentDays.length;
      const newA = hasTT ? (absentByCode[c.code] || 0) : absentDays.length;
      const newC = hasTT ? (conductedByCode[c.code] || 0) : absentDays.length;
      // pC = existing + gap days (attended) + absent range (conducted but absent)
      const pC = (parseInt(c.conducted) || 0) + gap + newC;
      const pA = (parseInt(c.absent) || 0) + newA;
      const pPct = pC === 0 ? 0 : (pC - pA) / pC * 100;
      return { ...c, pPct: Math.round(pPct * 10) / 10, newA };
    });

    const newTotC = results.reduce((s, c) => s + (parseInt(c.conducted) || 0) + (gapByCode[c.code] || 0) + (conductedByCode[c.code] || 0), 0);
    const newTotA = results.reduce((s, c) => s + (parseInt(c.absent) || 0) + (c.newA || 0), 0);
    const predOverall = newTotC === 0 ? 0 : Math.round((newTotC - newTotA) / newTotC * 100);
    const atRisk = results.filter(c => c.pPct < 75).length;

    return res.status(200).json({ days: absentDays.length, results, predOverall, atRisk });
  } catch (e) {
    console.error('[predict]', e.message);
    return res.status(500).json({ error: 'Prediction failed' });
  }
}
