// Dashboard component — displays attendance, marks, timetable, and planner data
import { useState, useEffect } from 'react';

const MIN_PCT = 75;
const ANCHOR_DATE = new Date(2026, 2, 16);
const ANCHOR_ORDER = 4;
const FULL_MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const OC_DARK  = ['','#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171'];
const OC_LIGHT = ['','#2563eb','#7c3aed','#059669','#d97706','#dc2626'];

export function calcStats(conducted, absent) {
  conducted=parseInt(conducted)||0; absent=parseInt(absent)||0;
  const attended=conducted-absent;
  const pct=conducted===0?0:(attended/conducted)*100;
  const required=pct<MIN_PCT?Math.max(0,Math.ceil((0.75*conducted-attended)/0.25)):0;
  const canSkip=pct>=MIN_PCT?Math.max(0,Math.floor(attended/0.75-conducted)):0;
  const risk=pct<MIN_PCT?'danger':pct<80?'warning':'safe';
  return{attended,pct:Math.round(pct*100)/100,required,canSkip,risk};
}

export function getDayOrder(date) {
  const d=new Date(date);d.setHours(0,0,0,0);
  if(d.getDay()===0||d.getDay()===6)return null;
  const a=new Date(ANCHOR_DATE);a.setHours(0,0,0,0);
  let diff=0,step=d>=a?1:-1,cur=new Date(a);
  while(cur.toDateString()!==d.toDateString()){cur.setDate(cur.getDate()+step);if(cur.getDay()!==0&&cur.getDay()!==6)diff+=step;}
  return((ANCHOR_ORDER-1+diff)%5+5)%5+1;
}

function getMonthDays(year,month){
  const days=[],first=new Date(year,month,1),last=new Date(year,month+1,0);
  const start=(first.getDay()+6)%7;
  for(let i=0;i<start;i++)days.push(null);
  for(let d=1;d<=last.getDate();d++)days.push(new Date(year,month,d));
  return days;
}

function MarksGraph({ tests, dark }) {
  if (!tests || tests.length === 0) return null;
  const W=300, H=120, ML=28, MR=10, MT=10, MB=28;
  const pw=W-ML-MR, ph=H-MT-MB;
  const acc=dark?'#4f8dff':'#2563eb';
  const t3=dark?'rgba(148,163,184,.7)':'rgba(100,116,139,.7)';
  const gridC=dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.07)';
  const totalX=tests.length+1;
  const toX=(xi)=>ML+(xi/totalX)*pw;
  const toY=(pct)=>MT+ph-(Math.min(pct,100)/100)*ph;
  const pts=tests.map((t,i)=>({
    x:toX(i+1),
    y:t.scored!==null&&t.maxMarks>0?toY((t.scored/t.maxMarks)*100):null,
    name:t.name,
  }));
  const firstIdx=pts.findIndex(p=>p.y!==null);
  const ox=toX(0), oy=toY(0);
  let dashD='', solidD='';
  if(firstIdx>=0){
    dashD=`M${ox},${oy} L${pts[firstIdx].x},${pts[firstIdx].y}`;
    solidD=`M${pts[firstIdx].x},${pts[firstIdx].y}`;
    for(let i=firstIdx+1;i<pts.length;i++){
      if(pts[i].y!==null) solidD+=` L${pts[i].x},${pts[i].y}`;
    }
  }
  const totalScored=tests.reduce((s,t)=>t.scored!==null?s+parseFloat(t.scored):s,0);
  const totalMax=tests.reduce((s,t)=>s+parseFloat(t.maxMarks||0),0);
  const axisY=MT+ph;
  return(
    <div className="mgraph">
      <div className="mgraph-hd">
        <div className="mgraph-leg"><div className="mgraph-dot" style={{background:acc}}/><span>Percentage</span></div>
        {totalMax>0&&<div className="mgraph-tot" style={{color:acc}}>{Math.round(totalScored*100/totalMax)}% &nbsp;<span style={{fontWeight:400,fontSize:9,color:t3}}>({totalScored}/{totalMax})</span></div>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:H,display:'block',overflow:'visible'}}>
        {/* Horizontal grid lines */}
        {[0,25,50,75,100].map(g=>(
          <g key={g}>
            <line x1={ML} y1={toY(g)} x2={W-MR} y2={toY(g)} stroke={gridC} strokeWidth="1"/>
            <text x={ML-4} y={toY(g)+3} textAnchor="end" fontSize="7" fill={t3}>{g}</text>
          </g>
        ))}
        {/* Vertical grid lines at each test */}
        {pts.map((p,i)=>(
          <line key={i} x1={p.x} y1={MT} x2={p.x} y2={axisY} stroke={gridC} strokeWidth="1"/>
        ))}
        {/* Axis lines */}
        <line x1={ML} y1={MT} x2={ML} y2={axisY} stroke={gridC} strokeWidth="1"/>
        <line x1={ML} y1={axisY} x2={W-MR} y2={axisY} stroke={gridC} strokeWidth="1"/>
        {/* Dashed from origin to first point */}
        {dashD&&<path d={dashD} stroke={acc} strokeWidth="1.5" strokeDasharray="3,3" fill="none" opacity=".5"/>}
        {/* Solid line */}
        {solidD&&<path d={solidD} stroke={acc} strokeWidth="1.5" fill="none"/>}
        {/* Dots + labels */}
        {pts.map((p,i)=>p.y===null?null:(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={acc}/>
            <text x={p.x} y={axisY+12} textAnchor="middle" fontSize="7.5" fill={t3}>{p.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function getDashCSS(dark) {
  const d=dark;
  return `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Oswald:wght@500;600;700&family=Varela+Round&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:    ${d?'#04060d':'#f5f0e8'};
  --bg2:   ${d?'#070c18':'#ede8dc'};
  --surf:  ${d?'#0c1120':'#ffffff'};
  --surf2: ${d?'#101829':'#f0ebe0'};
  --surf3: ${d?'#141e30':'#e8e3d8'};
  --border:${d?'rgba(255,255,255,.07)':'rgba(0,0,0,.09)'};
  --bord2: ${d?'rgba(255,255,255,.12)':'rgba(0,0,0,.14)'};
  --text:  ${d?'#eef2ff':'#1a1510'};
  --text2: ${d?'#8896b3':'#6b6155'};
  --text3: ${d?'#4a5568':'#a09585'};
  --accent:${d?'#4f8dff':'#2563eb'};
  --acc2:  ${d?'#7c5cfc':'#7c3aed'};
  --green: ${d?'#22d17a':'#059669'};
  --red:   ${d?'#ff5c5c':'#dc2626'};
  --yellow:${d?'#ffd166':'#d97706'};
  --glow:  ${d?'rgba(79,141,255,.15)':'rgba(37,99,235,.08)'};
  --bnav:  58px;
}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;}
input,button,select{font-family:inherit;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}}

/* BG */
.dash-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
  background:${d?
    'radial-gradient(ellipse 800px 600px at -5% -10%,rgba(79,141,255,.15) 0%,transparent 50%),radial-gradient(ellipse 700px 500px at 105% 105%,rgba(124,92,252,.12) 0%,transparent 50%)'
    :'radial-gradient(ellipse 800px 600px at -5% -10%,rgba(37,99,235,.07) 0%,transparent 50%),radial-gradient(ellipse 700px 500px at 105% 105%,rgba(124,58,237,.05) 0%,transparent 50%)'
  };}
.dash-grid{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(${d?'rgba(255,255,255,.025)':'rgba(0,0,0,.035)'} 1px,transparent 1px),
    linear-gradient(90deg,${d?'rgba(255,255,255,.025)':'rgba(0,0,0,.035)'} 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 80% 50% at 50% 0%,black,transparent);}

/* TOPBAR */
.topbar{position:sticky;top:0;z-index:100;display:flex;align-items:center;
  justify-content:space-between;padding:0 clamp(14px,3vw,32px);height:54px;gap:10px;
  background:${d?'rgba(4,6,13,.9)':'rgba(245,240,232,.94)'};
  backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}
.topbar-logo{display:flex;align-items:center;gap:9px;cursor:default;flex-shrink:0;}
.lmark{width:28px;height:28px;border-radius:7px;
  background:linear-gradient(135deg,var(--accent),var(--acc2));
  display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:800;color:#fff;font-family:'Playfair Display',serif;
  box-shadow:0 2px 8px rgba(79,141,255,.35);}
.lname{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;letter-spacing:-.3px;}
.topbar-right{display:flex;align-items:center;gap:7px;flex-shrink:0;}
.today-badge{font-size:10px;font-weight:700;padding:4px 10px;border-radius:7px;
  font-family:'Varela Round',sans-serif;letter-spacing:.04em;white-space:nowrap;}
.ibt{width:32px;height:32px;background:var(--surf2);border:1px solid var(--border);
  border-radius:8px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:var(--text2);font-size:13px;transition:all .15s;}
.ibt:hover{border-color:var(--bord2);color:var(--text);}
.btn-signout{display:flex;align-items:center;gap:5px;padding:5px 12px;
  background:transparent;border:1px solid var(--border);
  border-radius:8px;color:var(--text2);font-size:12px;font-weight:500;cursor:pointer;
  transition:all .15s;white-space:nowrap;}
.btn-signout:hover{border-color:var(--red);color:var(--red);}
.btn-signout-icon{width:32px;height:32px;background:transparent;border:1px solid var(--border);
  border-radius:8px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:var(--text2);font-size:14px;transition:all .15s;display:none;}
.btn-signout-icon:hover{border-color:var(--red);color:var(--red);}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0;
  box-shadow:0 0 5px var(--green);}
.live-lbl{font-size:9px;font-weight:700;color:var(--green);font-family:'Varela Round',sans-serif;letter-spacing:.03em;}
.live-time{font-size:9px;color:var(--text3);font-family:'Varela Round',sans-serif;}
.btn-refresh{display:flex;align-items:center;gap:8px;padding:5px 12px;
  background:var(--surf2);border:1px solid var(--border);border-radius:8px;
  color:var(--text2);cursor:pointer;white-space:nowrap;transition:all .15s;text-align:left;}
.btn-refresh:hover:not(:disabled){border-color:var(--accent);color:var(--accent);}
.btn-refresh:hover:not(:disabled) .live-lbl{color:var(--accent);}
.btn-refresh:hover:not(:disabled) .live-dot{background:var(--accent);box-shadow:0 0 5px var(--accent);}
.btn-refresh:disabled{opacity:.45;cursor:not-allowed;}
.refresh-icon{font-size:14px;flex-shrink:0;line-height:1;}
.refresh-inner{display:flex;flex-direction:column;gap:1px;}
.refresh-top{font-size:11px;font-weight:600;line-height:1.2;}
.refresh-bottom{display:flex;align-items:center;gap:4px;}
/* Mobile topbar */
@media(max-width:640px){
  .today-badge{display:none;}
  .btn-signout{display:none;}
  .btn-signout-icon{display:flex;}
  .lname{font-size:14px;}
}

/* DESKBAR */
.deskbar{display:flex;align-items:center;gap:1px;padding:0 clamp(12px,3vw,28px);
  height:38px;background:var(--surf);border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;}
.deskbar::-webkit-scrollbar{display:none;}
.navit{padding:4px 12px;font-size:12px;font-weight:500;cursor:pointer;color:var(--text2);
  border-radius:6px;transition:all .15s;white-space:nowrap;user-select:none;}
.navit:hover{color:var(--text);background:var(--surf2);}
.navit.on{color:var(--accent);background:${d?'rgba(79,141,255,.1)':'rgba(37,99,235,.08)'};font-weight:600;}

/* BOTTOM NAV */
.bnav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;
  background:${d?'rgba(4,6,13,.95)':'rgba(245,240,232,.97)'};
  border-top:1px solid var(--border);backdrop-filter:blur(24px);
  padding-bottom:env(safe-area-inset-bottom,0px);}
.bnav-inner{display:flex;height:var(--bnav);}
.bni{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;cursor:pointer;border:none;background:transparent;padding:6px 2px;
  -webkit-tap-highlight-color:transparent;color:var(--text3);transition:color .15s;}
.bni.on{color:var(--accent);}
.bni-ico{width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
.bni-lbl{font-size:9px;font-weight:500;transition:color .15s;}
.bni.on .bni-lbl{font-weight:700;}
.bni.on .bni-ico svg{filter:${d?'drop-shadow(0 0 5px rgba(79,141,255,.5))':'none'};}

/* MODAL */
.modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);
  backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:var(--surf);border:1px solid var(--border);border-radius:18px;
  padding:28px 24px 20px;max-width:300px;width:100%;text-align:center;
  box-shadow:0 24px 48px rgba(0,0,0,.35);}
.modal-icon{width:44px;height:44px;border-radius:12px;background:rgba(255,92,92,.12);
  display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:20px;}
.modal-title{font-size:17px;font-weight:700;margin-bottom:5px;}
.modal-sub{font-size:12px;color:var(--text3);margin-bottom:22px;line-height:1.5;}
.modal-btns{display:flex;gap:8px;}
.modal-cancel{flex:1;padding:11px;border:1px solid var(--border);border-radius:10px;
  background:var(--surf2);color:var(--text2);font-size:13px;font-weight:500;cursor:pointer;
  transition:border-color .15s;}
.modal-cancel:hover{border-color:var(--bord2);}
.modal-signout{flex:1;padding:11px;border:none;border-radius:10px;background:var(--red);
  color:#fff;font-size:13px;font-weight:600;cursor:pointer;opacity:.92;transition:opacity .15s;}
.modal-signout:hover{opacity:1;}

/* PAGE */
.page{position:relative;z-index:1;padding:clamp(12px,2.5vw,20px) clamp(12px,2.5vw,28px);
  max-width:1200px;margin:0 auto;width:100%;animation:fadeUp .28s ease both;}
.page-bot{padding-bottom:calc(var(--bnav) + env(safe-area-inset-bottom,0px) + 12px);}

/* PROFILE */
.pcard{display:flex;align-items:center;gap:14px;padding:18px 20px;margin-bottom:14px;
  background:var(--surf);border:1px solid var(--bord2);border-radius:14px;
  position:relative;overflow:hidden;}
.pcard::after{content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,var(--glow),transparent 55%);pointer-events:none;}
.av{width:46px;height:46px;border-radius:11px;flex-shrink:0;
  background:linear-gradient(135deg,var(--accent),var(--acc2));
  display:flex;align-items:center;justify-content:center;
  font-family:'Playfair Display',serif;font-size:18px;font-weight:800;color:#fff;}
.p-name{font-family:'Playfair Display',serif;font-size:clamp(14px,2vw,16px);font-weight:700;
  letter-spacing:-.3px;margin-bottom:2px;}
.p-reg{font-size:10px;color:var(--text2);font-family:'Varela Round',sans-serif;margin-bottom:6px;}
.p-chips{display:flex;flex-wrap:wrap;gap:4px;}
.chip{font-size:9px;font-weight:600;color:var(--text2);background:var(--surf2);
  border:1px solid var(--border);border-radius:4px;padding:2px 7px;}

/* HOME GRID */
.home-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
.scard--hero{grid-column:span 2;}
.scard--wide{grid-column:1/-1;}
.scard--action{display:flex;flex-direction:column;min-height:104px;}
.scard-act-ico{font-size:28px;margin:4px 0 6px;}
.scard-cta{font-size:10px;font-weight:700;color:var(--accent);margin-top:auto;letter-spacing:.03em;}
.scard--wellness{border-color:rgba(34,209,122,.25)!important;background:rgba(34,209,122,.04)!important;}
.scard--wellness:hover{border-color:rgba(34,209,122,.45)!important;}
.scard-wellness-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.scard-wellness-txt{flex:1;min-width:0;}
.scard-wellness-ico{font-size:38px;flex-shrink:0;}
.scard-wellness-name{font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;}

/* SUMMARY CARDS */
.scard{background:var(--surf);border:1px solid var(--border);border-radius:12px;
  padding:16px;position:relative;overflow:hidden;transition:border-color .2s;}
.scard:hover{border-color:var(--bord2);}
.scard-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
  color:var(--text3);margin-bottom:8px;}
.scard-val{font-family:'Oswald',sans-serif;font-size:clamp(20px,2.5vw,26px);font-weight:700;letter-spacing:-.2px;}
.scard-sub{font-size:10px;color:var(--text3);margin-top:3px;}
.scard-bar{position:absolute;bottom:0;left:0;right:0;height:2px;border-radius:0 0 12px 12px;}

/* SECTION LABEL */
.seclbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
  color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.seclbl::before{content:'';width:2px;height:10px;
  background:linear-gradient(180deg,var(--accent),var(--acc2));border-radius:2px;flex-shrink:0;}

/* ATTENDANCE CARDS (mobile) */
.attlist{display:flex;flex-direction:column;gap:8px;}
.attcard{background:var(--surf);border:1px solid var(--border);border-radius:12px;padding:14px;
  transition:border-color .15s;}
.attcard:hover{border-color:var(--bord2);}
.attcard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;}
.att-name{font-size:13px;font-weight:600;letter-spacing:-.1px;margin-bottom:2px;}
.att-code{font-size:9px;color:var(--text3);font-family:'Varela Round',sans-serif;}
.att-pct{font-size:12px;font-weight:800;padding:3px 9px;border-radius:6px;
  font-family:'Varela Round',sans-serif;flex-shrink:0;}
.att-bar{height:3px;background:var(--surf3);border-radius:2px;margin-bottom:8px;position:relative;}
.att-bar-fill{height:3px;border-radius:2px;}
.att-bar-mark{position:absolute;top:-3px;bottom:-3px;width:1.5px;left:75%;background:var(--text3);}
.att-meta{display:flex;gap:5px;}
.att-mi{display:flex;flex-direction:column;align-items:center;background:var(--surf2);
  border:1px solid var(--border);border-radius:7px;padding:6px 8px;flex:1;min-width:0;}
.att-mv{font-size:14px;font-weight:700;line-height:1;font-family:'Oswald',sans-serif;}
.att-ml{font-size:8px;color:var(--text3);margin-top:2px;text-transform:uppercase;
  letter-spacing:.04em;white-space:nowrap;}

/* TABLE */
.card{background:var(--surf);border:1px solid var(--border);border-radius:13px;overflow:hidden;margin-bottom:14px;}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;}
table{width:100%;border-collapse:collapse;min-width:520px;}
thead th{padding:9px 14px;background:var(--surf2);font-size:9px;font-weight:700;
  color:var(--text3);text-transform:uppercase;letter-spacing:.07em;text-align:left;
  border-bottom:1px solid var(--border);}
tbody tr{border-bottom:1px solid var(--border);transition:background .1s;}
tbody tr:last-child{border-bottom:none;}
tbody tr:hover{background:var(--surf2);}
tbody td{padding:11px 14px;font-size:12px;vertical-align:middle;}
.sn{font-weight:600;font-size:13px;letter-spacing:-.1px;}
.sc{font-size:9px;color:var(--text3);font-family:'Varela Round',sans-serif;margin-top:2px;}
.mbar{height:3px;background:var(--surf3);border-radius:2px;margin-top:4px;width:56px;position:relative;}
.mbar-fill{height:3px;border-radius:2px;}
.mbar-mark{position:absolute;top:-3px;bottom:-3px;width:1.5px;left:75%;background:var(--text3);}
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;}

/* MARKS */
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr));gap:8px;}
.mcard{background:var(--surf);border:1px solid var(--border);border-radius:12px;padding:14px;
  transition:border-color .15s;}
.mcard:hover{border-color:var(--bord2);}
.mcode{font-size:10px;font-weight:700;color:var(--accent);font-family:'Varela Round',sans-serif;margin-bottom:2px;}
.mname{font-size:12px;font-weight:600;margin-bottom:2px;}
.mtype{font-size:9px;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;}
.mgraph{margin:6px 0 10px;padding:8px 10px;background:var(--surf2);border-radius:8px;border:1px solid var(--border);}
.mgraph-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
.mgraph-leg{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text3);}
.mgraph-dot{width:6px;height:6px;border-radius:50%;}
.mgraph-tot{font-size:11px;font-weight:700;font-family:'Oswald',sans-serif;}
.trow{display:flex;flex-wrap:wrap;gap:5px;}
.tpill{background:var(--surf2);border:1px solid var(--border);border-radius:7px;
  padding:6px 9px;text-align:center;flex:1;min-width:52px;max-width:80px;}
.tpill-n{font-size:8px;color:var(--text3);font-family:'Varela Round',sans-serif;margin-bottom:3px;
  text-transform:uppercase;letter-spacing:.04em;}
.tpill-s{font-size:16px;font-weight:700;line-height:1;font-family:'Oswald',sans-serif;}
.tpill-m{font-size:9px;color:var(--text3);}

/* TIMETABLE */
.dtabs{display:flex;gap:5px;overflow-x:auto;margin-bottom:10px;
  scrollbar-width:none;padding-bottom:1px;}
.dtabs::-webkit-scrollbar{display:none;}
.dtab{padding:6px 14px;background:var(--surf);border:1px solid var(--border);
  border-radius:7px;color:var(--text2);font-size:12px;font-weight:500;cursor:pointer;
  transition:all .15s;white-space:nowrap;flex-shrink:0;}
.dtab:hover{border-color:var(--bord2);color:var(--text);}
.dtab.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700;}
.plist{display:flex;flex-direction:column;gap:5px;}
.prow{display:flex;align-items:center;gap:8px;padding:10px 13px;
  background:var(--surf);border:1px solid var(--border);border-radius:10px;transition:border-color .12s;}
.prow:hover{border-color:var(--bord2);}
.prow.free{opacity:.3;}
.pnum{font-size:9px;color:var(--text3);min-width:16px;text-align:center;font-family:'Varela Round',sans-serif;flex-shrink:0;}
.ptime{font-size:9px;color:var(--text3);font-family:'Varela Round',sans-serif;white-space:nowrap;min-width:72px;flex-shrink:0;}
.pname-wrap{flex:1;min-width:0;overflow:hidden;}
.pname{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
.pfaculty{font-size:9px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;margin-top:1px;}
.proom{font-size:8px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;margin-top:1px;font-style:italic;}
.ptype{font-size:8px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap;text-transform:uppercase;flex-shrink:0;}
.pt{background:${d?'rgba(79,141,255,.1)':'rgba(37,99,235,.07)'};color:var(--accent);}
.pp{background:${d?'rgba(34,209,122,.1)':'rgba(5,150,105,.07)'};color:var(--green);}

/* CALENDAR */
.cal-outer{display:flex;flex-direction:column;gap:12px;width:100%;}
@media(min-width:700px){.cal-outer{flex-direction:row;align-items:flex-start;gap:16px;}
.cwrap{flex:0 0 auto;width:min(100%,340px);}}
.cwrap{background:var(--surf);border:1px solid var(--border);border-radius:13px;padding:16px;}
.cnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.ctit{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;}
.cbtn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;
  background:var(--surf2);border:1px solid var(--border);border-radius:7px;
  cursor:pointer;color:var(--text2);font-size:14px;}
.cgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.cdow{font-size:8px;font-weight:700;color:var(--text3);text-align:center;
  padding:3px 0;letter-spacing:.05em;text-transform:uppercase;}
.cday{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;border-radius:6px;}
.cday.cl{cursor:pointer;-webkit-tap-highlight-color:transparent;}
.cday.cl:active,.cday.cl:hover{background:var(--surf2);}
.cday.tod{outline:1.5px solid var(--accent);outline-offset:-1px;}
.cdn{font-size:clamp(10px,2vw,12px);font-weight:500;line-height:1;}
.cord{font-size:7px;font-weight:700;border-radius:2px;padding:1px 3px;margin-top:1px;}
.cleg{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid var(--border);}
.cleg-i{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text3);}
.cleg-d{width:7px;height:7px;border-radius:2px;flex-shrink:0;}
.hol-panel{flex:1;min-width:0;background:var(--surf);border:1px solid var(--border);border-radius:13px;padding:14px 14px 8px;}
.hol-panel-title{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;}
.hol-scroll{max-height:280px;overflow-y:auto;}
.hol-scroll::-webkit-scrollbar{width:3px;}
.hol-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
.hol-row{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);}
.hol-row:last-child{border-bottom:none;}
.hol-dt{font-weight:700;color:var(--green);font-size:11px;min-width:52px;white-space:nowrap;padding-top:1px;}
.hol-nm{color:var(--text);font-size:12px;line-height:1.4;}
.hol-empty{font-size:12px;color:var(--text3);padding:8px 0;}
.hol-badge{font-size:9px;font-weight:700;border-radius:4px;padding:2px 5px;white-space:nowrap;flex-shrink:0;}

/* SKELETON */
.sk{border-radius:7px;
  background:${d?'#101829':'#e5dfd4'};
  background-image:linear-gradient(90deg,${d?'#101829':'#e5dfd4'} 0%,${d?'#161e2e':'#ede8dc'} 50%,${d?'#101829':'#e5dfd4'} 100%);
  background-size:200% 100%;animation:shimmer 1.6s ease-in-out infinite;}

.empty{text-align:center;padding:44px;color:var(--text3);font-size:13px;}

/* LOADING BAR */
.loading-bar-wrap{position:fixed;top:0;left:0;right:0;z-index:9999;height:3px;}
.loading-bar{height:3px;background:linear-gradient(90deg,var(--accent),var(--acc2),var(--green));
  transition:width .4s ease;box-shadow:0 0 10px var(--accent);}

/* AUTH */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:20px;background:var(--bg);position:relative;}
.auth-wrap::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:${d?
    'radial-gradient(ellipse 700px 600px at 30% 20%,rgba(79,141,255,.15) 0%,transparent 55%),radial-gradient(ellipse 500px 400px at 80% 80%,rgba(124,92,252,.12) 0%,transparent 55%)'
    :'radial-gradient(ellipse 700px 600px at 30% 20%,rgba(37,99,235,.08) 0%,transparent 55%),radial-gradient(ellipse 500px 400px at 80% 80%,rgba(124,58,237,.06) 0%,transparent 55%)'
  };}
.auth-grid{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(${d?'rgba(255,255,255,.025)':'rgba(0,0,0,.04)'} 1px,transparent 1px),
    linear-gradient(90deg,${d?'rgba(255,255,255,.025)':'rgba(0,0,0,.04)'} 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 90% 80% at 50% 0%,black 30%,transparent 80%);}
.auth-card{width:100%;max-width:380px;background:var(--surf);border:1px solid var(--bord2);
  border-radius:18px;padding:clamp(22px,5vw,30px);position:relative;z-index:1;
  box-shadow:0 24px 64px ${d?'rgba(0,0,0,.5)':'rgba(0,0,0,.1)'};animation:fadeUp .4s ease both;}
.auth-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
.auth-h{font-family:'Playfair Display',serif;font-size:20px;font-weight:800;letter-spacing:-.4px;margin-bottom:3px;}
.auth-sh{font-size:12px;color:var(--text2);margin-bottom:16px;}
.field{margin-bottom:10px;}
.field label{display:block;font-size:10px;font-weight:700;color:var(--text2);
  letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px;}
.field input{width:100%;padding:12px 13px;background:var(--surf2);border:1px solid var(--bord2);
  border-radius:9px;color:var(--text);font-size:15px;outline:none;
  transition:border-color .2s,box-shadow .2s;}
.field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--glow);}
.field input::placeholder{color:var(--text3);}
.auth-err{font-size:12px;color:var(--red);margin-top:8px;padding:9px 12px;
  background:${d?'rgba(255,92,92,.08)':'rgba(220,38,38,.05)'};border-radius:7px;
  border:1px solid ${d?'rgba(255,92,92,.2)':'rgba(220,38,38,.15)'};}
.auth-note{font-size:11px;color:var(--text3);margin-top:10px;line-height:1.65;
  padding:9px 12px;background:var(--surf2);border-radius:7px;border:1px solid var(--border);}
.captcha-img{width:100%;border-radius:8px;margin-bottom:10px;}
.btn-p{padding:12px 22px;background:var(--accent);border:none;border-radius:10px;color:#fff;
  font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  box-shadow:0 0 20px rgba(79,141,255,.25);}
.btn-p:hover{opacity:.88;box-shadow:0 0 30px rgba(79,141,255,.4);}
.btn-p:active{transform:scale(.97);}
.btn-p:disabled{opacity:.4;cursor:not-allowed;}
.btn-g{padding:10px 16px;background:transparent;border:1px solid var(--bord2);
  border-radius:9px;color:var(--text);font-size:13px;cursor:pointer;transition:all .15s;}
.btn-g:hover{border-color:var(--accent);color:var(--accent);}

/* PROGRESS STEPS */
.prog-steps{display:flex;flex-direction:column;gap:8px;margin-top:16px;}
.prog-step{display:flex;align-items:center;gap:10px;padding:8px 12px;
  background:var(--surf2);border:1px solid var(--border);border-radius:9px;transition:all .3s;}
.prog-step.active{background:${d?'rgba(79,141,255,.08)':'rgba(37,99,235,.05)'};border-color:${d?'rgba(79,141,255,.2)':'rgba(37,99,235,.15)'};}
.prog-step.done{border-color:${d?'rgba(34,209,122,.2)':'rgba(5,150,105,.2)'};}
.prog-ico{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--border);transition:all .3s;}
.prog-step.done .prog-ico{background:${d?'rgba(34,209,122,.15)':'rgba(5,150,105,.1)'};border-color:${d?'rgba(34,209,122,.4)':'rgba(5,150,105,.3)'};}
.prog-step.active .prog-ico{border-color:${d?'rgba(79,141,255,.4)':'rgba(37,99,235,.3)'};}
.prog-lbl{font-size:12px;font-weight:500;flex:1;transition:color .3s;}
.prog-step.active .prog-lbl{color:var(--text);font-weight:600;}
.prog-step.done .prog-lbl{color:var(--green);}
.prog-step:not(.active):not(.done) .prog-lbl{color:var(--text3);}
.prog-time{font-size:10px;color:var(--text3);font-family:'Varela Round',sans-serif;}

/* RESPONSIVE */
@media(min-width:768px){
  .bnav{display:none!important;}
  .deskbar{display:flex!important;}
  .attlist{display:none!important;}
  .attdesk{display:block!important;}
  .home-grid{grid-template-columns:repeat(3,1fr);}
}
@media(max-width:767px){
  .deskbar{display:none!important;}
  .bnav{display:flex!important;flex-direction:column;}
  .page-bot{padding-bottom:calc(var(--bnav) + env(safe-area-inset-bottom,0px) + 12px);}
  .attdesk{display:none!important;}
  .attlist{display:flex!important;}
  
  .home-grid{grid-template-columns:repeat(2,1fr);}
  .scard--hero{grid-column:span 2;}
  .scard--wide{grid-column:span 2;}
}
@media(min-width:1280px){
  .home-grid{grid-template-columns:repeat(3,1fr);}
}

/* INTERNSHIPS */
.int-filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
.int-filters select{background:var(--surf);border:1px solid var(--border);border-radius:8px;
  color:var(--text);font-size:12px;padding:6px 10px;cursor:pointer;outline:none;min-width:140px;}
.int-filters select:focus{border-color:var(--bord2);}
.int-list{display:flex;flex-direction:column;gap:10px;}
.int-card{background:var(--surf);border:1px solid var(--border);border-radius:12px;
  padding:14px 16px;cursor:pointer;transition:border-color .15s,transform .1s;}
.int-card:hover{border-color:var(--bord2);transform:translateY(-1px);}
.int-card-top{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;}
.int-title{font-size:14px;font-weight:700;color:var(--text);line-height:1.3;}
.int-company{font-size:11px;color:var(--text3);margin-top:2px;}
.int-stipend{font-size:11px;font-weight:600;color:var(--green);white-space:nowrap;
  background:rgba(34,209,122,.1);padding:3px 8px;border-radius:6px;border:1px solid rgba(34,209,122,.2);}
.int-tags{display:flex;flex-wrap:wrap;gap:5px;}
.int-tag{font-size:10px;padding:2px 7px;border-radius:5px;background:var(--surf2);
  color:var(--text3);border:1px solid var(--border);}
.int-tag-sem{color:var(--accent);background:rgba(79,141,255,.1);border-color:rgba(79,141,255,.2);}
.int-tag-dead{color:var(--red);background:rgba(255,92,92,.08);border-color:rgba(255,92,92,.2);}
.int-tag-time{color:var(--text3);background:transparent;border-color:transparent;padding-left:0;}
.int-tag-skill{color:var(--acc2);background:rgba(124,92,252,.1);border-color:rgba(124,92,252,.2);}
/* Internship detail modal */
.int-detail-modal{background:var(--surf);border:1px solid var(--border);border-radius:18px;
  padding:24px 22px 20px;max-width:500px;width:100%;max-height:85vh;overflow-y:auto;
  box-shadow:0 24px 48px rgba(0,0,0,.35);position:relative;}
.int-modal-close{position:absolute;top:14px;right:14px;background:var(--surf2);border:1px solid var(--border);
  border-radius:8px;width:28px;height:28px;cursor:pointer;color:var(--text2);font-size:13px;
  display:flex;align-items:center;justify-content:center;}
.int-modal-company{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}
.int-modal-title{font-size:20px;font-weight:700;color:var(--text);margin-bottom:12px;padding-right:32px;}
.int-modal-meta{font-size:12px;color:var(--text2);margin-bottom:5px;}
.int-modal-section{margin-top:14px;}
.int-modal-sh{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
  color:var(--text3);margin-bottom:4px;}
.int-modal-body{font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap;}
.int-apply-btn{display:block;margin-top:18px;padding:12px;border-radius:10px;
  background:var(--accent);color:#fff;font-size:14px;font-weight:600;text-align:center;
  text-decoration:none;transition:opacity .15s;}
.int-apply-btn:hover{opacity:.88;}
.pred-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:9px;border:1px solid rgba(79,141,255,.35);background:rgba(79,141,255,.1);color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;}
.pred-btn:hover{background:rgba(79,141,255,.2);border-color:var(--accent);}
.pred-modal{background:var(--surf);border:1px solid var(--border);border-radius:16px;padding:22px 18px;width:90%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);}
.pred-row{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surf2);border-radius:7px;}
.content-modal{background:var(--surf);border:1px solid var(--border);border-radius:16px;padding:22px 18px;width:92%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);}
.wellness-modal{background:var(--surf);border:1px solid var(--border);border-radius:16px;padding:24px 18px;width:96%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5);}
.guide-tabs{display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid var(--border);padding-bottom:10px;}
.guide-tab-btn{padding:6px 14px;border-radius:8px;border:none;background:transparent;color:var(--text3);font-size:13px;font-weight:600;cursor:pointer;}
.guide-tab-btn.on{background:rgba(79,141,255,.12);color:var(--accent);}
.content-entry{margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--border);}
.content-entry:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}
.content-entry img{width:100%;border-radius:10px;margin:10px 0;}
.content-entry p{font-size:13px;line-height:1.65;color:var(--text2);white-space:pre-wrap;}
.content-entry a{display:inline-block;margin-top:8px;padding:7px 14px;background:rgba(79,141,255,.1);border:1px solid rgba(79,141,255,.3);border-radius:8px;color:var(--accent);font-size:12px;font-weight:600;text-decoration:none;}
.guide-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:1px solid rgba(79,141,255,.35);background:rgba(79,141,255,.08);color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:12px;}
.guide-btn:hover{background:rgba(79,141,255,.15);}

`;

}

// -- Loading steps ------------------------------------------------------------
const LOGIN_STEPS = [
  {label:'Connecting to SRM portal',  dur:6},
  {label:'Verifying credentials',     dur:5},
  {label:'Loading attendance data',   dur:10},
  {label:'Loading timetable',         dur:8},
  {label:'Building your dashboard',   dur:4},
];

function SkeletonDash() {
  return (
    <div style={{animation:'fadeUp .3s ease'}}>
      <div style={{display:'flex',gap:14,alignItems:'center',padding:'18px 20px',background:'var(--surf)',border:'1px solid var(--border)',borderRadius:14,marginBottom:14}}>
        <div className="sk" style={{width:46,height:46,borderRadius:11,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div className="sk" style={{height:16,width:'40%',marginBottom:8,borderRadius:6}}/>
          <div className="sk" style={{height:10,width:'28%',marginBottom:8}}/>
          <div style={{display:'flex',gap:4}}>
            <div className="sk" style={{width:55,height:18,borderRadius:4}}/>
            <div className="sk" style={{width:75,height:18,borderRadius:4}}/>
            <div className="sk" style={{width:50,height:18,borderRadius:4}}/>
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:10,marginBottom:14}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{background:'var(--surf)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
            <div className="sk" style={{height:9,width:'50%',marginBottom:10}}/>
            <div className="sk" style={{height:26,width:'38%',borderRadius:8,marginBottom:7}}/>
            <div className="sk" style={{height:9,width:'60%'}}/>
          </div>
        ))}
      </div>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{background:'var(--surf)',border:'1px solid var(--border)',borderRadius:12,padding:13,marginBottom:7,display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:2}}><div className="sk" style={{height:13,width:'65%',marginBottom:6}}/><div className="sk" style={{height:9,width:'38%'}}/></div>
          <div className="sk" style={{width:38,height:22,borderRadius:5,flexShrink:0}}/>
          <div className="sk" style={{width:52,height:22,borderRadius:5,flexShrink:0}}/>
          <div className="sk" style={{width:62,height:22,borderRadius:5,flexShrink:0}}/>
        </div>
      ))}
    </div>
  );
}

// -- Calendar ----------------------------------------------------------------
// Classify an event string into a type
function classifyEvent(event) {
  if(!event) return 'break';
  const e=event.toLowerCase();
  if(e.includes('holiday')) return 'holiday';
  if(e.includes('last working day')||e.includes('last day of class')) return 'lastday';
  if(e.includes('first working day')||e.includes('commencement of class')||e.includes('classes commence')||e.includes('reopening')) return 'firstday';
  if(e.includes('enrollment')||e.includes('enrolment')||e.includes('registration')||e.includes('re-registration')) return 'enrollment';
  if(e.includes('exam')||e.includes('cia')||e.includes('assessment')||e.includes('test')) return 'exam';
  return 'event';
}
const ET={
  holiday:    {color:'var(--green)',  bg:'rgba(34,209,122,.15)',  badge:'HOL', label:'Holiday'},
  lastday:    {color:'#f59e0b',       bg:'rgba(245,158,11,.15)',  badge:'LWD', label:'Last Working Day'},
  firstday:   {color:'#14b8a6',       bg:'rgba(20,184,166,.15)',  badge:'FWD', label:'First Working Day'},
  enrollment: {color:'var(--acc2)',   bg:'rgba(124,92,252,.15)',  badge:'ENR', label:'Enrollment'},
  exam:       {color:'var(--red)',    bg:'rgba(255,92,92,.15)',   badge:'EXM', label:'Exam'},
  event:      {color:'#f59e0b',       bg:'rgba(245,158,11,.15)',  badge:'EVT', label:'Event'},
  break:      {color:'var(--text3)',  bg:'transparent',           badge:null,  label:'No Class'},
};

// Check if an event is relevant to the student's program
function isProgramRelevant(event, program) {
  if(!event||!program) return true;
  const e=event.toLowerCase(), p=program.toLowerCase();
  const progs=['b.tech','m.tech','b.arch','m.arch','mba','mca','m.sc','ph.d','btech','mtech'];
  const mentioned=progs.filter(k=>e.includes(k));
  if(mentioned.length===0) return true;
  return mentioned.some(k=>p.replace(/[.\s]/g,'').includes(k.replace(/[.\s]/g,'')));
}

function getPlannerInfo(date, plannerData) {
  if(!date) return null;
  const dow=date.getDay();
  if(dow===0||dow===6) return {order:null, event:'Weekend', _weekend:true};
  if(!plannerData) return {order:getDayOrder(date), event:null};
  const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const info=plannerData[key];
  if(!info) return {order:getDayOrder(date), event:null};
  // Backwards-compat: old format used "holiday" field
  if(info.holiday!==undefined && info.event===undefined)
    return {order:info.order, event:info.holiday||null};
  return info;
}

function Calendar({ dark, onSelectDay, plannerData, program }) {
  const today = new Date();
  const [mo,setMo]=useState(today.getMonth());
  const [yr,setYr]=useState(today.getFullYear());
  const days=getMonthDays(yr,mo);
  const prev=()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const next=()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);}

  // All events for current month (excludes weekends and working days with no event)
  const monthEvents = (() => {
    const result = [];
    const daysInMonth = new Date(yr, mo+1, 0).getDate();
    for(let d=1; d<=daysInMonth; d++) {
      const date = new Date(yr, mo, d);
      const info = getPlannerInfo(date, plannerData);
      if(!info||info._weekend) continue;
      // Show: named events (all types), and also working days that have an event
      if(info.event) {
        result.push({day:d, date, event:info.event, order:info.order, type:classifyEvent(info.event)});
      }
    }
    return result;
  })();

  return (
    <div className="cal-outer">
      <div className="cwrap">
        <div className="cnav">
          <button className="cbtn" onClick={prev}>‹</button>
          <span className="ctit">{FULL_MON[mo]} {yr}</span>
          <button className="cbtn" onClick={next}>›</button>
        </div>
        <div className="cgrid">
          {DOW_SHORT.map(d=><div key={d} className="cdow">{d}</div>)}
          {days.map((date,i)=>{
            if(!date)return<div key={i}/>;
            const info=getPlannerInfo(date, plannerData);
            const isToday=date.toDateString()===today.toDateString();
            const isWeekend=date.getDay()===0||date.getDay()===6;
            const ord=info?info.order:null;
            const evType=classifyEvent(info?.event);
            const relevant=isProgramRelevant(info?.event, program);
            // Determine cell color
            const numColor=isToday?'var(--accent)':
              isWeekend?'var(--green)':
              ord?'var(--text)':
              info?.event?ET[evType].color:
              'var(--text3)'; // semester break
            const titleTxt=info?.event||(ord?'Day '+ord:isWeekend?'Weekend':'No Class');
            return (
              <div key={i} className={'cday'+(isToday?' tod':'')+(ord?' cl':'')}
                onClick={()=>ord&&onSelectDay&&onSelectDay('Day '+ord)}
                title={titleTxt}
                style={!relevant&&info?.event?{opacity:0.45}:{}}>
                <span className="cdn" style={{color:numColor}}>{date.getDate()}</span>
                {ord&&<span className="cord" style={{background:'rgba(79,141,255,.15)',color:'var(--accent)'}}>D{ord}</span>}
                {!ord&&!isWeekend&&info?.event&&ET[evType].badge&&
                  <span className="cord" style={{background:ET[evType].bg,color:ET[evType].color,fontSize:6}}>
                    {ET[evType].badge}
                  </span>}
              </div>
            );
          })}
        </div>
        <div className="cleg">
          <div className="cleg-i"><div className="cleg-d" style={{background:'var(--accent)'}}/> Class Day</div>
          <div className="cleg-i"><div className="cleg-d" style={{background:'var(--green)'}}/> Holiday</div>
          <div className="cleg-i"><div className="cleg-d" style={{background:'#f59e0b'}}/> Event/Last Day</div>
          <div className="cleg-i"><div className="cleg-d" style={{background:'var(--acc2)'}}/> Enrollment</div>
        </div>
      </div>
      <div className="hol-panel">
        <div className="hol-panel-title">Events — {FULL_MON[mo]}</div>
        <div className="hol-scroll">
          {monthEvents.length===0
            ? <div className="hol-empty">No events this month</div>
            : monthEvents.map(ev=>{
                const rel=isProgramRelevant(ev.event, program);
                const stripped=ev.event.replace(/\s*-\s*Holiday\s*$/i,'').trim();
                return (
                  <div key={ev.day} className="hol-row" style={!rel?{opacity:0.4}:{}}>
                    <span className="hol-dt">{ev.date.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span className="hol-nm">{stripped}</span>
                      {ev.order&&<span style={{fontSize:10,color:'var(--accent)',marginLeft:5}}>· Day {ev.order}</span>}
                    </div>
                    <span className="hol-badge" style={{background:ET[ev.type].bg,color:ET[ev.type].color}}>
                      {ET[ev.type].label}
                    </span>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}

// -- AttCard (mobile) --------------------------------------------------------
function ContentList({entries}){
  if(!entries) return <div style={{textAlign:'center',padding:24,color:'var(--text3)',fontSize:13}}>Loading…</div>;
  if(!entries.length) return <div style={{textAlign:'center',padding:24,color:'var(--text3)',fontSize:13}}>No content yet.</div>;
  return(
    <div>
      {entries.map((e,i)=>(
        <div key={e.id||i} className="content-entry">
          {e.title&&<div style={{fontWeight:700,fontSize:14,marginBottom:6}}>{e.title}</div>}
          {e.imageUrl&&<img src={e.imageUrl} alt={e.title||''} loading="lazy"/>}
          {e.body&&<p>{e.body}</p>}
          {e.linkUrl&&<a href={e.linkUrl} target="_blank" rel="noopener noreferrer">{e.linkLabel||'Learn more →'}</a>}
        </div>
      ))}
    </div>
  );
}

function GuideContent({guideContent}){
  const [tab,setTab]=useState(0);
  if(!guideContent) return <div style={{textAlign:'center',padding:24,color:'var(--text3)',fontSize:13}}>Loading…</div>;
  const sections=[{label:'Topic 1',entries:guideContent[0]||[]},{label:'Topic 2',entries:guideContent[1]||[]}];
  // Use first non-empty section's title if available
  const s1Title=(guideContent[0]||[]).find(e=>e.title)?.title;
  const s2Title=(guideContent[1]||[]).find(e=>e.title)?.title;
  const tabs=[s1Title||'Topic 1',s2Title||'Topic 2'];
  return(
    <>
      <div className="guide-tabs">
        {tabs.map((t,i)=>(
          <button key={i} className={'guide-tab-btn'+(tab===i?' on':'')} onClick={()=>setTab(i)}>{t}</button>
        ))}
      </div>
      <ContentList entries={sections[tab].entries}/>
    </>
  );
}

function AttCard({c,pCol}){
  const {attended,pct,required,canSkip,risk}=calcStats(c.conducted,c.absent);
  const col=pCol(risk);
  return(
    <div className="attcard">
      <div className="attcard-top">
        <div style={{minWidth:0,flex:1}}>
          <div className="att-name">{c.name||c.code}</div>
          <div className="att-code">{c.code} · {c.type}</div>
        </div>
        <span className="att-pct" style={{background:col+'18',color:col,border:'1px solid '+col+'30'}}>{pct.toFixed(1)}%</span>
      </div>
      <div className="att-bar"><div className="att-bar-mark"/><div className="att-bar-fill" style={{width:Math.min(pct,100)+'%',background:col}}/></div>
      <div className="att-meta">
        <div className="att-mi"><span className="att-mv" style={{color:'var(--text2)'}}>{c.conducted}</span><span className="att-ml">Held</span></div>
        <div className="att-mi"><span className="att-mv" style={{color:'var(--red)'}}>{c.absent}</span><span className="att-ml">Absent</span></div>
        <div className="att-mi"><span className="att-mv" style={{color:'var(--green)'}}>{attended}</span><span className="att-ml">Present</span></div>
        <div className="att-mi" style={{flex:'2 1 0'}}>
          <span className="att-mv" style={{color:risk==='danger'?'var(--red)':'var(--green)',fontSize:11}}>
            {risk==='danger'?`Need ${required}`:`Skip ${canSkip}`}
          </span>
          <span className="att-ml">classes</span>
        </div>
      </div>
    </div>
  );
}

// -- Loading Screen with real progress ---------------------------------------
function LoginProgress({steps,startTime,dark,isFirstLogin}){
  const [elapsed,setElapsed]=useState(0);
  const totalDur=steps.reduce((s,st)=>s+st.dur,0);
  useEffect(()=>{
    const iv=setInterval(()=>setElapsed((Date.now()-startTime)/1000),300);
    return()=>clearInterval(iv);
  },[startTime]);
  const pct=Math.min(Math.round((elapsed/totalDur)*100),95);
  let stepIdx=0,acc=0;
  for(let i=0;i<steps.length;i++){if(elapsed>=acc)stepIdx=i;acc+=steps[i].dur;}
  stepIdx=Math.min(stepIdx,steps.length-1);
  const remaining=Math.max(0,Math.round(totalDur-elapsed));

  return(
    <div className="auth-wrap">
      <div className="auth-grid"/>
      <div className="auth-card">
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:22}}>
          <div className="lmark">C</div>
          <span style={{fontFamily:'Playfair Display',fontSize:14,fontWeight:700}}>CampusHub</span>
        </div>
        <div className="loading-bar-wrap" style={{position:'static',marginBottom:8,borderRadius:4,overflow:'hidden',height:4,background:'var(--surf2)'}}>
          <div className="loading-bar" style={{width:pct+'%',height:4}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <span style={{fontSize:11,color:'var(--text3)',fontFamily:'Varela Round'}}>{pct}%</span>
          <span style={{fontSize:11,color:'var(--text3)',fontFamily:'Varela Round'}}>~{remaining}s</span>
        </div>
        <div className="prog-steps">
          {steps.map((st,i)=>{
            const done=i<stepIdx, active=i===stepIdx;
            return(
              <div key={i} className={'prog-step'+(done?' done':active?' active':'')}>
                <div className="prog-ico">
                  {done?<svg width="9"height="9"viewBox="0 0 9 9"fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5"stroke={dark?'#22d17a':'#059669'}strokeWidth="1.5"strokeLinecap="round"strokeLinejoin="round"/></svg>
                  :active?<div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)',animation:'pulse2 1s ease-in-out infinite alternate'}}/>
                  :null}
                </div>
                <span className="prog-lbl">{st.label}</span>
                {done&&<span style={{fontSize:9,color:dark?'rgba(34,209,122,.5)':'rgba(5,150,105,.6)',fontFamily:'Varela Round'}}>done</span>}
                {active&&<div style={{width:13,height:13,borderRadius:'50%',border:'2px solid var(--border)',borderTopColor:'var(--accent)',animation:'spin .7s linear infinite',flexShrink:0}}/>}
                {!done&&!active&&<span className="prog-time">~{st.dur}s</span>}
              </div>
            );
          })}
        </div>
        <p style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:14,lineHeight:1.6}}>
          SRM's portal is slow by nature.<br/>Please keep this tab open.
        </p>
        {isFirstLogin&&<p style={{fontSize:11,color:'var(--accent)',textAlign:'center',marginTop:8,lineHeight:1.5}}>
          This might take a while if you are logging in for the first time.
        </p>}
      </div>
    </div>
  );
}

// -- Main Dashboard export ----------------------------------------------------
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString('en-IN', {day:'numeric', month:'short'});
}

export default function Dashboard({
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
  lastUpdatedTs, onManualRefresh, isFirstLogin,
  isPro, onUpgrade,
}) {
  const [tab,setTab]=useState('dashboard');
  const [activeDay,setActiveDay]=useState('Day 1');
  const [loginStartTime,setLoginStartTime]=useState(null);
  const [plannerData,setPlannerData]=useState(null);
  const [showLogoutModal,setShowLogoutModal]=useState(false);
  const [internships,setInternships]=useState(null);
  const [internCount,setInternCount]=useState(null);
  const [internLoading,setInternLoading]=useState(false);
  const [deptFilter,setDeptFilter]=useState('');
  const [selectedInternship,setSelectedInternship]=useState(null);
  const [showPredModal,setShowPredModal]=useState(false);
  const [predFrom,setPredFrom]=useState("");
  const [predTo,setPredTo]=useState("");
  const [predResult,setPredResult]=useState(null);
  const [showGuideModal,setShowGuideModal]=useState(false);
  const [guideContent,setGuideContent]=useState(null);
  const [,setTimeTick]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>setTimeTick(t=>t+1),60000);return()=>clearInterval(iv);},[]);
  const [showWellnessModal,setShowWellnessModal]=useState(false);
  const [wellnessContent,setWellnessContent]=useState(null);

  useEffect(()=>{const info=getPlannerInfo(new Date(),plannerData);if(info?.order)setActiveDay('Day '+info.order);},[plannerData]);

  useEffect(()=>{
    if(!data) return;
    if(data.plannerData) setPlannerData(data.plannerData);
  },[data]);
  useEffect(()=>{if(loading)setLoginStartTime(Date.now());},[loading]);
  // Pre-fetch internship count on mount so dashboard card always shows a number
  useEffect(()=>{
    if(internCount!==null)return;
    fetch('/api/internships').then(async r=>{
      const d=await r.json();
      if(r.status===403&&d.error==='pro_required') setInternCount(d.count??0);
      else if(Array.isArray(d)) setInternCount(d.length);
    }).catch(()=>{});
  },[isPro]);
  useEffect(()=>{
    if(tab!=='internships')return;
    // Reset and re-fetch whenever isPro changes (e.g. after upgrade)
    setInternships(null);
    setInternLoading(true);
    fetch('/api/internships').then(async r=>{
      const d=await r.json();
      if(r.status===403&&d.error==='pro_required'){
        setInternCount(d.count??0);
        setInternships(null);
      } else {
        setInternships(Array.isArray(d)?d:[]);
        if(typeof d.count==='number') setInternCount(d.length);
      }
      setInternLoading(false);
    }).catch(()=>{setInternships([]);setInternLoading(false);});
  },[tab,isPro]);
  // (no auto-prefill — show all internships by default)

  function goTab(t){if(t==='internships'&&!isPro){onUpgrade?.();return;}setTab(t);}
  async function runPrediction() {
    if (!predFrom || !predTo) return;
    setPredResult(null);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, from: predFrom, to: predTo }),
      });
      const json = await res.json();
      setPredResult(res.ok ? json : { error: json.error || 'Prediction failed' });
    } catch(e) {
      setPredResult({ error: 'Network error. Try again.' });
    }
  }

  const att=data?.attendance||[], marks=data?.marks||[];
  const tt=Array.isArray(data?.timetable)?data.timetable:[];
  const student=data?.student||{};
  const totC=att.reduce((s,c)=>s+(parseInt(c.conducted)||0),0);
  const totA=att.reduce((s,c)=>s+(parseInt(c.absent)||0),0);
  const overall=totC===0?0:Math.round((totC-totA)/totC*100);
  const ttByDay={};
  ['Day 1','Day 2','Day 3','Day 4','Day 5'].forEach(d=>{ttByDay[d]=[];});
  tt.forEach(p=>{if(ttByDay[p.day])ttByDay[p.day].push(p);});
  Object.values(ttByDay).forEach(a=>a.sort((x,y)=>x.period-y.period));
  const _td=new Date();
  const _tdInfo=getPlannerInfo(_td,plannerData);
  const todayOrd=_tdInfo?.order||null;
  const todayEvent=(_tdInfo&&!_tdInfo._weekend)?_tdInfo.event||null:null;
  const OC=dark?OC_DARK:OC_LIGHT;
  const pCol=(risk)=>risk==='danger'?'var(--red)':risk==='warning'?'var(--yellow)':'var(--green)';

  const NAV_ICONS={
    dashboard:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    attendance:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    marks:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    timetable:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
    calendar:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    internships:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><path d="M12 12h.01"/></svg>,
  };
  const NAV=[
    {k:'dashboard',l:'Home'},
    {k:'attendance',l:'Attendance'},
    {k:'marks',l:'Marks'},
    {k:'timetable',l:'Timetable'},
    {k:'calendar',l:'Calendar'},
    {k:'internships',l:'Internships'},
  ];

  // -- Loading screen --
  if(loading&&loginStartTime) return (
    <>
      <style>{getDashCSS(dark)}</style>
      <LoginProgress steps={LOGIN_STEPS} startTime={loginStartTime} dark={dark} isFirstLogin={isFirstLogin}/>
    </>
  );

  // -- Login --
  if(view==='login') return (
    <>
      <style>{getDashCSS(dark)}</style>
      <div className="auth-wrap">
        <div className="auth-grid"/>
        <div className="auth-card">
          <div className="auth-top">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div className="lmark">C</div>
              <span style={{fontFamily:'Playfair Display',fontSize:14,fontWeight:700}}>CampusHub</span>
            </div>
            <button className="ibt" onClick={()=>setDark(d=>!d)}>{dark?'☀':'☾'}</button>
          </div>
          <div className="auth-h">Welcome back</div>
          <div className="auth-sh">Sign in with your SRM academia credentials</div>
          <form onSubmit={handleLogin}>
            <div className="field"><label>SRM Email</label>
              <input type="email" placeholder="ab1234@srmist.edu.in" value={email}
                onChange={e=>setEmail(e.target.value)} autoComplete="email"/>
            </div>
            <div className="field"><label>Password</label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} placeholder="........" value={pass}
                  onChange={e=>setPass(e.target.value)} autoComplete="current-password" style={{paddingRight:42}}/>
                <button type="button" onClick={()=>setShowPass(s=>!s)} style={{
                  position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',color:'var(--text2)',fontSize:15,padding:0,lineHeight:1}}>
                  {showPass?'🙈':'👁'}
                </button>
              </div>
            </div>
            <button className="btn-p" type="submit" style={{width:'100%',marginTop:8}}>→ Sign in</button>
          </form>
          {error&&<div className="auth-err">⚠ {error}</div>}
          <div className="auth-note">Credentials are only used to log into academia.srmist.edu.in on your behalf and are never stored.</div>
          <button className="btn-g" style={{width:'100%',marginTop:8,fontSize:13}} onClick={()=>setView('landing')}>← Back to home</button>
        </div>
      </div>
    </>
  );

  // -- Captcha --
  if(view==='captcha') return (
    <>
      <style>{getDashCSS(dark)}</style>
      <div className="auth-wrap">
        <div className="auth-grid"/>
        <div className="auth-card">
          <div className="auth-top">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div className="lmark">C</div>
              <span style={{fontFamily:'Playfair Display',fontSize:14,fontWeight:700}}>CampusHub</span>
            </div>
            <button className="ibt" onClick={()=>setDark(d=>!d)}>{dark?'☀':'☾'}</button>
          </div>
          <div className="auth-h">One more step</div>
          <div className="auth-sh">Solve the CAPTCHA to continue</div>
          {capImg&&<img className="captcha-img" src={capImg} alt="captcha"/>}
          <form onSubmit={handleCaptcha}>
            <div className="field"><label>CAPTCHA Text</label>
              <input type="text" placeholder="Enter text from image" value={capSol}
                onChange={e=>setCapSol(e.target.value)} autoFocus/>
            </div>
            <button className="btn-p" type="submit" style={{width:'100%',marginTop:8}}>→ Verify</button>
          </form>
          {error&&<div className="auth-err">⚠ {error}</div>}
          <button className="btn-g" style={{width:'100%',marginTop:8,fontSize:13}}
            onClick={()=>{setView('login');setError('');}}>← Back</button>
        </div>
      </div>
    </>
  );

  // -- Dashboard shell --
  return (
    <>
      <style>{getDashCSS(dark)}</style>
      {dataLoading&&<div className="loading-bar-wrap"><div className="loading-bar" style={{width:'70%'}}/></div>}
      <div style={{position:'relative',minHeight:'100vh'}}>
        <div className="dash-bg"/><div className="dash-grid"/>

        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-logo">
            <div className="lmark">C</div>
            <span className="lname">Campus<span style={{color:'var(--text2)',fontWeight:400}}>Hub</span></span>
          </div>
          <div className="topbar-right">
            {(todayOrd||todayEvent)&&(
              <div className="today-badge" style={todayOrd?{background:OC[todayOrd]+'18',color:OC[todayOrd],border:'1px solid '+OC[todayOrd]+'30'}:{background:'rgba(34,209,122,.12)',color:'var(--green)',border:'1px solid rgba(34,209,122,.25)'}}>
                {todayOrd?'Day '+todayOrd:todayEvent||'Holiday'} · Today
              </div>
            )}
            {/* Combined refresh + live button */}
            <button className="btn-refresh" onClick={onManualRefresh} disabled={dataLoading} title="Refresh data">
              <span style={dataLoading?{display:'inline-block',animation:'spin .7s linear infinite'}:{}} className="refresh-icon">↻</span>
              <span className="refresh-inner">
                <span className="refresh-top">
                  {dataLoading?<span style={{color:'var(--accent)'}}>Updating...</span>:<span>Refresh</span>}
                </span>
                {lastUpdatedTs>0&&!dataLoading&&(
                  <span className="refresh-bottom">
                    <span className="live-dot"/>
                    <span className="live-lbl">Live</span>
                    <span className="live-time">{timeAgo(lastUpdatedTs)}</span>
                  </span>
                )}
              </span>
            </button>
            <button className="ibt" onClick={()=>setDark(d=>!d)} title={dark?'Light mode':'Dark mode'}>{dark?'☀':'☾'}</button>
            {/* Desktop sign out */}
            <button className="btn-signout" onClick={()=>setShowLogoutModal(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
            {/* Mobile sign out icon */}
            <button className="btn-signout-icon" onClick={()=>setShowLogoutModal(true)} title="Sign out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* DESKBAR */}
        <div className="deskbar">
          {NAV.map(({k,l})=>(
            <div key={k} className={'navit'+(tab===k?' on':'')} onClick={()=>goTab(k)}>
              <span style={{marginRight:5,display:'inline-flex',verticalAlign:'middle',width:13,height:13,opacity:.7}}>{NAV_ICONS[k]}</span>{l}
            </div>
          ))}
        </div>

        {/* PAGE */}
        <div className="page page-bot" key={tab}>
          {dataLoading&&!data?<SkeletonDash/>:(
            <>
              {/* DASHBOARD TAB */}
              {tab==='dashboard'&&(
                <>
                  <div className="pcard">
                    <div className="av">{(student.name||'S').charAt(0)}</div>
                    <div style={{minWidth:0,flex:1}}>
                      <div className="p-name">{student.name||'Student'}</div>
                      <div className="p-reg">{student.regNo}</div>
                      <div className="p-chips">
                        {[student.program,student.department,student.semester&&'Sem '+student.semester,student.batch&&'Batch '+student.batch].filter(Boolean).map(m=>(
                          <span key={m} className="chip">{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="home-grid">
                      {(()=>{
                      const totScored=marks.reduce((s,m)=>s+m.tests.reduce((a,t)=>a+(t.scored||0),0),0);
                      const totMax=marks.reduce((s,m)=>s+m.tests.reduce((a,t)=>a+t.maxMarks,0),0);
                      const todayCol=todayOrd?OC[todayOrd]:todayEvent?'var(--green)':'var(--text3)';
                      const todayVal=todayOrd?'Day '+todayOrd:todayEvent||'Holiday';
                      const overallCol=overall<75?'var(--red)':overall<80?'var(--yellow)':'var(--green)';
                      const openPredict=()=>{const t=new Date();const pad=n=>String(n).padStart(2,'0');const fmt=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());setPredFrom(fmt(t));const t2=new Date(t);t2.setDate(t2.getDate()+3);setPredTo(fmt(t2));setPredResult(null);setShowPredModal(true);};
                      const openWellness=()=>{if(!wellnessContent){fetch('/api/content?section=mental_health').then(r=>r.json()).then(d=>setWellnessContent(Array.isArray(d)?d:[])).catch(()=>setWellnessContent([]));}setShowWellnessModal(true);};
                      return (<>
                        <div className="scard scard--hero" style={{cursor:'pointer'}} onClick={()=>goTab('attendance')}>
                          <div className="scard-lbl">Overall Attendance</div>
                          <div className="scard-val" style={{color:overallCol}}>{overall}%</div>
                          <div className="scard-sub">{totC-totA} of {totC} classes attended</div>
                          <div className="scard-bar" style={{background:'linear-gradient(90deg,'+overallCol+',transparent)'}}/>
                        </div>
                        <div className="scard" style={{cursor:'pointer'}} onClick={()=>goTab('timetable')}>
                          <div className="scard-lbl">Today</div>
                          <div className="scard-val" style={{color:todayCol}}>{todayVal}</div>
                          <div className="scard-sub">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</div>
                          <div className="scard-bar" style={{background:'linear-gradient(90deg,'+todayCol+',transparent)'}}/>
                        </div>
                        <div className="scard" style={{cursor:'pointer'}} onClick={()=>goTab('marks')}>
                          <div className="scard-lbl">Internal Marks</div>
                          <div className="scard-val" style={{color:'var(--accent)'}}>{totMax>0?(totScored.toFixed(1)+' / '+totMax):'–'}</div>
                          <div className="scard-sub">across {marks.length} subjects</div>
                          <div className="scard-bar" style={{background:'linear-gradient(90deg,var(--accent),transparent)'}}/>
                        </div>
                        <div className="scard" style={{cursor:'pointer'}} onClick={()=>isPro?goTab('internships'):onUpgrade?.()}>
                          <div className="scard-lbl" style={{display:'flex',alignItems:'center',gap:5}}>
                            Internships
                            {!isPro&&<span style={{fontSize:10,lineHeight:1}}>🔒</span>}
                          </div>
                          <div className="scard-val" style={{color:isPro?'var(--acc2)':'var(--text3)'}}>
                            {internCount!==null?internCount:(internships!==null?internships.length:'–')}
                          </div>
                          <div className="scard-sub">{isPro?'tap to browse openings':'upgrade to access'}</div>
                          <div className="scard-bar" style={{background:isPro?'linear-gradient(90deg,var(--acc2),transparent)':'linear-gradient(90deg,var(--text3),transparent)'}}/>
                        </div>
                        <div className="scard scard--action" style={{cursor:'pointer',borderColor:'rgba(79,141,255,.28)',background:'rgba(79,141,255,.06)'}} onClick={openPredict}>
                          <div className="scard-lbl">Predict Attendance</div>
                          <div className="scard-act-ico">📊</div>
                          <div className="scard-cta">Check future impact →</div>
                          <div className="scard-bar" style={{background:'linear-gradient(90deg,var(--accent),transparent)'}}/>
                        </div>
                        <div className="scard scard--wide scard--wellness" style={{cursor:'pointer'}} onClick={openWellness}>
                          <div className="scard-wellness-row">
                            <div className="scard-wellness-txt">
                              <div className="scard-lbl">Mental Health &amp; Wellness</div>
                              <div className="scard-wellness-name">You’re not alone — support &amp; resources</div>
                              <div className="scard-sub">Explore tips, guides and stress management tools</div>
                            </div>
                            <div className="scard-wellness-ico">🌿</div>
                          </div>
                          <div className="scard-bar" style={{background:'linear-gradient(90deg,var(--green),transparent)'}}/>
                        </div>
                      </>);
                      })()}
                  </div>
                </>
              )}

              {/* ATTENDANCE TAB */}
              {tab==='attendance'&&(
                <>
                  <div className="seclbl">Attendance</div>
                  {att.length===0?<div className="empty">No data.</div>:(
                    <>
                      <div className="attlist">{att.map((c,i)=><AttCard key={i} c={c} pCol={pCol}/>)}</div>
                      <div className="attdesk card">
                        <div className="tw">
                          <table>
                            <thead><tr><th>Subject</th><th>Conducted</th><th>Absent</th><th>Attended</th><th>%</th><th>Margin / Need</th><th>Status</th></tr></thead>
                            <tbody>
                              {att.map((c,i)=>{
                                const {attended,pct,required,canSkip,risk}=calcStats(c.conducted,c.absent);
                                const col=pCol(risk),lbl=risk==='danger'?'At Risk':risk==='warning'?'Low':'Safe';
                                return(
                                  <tr key={i}>
                                    <td><div className="sn">{c.name||c.code}</div><div className="sc">{c.code} · {c.type}</div></td>
                                    <td style={{color:'var(--text2)',fontFamily:'Varela Round',fontSize:12}}>{c.conducted}</td>
                                    <td style={{color:'var(--red)',fontFamily:'Varela Round',fontSize:12}}>{c.absent}</td>
                                    <td style={{color:'var(--green)',fontFamily:'Varela Round',fontSize:12}}>{attended}</td>
                                    <td>
                                      <span style={{fontWeight:700,fontSize:12,color:col,fontFamily:'Varela Round'}}>{pct.toFixed(2)}%</span>
                                      <div className="mbar"><div className="mbar-mark"/><div className="mbar-fill" style={{width:Math.min(pct,100)+'%',background:col}}/></div>
                                    </td>
                                    <td>{risk==='danger'?<span style={{fontSize:12,fontWeight:700,color:'var(--red)'}}>Need {required}</span>:<span style={{fontSize:12,fontWeight:700,color:'var(--green)'}}>Skip {canSkip}</span>}</td>
                                    <td><span className="badge" style={{background:col+'15',color:col,border:'1px solid '+col+'30'}}>{lbl}</span></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* MARKS TAB */}
              {tab==='marks'&&(
                <>
                  <div className="seclbl">Internal Marks</div>
                  {marks.length===0?<div className="empty">No marks data.</div>:(
                    <div className="mgrid">
                      {marks.map((m,i)=>{
                        const attC=att.find(c=>c.code===m.code);
                        return(
                          <div key={i} className="mcard">
                            <div className="mcode">{m.code}</div>
                            {attC&&<div className="mname">{attC.name}</div>}
                            <div className="mtype">{m.type}</div>
                            {m.tests.length===0?<div style={{fontSize:11,color:'var(--text3)'}}>No marks yet</div>:(
                              <>
                                <MarksGraph tests={m.tests} dark={dark}/>
                                <div className="trow">
                                  {m.tests.map((t,j)=>(
                                    <div key={j} className="tpill">
                                      <div className="tpill-n">{t.name}</div>
                                      <div className="tpill-s" style={{color:t.scored===null?'var(--red)':'var(--green)'}}>{t.scored===null?'AB':t.scored}</div>
                                      <div className="tpill-m">/{t.maxMarks}</div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* TIMETABLE TAB */}
              {tab==='timetable'&&(
                <>
                  <div className="seclbl">Timetable</div>
                  {tt.length===0?<div className="empty">No timetable data.</div>:(
                    <>
                      <div className="dtabs">
                        {['Day 1','Day 2','Day 3','Day 4','Day 5'].map(d=>(
                          <button key={d} className={'dtab'+(activeDay===d?' on':'')} onClick={()=>setActiveDay(d)}>
                            {d}{todayOrd===parseInt(d.split(' ')[1])?' · Today':''}
                          </button>
                        ))}
                      </div>
                      <div className="plist">
                        {(ttByDay[activeDay]||[]).map((p,i)=>(
                          <div key={i} className={'prow'+(p.name?'':' free')}>
                            <span className="pnum">{p.period}</span>
                            <span className="ptime">{p.time}</span>
                            {p.name?(
                              <><div className="pname-wrap">
                                <span className="pname">{p.name}</span>
                                {p.faculty&&<span className="pfaculty">{p.faculty}</span>}
                                {p.room&&<span className="proom">{p.room}</span>}
                              </div>
                              <span className={'ptype '+(p.type==='Practical'?'pp':'pt')}>{p.type}</span></>
                            ):<span style={{fontSize:12,color:'var(--text3)',flex:1,fontStyle:'italic'}}>Free</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* CALENDAR TAB */}
              {tab==='calendar'&&(
                <>
                  <div className="seclbl">
                    Academic Calendar
                  </div>
                  <Calendar dark={dark} onSelectDay={d=>{setActiveDay(d);goTab('timetable');}} plannerData={plannerData} program={student.program}/>
                  {!plannerData&&<p style={{marginTop:8,fontSize:11,color:'var(--text3)',padding:'8px 12px',background:'var(--surf2)',borderRadius:7,border:'1px solid var(--border)'}}>
                    Calendar showing calculated day orders. Log in again to load official planner data.
                  </p>}
                  <p style={{marginTop:10,fontSize:11,color:'var(--text3)'}}>Tap any date to view that day's timetable.</p>
                  <div style={{marginTop:14}}>
                    <button className="pred-btn" onClick={()=>{const t=new Date();const pad=n=>String(n).padStart(2,'0');const fmt=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());setPredFrom(fmt(t));const t2=new Date(t);t2.setDate(t2.getDate()+3);setPredTo(fmt(t2));setPredResult(null);setShowPredModal(true);}}>
                      Predict Attendance
                    </button>
                  </div>
                </>
              )}

              {/* INTERNSHIPS TAB */}
              {tab==='internships'&&(()=>{
                // Non-pro: show upgrade wall
                if(!isPro&&!internLoading&&internships===null){
                  const cnt=internCount??0;
                  return(
                    <>
                      <div className="seclbl">Internships</div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                        justifyContent:'center',padding:'48px 24px',gap:16,textAlign:'center'}}>
                        <div style={{fontSize:48,lineHeight:1}}>🔒</div>
                        <div style={{fontSize:17,fontWeight:700,color:'var(--text)'}}>
                          {cnt>0?cnt+' internship'+(cnt===1?'':'s')+' available':'Internships available'}
                        </div>
                        <div style={{fontSize:13,color:'var(--text3)',maxWidth:280,lineHeight:1.6}}>
                          Upgrade to Pro to browse and apply to internship openings posted by companies.
                        </div>
                        <button onClick={onUpgrade} style={{padding:'12px 28px',borderRadius:10,border:'none',
                          background:'linear-gradient(135deg,#4f8dff,#7c5cfc)',color:'#fff',
                          fontSize:14,fontWeight:700,cursor:'pointer',transition:'opacity .15s'}}
                          onMouseOver={e=>e.currentTarget.style.opacity='.88'}
                          onMouseOut={e=>e.currentTarget.style.opacity='1'}>
                          Upgrade to Access →
                        </button>
                      </div>
                    </>
                  );
                }
                const allDepts=[...new Set((internships||[]).flatMap(i=>i.departments||[]))].sort();
                const filtered=(internships||[]).filter(i=>{
                  return !deptFilter||(i.departments||[]).some(d=>d.toLowerCase().includes(deptFilter.toLowerCase()));
                });
                return(
                  <>
                    <button className="guide-btn" onClick={()=>{if(!guideContent){Promise.all([fetch('/api/content?section=internship_guide_1').then(r=>r.json()).catch(()=>[]),fetch('/api/content?section=internship_guide_2').then(r=>r.json()).catch(()=>[])]).then(([r1,r2])=>setGuideContent([Array.isArray(r1)?r1:[],Array.isArray(r2)?r2:[]]));}setShowGuideModal(true);}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                      Internship Guide
                    </button>
                    <div className="seclbl">Internships</div>
                    <div className="int-filters">
                      <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}>
                        <option value="">All Departments</option>
                        {allDepts.map(d=><option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    {internLoading&&<div className="empty">Loading…</div>}
                    {!internLoading&&filtered.length===0&&<div className="empty">{internships?.length===0?'No internships posted yet.':'No results for selected filters.'}</div>}
                    <div className="int-list">
                      {filtered.map(i=>(
                        <div key={i.id} className="int-card" onClick={()=>setSelectedInternship(i)}>
                          <div className="int-card-top">
                            <div style={{flex:1,minWidth:0}}>
                              <div className="int-title">{i.title}</div>
                              <div className="int-company">
                                {i.company}{i.location?(' · '+i.location):''}
                                {(()=>{const m=(i.description||'').match(/^\[(.+?)\]/);return m?<span style={{color:'var(--text3)',opacity:.7}}> · {m[1]}</span>:null;})()}
                              </div>
                            </div>
                            {i.stipend&&<span className="int-stipend">{i.stipend}</span>}
                          </div>
                          <div className="int-tags">
                            {(i.departments||[]).slice(0,2).map(d=><span key={d} className="int-tag">{d}</span>)}
                            {i.deadline&&<span className="int-tag int-tag-dead">Due {new Date(i.deadline).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* MOBILE BOTTOM NAV */}
        <div className="bnav">
          <div className="bnav-inner">
            {NAV.map(({k,l})=>(
              <button key={k} className={'bni'+(tab===k?' on':'')} onClick={()=>goTab(k)}>
                <span className="bni-ico">{NAV_ICONS[k]}</span>
                <span className="bni-lbl">{l}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal&&(
        <div className="modal-overlay" onClick={()=>setShowLogoutModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">🚪</div>
            <div className="modal-title">Sign out?</div>
            <div className="modal-sub">You'll need to log in again to view your data.</div>
            <div className="modal-btns">
              <button className="modal-cancel" onClick={()=>setShowLogoutModal(false)}>Cancel</button>
              <button className="modal-signout" onClick={()=>{setShowLogoutModal(false);logout();}}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* INTERNSHIP DETAIL MODAL */}
      {selectedInternship&&(
        <div className="modal-overlay" onClick={()=>setSelectedInternship(null)}>
          <div className="int-detail-modal" onClick={e=>e.stopPropagation()}>
            <button className="int-modal-close" onClick={()=>setSelectedInternship(null)}>✕</button>
            <div className="int-modal-company">{selectedInternship.company}</div>
            <div className="int-modal-title">{selectedInternship.title}</div>
            {selectedInternship.location&&<div className="int-modal-meta">📍 {selectedInternship.location}</div>}
            {selectedInternship.stipend&&<div className="int-modal-meta">💰 {selectedInternship.stipend}</div>}
            {selectedInternship.deadline&&<div className="int-modal-meta">⏰ Deadline: {new Date(selectedInternship.deadline).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>}
            {selectedInternship.description&&(
              <div className="int-modal-section">
                <div className="int-modal-sh">About</div>
                <div className="int-modal-body">{selectedInternship.description}</div>
              </div>
            )}
            {(selectedInternship.departments||[]).length>0&&(
              <div className="int-modal-section">
                <div className="int-modal-sh">Departments</div>
                <div className="int-tags" style={{marginTop:4}}>{(selectedInternship.departments||[]).map(d=><span key={d} className="int-tag">{d}</span>)}</div>
              </div>
            )}
            {(selectedInternship.skills||[]).length>0&&(
              <div className="int-modal-section">
                <div className="int-modal-sh">Skills Required</div>
                <div className="int-tags" style={{marginTop:4}}>{(selectedInternship.skills||[]).map(s=><span key={s} className="int-tag int-tag-skill">{s}</span>)}</div>
              </div>
            )}
            {selectedInternship.applyLink&&(
              <a href={selectedInternship.applyLink} target="_blank" rel="noopener noreferrer" className="int-apply-btn">Apply Now →</a>
            )}
          </div>
        </div>
      )}

      {showPredModal&&(
        <div className="modal-overlay" onClick={()=>{setShowPredModal(false);setPredResult(null);}}>
          <div className="pred-modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:15}}>Attendance Predictor</div>
              <button className="int-modal-close" onClick={()=>{setShowPredModal(false);setPredResult(null);}}>✕</button>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,alignItems:'flex-end'}}>
              <div style={{flex:1,minWidth:120}}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,fontWeight:600}}>ABSENT FROM</div>
                <input type="date" value={predFrom} onChange={e=>setPredFrom(e.target.value)} style={{width:'100%',background:'var(--surf2)',border:'1px solid var(--border)',borderRadius:7,padding:'7px 10px',color:'var(--text)',fontSize:13}}/>
              </div>
              <div style={{flex:1,minWidth:120}}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,fontWeight:600}}>TO</div>
                <input type="date" value={predTo} onChange={e=>setPredTo(e.target.value)} style={{width:'100%',background:'var(--surf2)',border:'1px solid var(--border)',borderRadius:7,padding:'7px 10px',color:'var(--text)',fontSize:13}}/>
              </div>
              <button onClick={runPrediction} style={{padding:'8px 18px',borderRadius:8,border:'none',background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>Check</button>
            </div>
            {predResult?.error&&<div style={{fontSize:12,color:'var(--red)',marginTop:8,padding:'8px 12px',background:'rgba(255,92,92,.08)',borderRadius:7}}>{predResult.error}</div>}
            {predResult&&!predResult.error&&(
              <div>
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>
                  Working days absent: <strong style={{color:'var(--red)'}}>{predResult.days}</strong>
                  {predResult.days===0&&<span style={{color:'var(--text3)'}}> (all holidays/weekends in range)</span>}
                </div>
                <div style={{marginBottom:8,padding:'10px 12px',background:'var(--surf2)',borderRadius:8,border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:12,fontWeight:600}}>Overall</span>
                    <span style={{fontSize:13}}>
                      <span style={{color:overall<75?'var(--red)':overall<80?'var(--yellow)':'var(--green)'}}>{overall}%</span>
                      <span style={{color:'var(--text3)',margin:'0 5px'}}>→</span>
                      <span style={{color:predResult.predOverall<75?'var(--red)':predResult.predOverall<80?'var(--yellow)':'var(--green)',fontWeight:700}}>{predResult.predOverall}%</span>
                    </span>
                  </div>
                </div>
                <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {predResult.results.filter(c=>c.newA>0).map((c,i)=>{
                    const curPct=parseInt(c.conducted)>0?Math.round((parseInt(c.conducted)-parseInt(c.absent))/parseInt(c.conducted)*100):0;
                    const dangerNew=c.pPct<75;
                    return(
                      <div key={i} className="pred-row">
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.name||c.code}</div>
                          <div style={{fontSize:10,color:'var(--text3)'}}>-{c.newA} class{c.newA>1?'es':''}</div>
                        </div>
                        <div style={{fontSize:12,textAlign:'right',flexShrink:0}}>
                          <span style={{color:curPct<75?'var(--red)':curPct<80?'var(--yellow)':'var(--green)'}}>{curPct}%</span>
                          <span style={{color:'var(--text3)',margin:'0 4px'}}>→</span>
                          <span style={{color:dangerNew?'var(--red)':c.pPct<80?'var(--yellow)':'var(--green)',fontWeight:dangerNew?700:400}}>{c.pPct}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {predResult.results.filter(c=>c.newA>0).length===0&&<div style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:12}}>No classes affected (no timetable overlap).</div>}
                </div>
                <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:predResult.atRisk>0?'rgba(255,92,92,.1)':'rgba(34,209,122,.1)',border:'1px solid '+(predResult.atRisk>0?'rgba(255,92,92,.3)':'rgba(34,209,122,.3)')}}>
                  {predResult.atRisk>0
                    ? <span style={{color:'var(--red)',fontSize:12,fontWeight:600}}>⚠ {predResult.atRisk} subject{predResult.atRisk>1?'s':''} will drop below 75%</span>
                    : <span style={{color:'var(--green)',fontSize:12,fontWeight:600}}>Safe to skip — no subjects affected</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERNSHIP GUIDE MODAL */}
      {showGuideModal&&(
        <div className="modal-overlay" onClick={()=>setShowGuideModal(false)}>
          <div className="content-modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15}}>Internship Guide</div>
              <button className="int-modal-close" onClick={()=>setShowGuideModal(false)}>✕</button>
            </div>
            <GuideContent guideContent={guideContent}/>
          </div>
        </div>
      )}

      {/* WELLNESS MODAL */}
      {showWellnessModal&&(
        <div className="modal-overlay" onClick={()=>setShowWellnessModal(false)}>
          <div className="wellness-modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:16}}>Mental Health &amp; Wellness</div>
              <button className="int-modal-close" onClick={()=>setShowWellnessModal(false)}>✕</button>
            </div>
            <ContentList entries={wellnessContent}/>
          </div>
        </div>
      )}
    </>
  );
}