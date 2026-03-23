// lib/planner.js — server-side day order and planner info utilities
const ANCHOR_DATE = new Date(2026, 2, 16); // March 16, 2026
const ANCHOR_ORDER = 4;

function getDayOrder(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  if (d.getDay() === 0 || d.getDay() === 6) return null;
  const a = new Date(ANCHOR_DATE); a.setHours(0,0,0,0);
  let diff = 0, step = d >= a ? 1 : -1, cur = new Date(a);
  while (cur.toDateString() !== d.toDateString()) {
    cur.setDate(cur.getDate() + step);
    if (cur.getDay() !== 0 && cur.getDay() !== 6) diff += step;
  }
  return ((ANCHOR_ORDER - 1 + diff) % 5 + 5) % 5 + 1;
}

function getPlannerInfo(date, plannerData) {
  if (!date) return null;
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return { order: null, event: 'Weekend', _weekend: true };
  if (!plannerData) return { order: getDayOrder(date), event: null };
  const key = date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
  const info = plannerData[key];
  if (!info) return { order: getDayOrder(date), event: null };
  if (info.holiday !== undefined && info.event === undefined)
    return { order: info.order, event: info.holiday || null };
  return info;
}

module.exports = { getDayOrder, getPlannerInfo };
