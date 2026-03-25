// pages/admin.js — Admin panel for managing internship listings
import { useState, useEffect, useRef } from 'react';

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biomedical Engineering',
  'Information Technology',
  'Chemical Engineering',
  'Aerospace Engineering',
  'Automobile Engineering',
  'Computer Science and Business Systems',
  'Artificial Intelligence and Data Science',
  'Cyber Security',
  'Software Engineering',
];

const BIO_DEPTS = ['Biomedical Engineering'];
const TECH_DEPTS = [
  'Computer Science and Engineering',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Cyber Security',
  'Software Engineering',
  'Computer Science and Business Systems',
];
const OTHER_DEPTS = [
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Aerospace Engineering',
  'Automobile Engineering',
];

function catToDepts(cat) {
  const c = (cat || '').toLowerCase().trim();
  if (c === 'bio') return BIO_DEPTS;
  if (c === 'tech') return TECH_DEPTS;
  return OTHER_DEPTS;
}

function extractCompany(headline) {
  const m = (headline || '').match(/ at (.+?)(\s*[|·\-]|$)/i) ||
            (headline || '').match(/ @ (.+?)(\s*[|·\-]|$)/i);
  return m ? m[1].trim() : '—';
}

const EMPTY_FORM = {
  title:'', company:'', description:'', departments:[],
  stipend:'', location:'', skills:'', deadline:'', applyLink:'',
};

function css(dark) {
  return `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',sans-serif;background:${dark?'#0a0a0a':'#f4f4f6'};color:${dark?'#e8e8e8':'#111'};min-height:100vh;}
  .wrap{max-width:1100px;margin:0 auto;padding:28px 20px;}
  @media(max-width:768px){.wrap{padding:16px 12px;}}

  /* TOP BAR */
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;gap:12px;flex-wrap:wrap;}
  .logo{font-size:22px;font-weight:800;letter-spacing:-.4px;}
  .logo span{color:#4f8dff;}
  .top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  @media(max-width:520px){.top{flex-direction:column;align-items:flex-start;}.top-actions{width:100%;}}

  /* HEADINGS */
  h2{font-size:17px;font-weight:700;margin-bottom:16px;}

  /* BUTTONS */
  .btn{padding:9px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;font-weight:600;transition:all .15s;white-space:nowrap;}
  .btn:hover{opacity:.85;transform:translateY(-1px);}
  .btn:active{transform:translateY(0);}
  .btn:disabled{opacity:.45;cursor:not-allowed;transform:none;}
  .btn-p{background:linear-gradient(135deg,#4f8dff,#3a6fd8);color:#fff;box-shadow:0 2px 8px rgba(79,141,255,.3);}
  .btn-g{background:${dark?'#1e1e1e':'#ebebeb'};color:${dark?'#bbb':'#444'};border:1px solid ${dark?'#2a2a2a':'#ddd'};}
  .btn-r{background:linear-gradient(135deg,#ff5c5c,#e03a3a);color:#fff;box-shadow:0 2px 8px rgba(255,92,92,.25);}
  .btn-sm{padding:6px 13px;font-size:12px;}
  .btn-xs{padding:4px 10px;font-size:11px;border-radius:7px;}

  /* STAT CARDS */
  .stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;}
  @media(max-width:640px){.stats-grid{grid-template-columns:1fr 1fr;}}
  @media(max-width:380px){.stats-grid{grid-template-columns:1fr;}}
  .stat-card{background:${dark?'#111':'#fff'};border:1px solid ${dark?'#1e1e1e':'#e0e0e0'};border-radius:14px;padding:18px 16px;cursor:pointer;transition:border-color .2s,transform .15s;}
  .stat-card:hover{border-color:#4f8dff44;transform:translateY(-2px);}
  .stat-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${dark?'#555':'#999'};margin-bottom:8px;}
  .stat-val{font-size:30px;font-weight:800;font-family:monospace;line-height:1;}
  .stat-sub{font-size:11px;color:${dark?'#444':'#aaa'};margin-top:5px;}

  /* CARD */
  .card{background:${dark?'#111':'#fff'};border:1px solid ${dark?'#1e1e1e':'#e0e0e0'};border-radius:14px;padding:20px;}

  /* FORM FIELDS */
  .field{margin-bottom:14px;}
  .field label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${dark?'#666':'#888'};margin-bottom:5px;}
  .field input,.field textarea,.field select{width:100%;background:${dark?'#161616':'#fafafa'};border:1px solid ${dark?'#252525':'#e0e0e0'};
    border-radius:9px;padding:9px 12px;color:${dark?'#e0e0e0':'#111'};font-size:13px;outline:none;font-family:inherit;transition:border-color .15s;}
  .field input:focus,.field textarea:focus,.field select:focus{border-color:#4f8dff;background:${dark?'#1a1a1a':'#fff'};}
  .field textarea{resize:vertical;min-height:80px;}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  @media(max-width:560px){.row{grid-template-columns:1fr;}}
  .check-group{display:flex;flex-wrap:wrap;gap:6px;}
  .check-item{display:flex;align-items:center;gap:5px;background:${dark?'#161616':'#f2f2f2'};
    border:1px solid ${dark?'#252525':'#e0e0e0'};border-radius:7px;padding:5px 10px;cursor:pointer;font-size:12px;transition:all .15s;}
  .check-item input{width:auto;margin:0;}
  .check-item.on{background:rgba(79,141,255,.12);border-color:rgba(79,141,255,.4);color:#4f8dff;}

  /* LIST ROWS */
  .intern-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
    padding:14px 16px;background:${dark?'#111':'#fff'};border:1px solid ${dark?'#1e1e1e':'#e8e8e8'};
    border-radius:12px;margin-bottom:8px;transition:border-color .15s;}
  .intern-row:hover{border-color:${dark?'#2a2a2a':'#d0d0d0'};}
  .intern-title{font-size:14px;font-weight:700;margin-bottom:3px;}
  .intern-meta{font-size:11px;color:${dark?'#666':'#999'};margin-top:2px;}
  .intern-actions{display:flex;gap:6px;flex-shrink:0;align-items:flex-start;}
  @media(max-width:480px){
    .intern-row{flex-direction:column;}
    .intern-actions{width:100%;justify-content:flex-end;margin-top:6px;}
  }

  /* SUBSCRIBER ROWS */
  .sub-row{display:flex;align-items:center;gap:12px;padding:12px 16px;
    margin-bottom:8px;border-radius:12px;border:1px solid ${dark?'#1e1e1e':'#e8e8e8'};
    background:${dark?'#111':'#fff'};transition:border-color .15s;}
  .sub-row:hover{border-color:${dark?'#2a2a2a':'#d0d0d0'};}
  .sub-email{font-size:13px;font-weight:600;word-break:break-all;}
  .sub-meta{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;}
  .badge-pro{font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700;background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.2);}
  .badge-free{font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700;background:${dark?'rgba(148,163,184,.08)':'rgba(0,0,0,.06)'};color:${dark?'#666':'#999'};}
  .sub-actions{display:flex;gap:8px;flex-shrink:0;margin-left:auto;}
  @media(max-width:520px){
    .sub-row{flex-direction:column;align-items:flex-start;}
    .sub-actions{width:100%;justify-content:flex-end;margin-left:0;}
  }

  /* CONTENT ROWS */
  .content-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
    padding:12px 14px;background:${dark?'#111':'#fff'};border:1px solid ${dark?'#1e1e1e':'#e8e8e8'};
    border-radius:11px;margin-bottom:8px;}
  .content-title{font-size:13px;font-weight:600;margin-bottom:2px;}
  .content-body{font-size:11px;color:${dark?'#777':'#999'};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .content-actions{display:flex;gap:6px;flex-shrink:0;}

  /* MISC */
  .empty{text-align:center;color:${dark?'#444':'#bbb'};padding:40px 20px;font-size:13px;}
  .err{color:#ff5c5c;font-size:12px;margin-bottom:10px;padding:8px 12px;background:rgba(255,92,92,.08);border-radius:8px;border:1px solid rgba(255,92,92,.2);}
  .import-status{font-size:12px;color:#4f8dff;margin-top:4px;}

  /* SECTION TABS */
  .section-tabs{display:flex;gap:4px;margin-bottom:22px;border-bottom:1px solid ${dark?'#1e1e1e':'#e8e8e8'};
    padding-bottom:0;overflow-x:auto;scrollbar-width:none;}
  .section-tabs::-webkit-scrollbar{display:none;}
  .stab{padding:9px 16px;border-radius:9px 9px 0 0;border:none;background:transparent;
    color:${dark?'#666':'#999'};font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;
    border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;}
  .stab:hover{color:${dark?'#aaa':'#555'};}
  .stab.on{color:#4f8dff;border-bottom-color:#4f8dff;background:${dark?'rgba(79,141,255,.06)':'rgba(79,141,255,.04)'};}

  /* MODALS */
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);
    display:flex;align-items:center;justify-content:center;padding:16px;z-index:100;}
  .modal-box{background:${dark?'#111':'#fff'};border:1px solid ${dark?'#222':'#e0e0e0'};
    border-radius:20px;padding:24px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;}
  @media(max-width:480px){.modal-box{padding:18px;border-radius:16px;}}
  .modal-title{font-size:17px;font-weight:700;margin-bottom:18px;}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid ${dark?'#1e1e1e':'#f0f0f0'};}

  /* LOGIN */
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
    background:${dark?'radial-gradient(ellipse at 50% 0%,rgba(79,141,255,.08) 0%,transparent 60%)':''}}
  .login-card{background:${dark?'#111':'#fff'};border:1px solid ${dark?'#1e1e1e':'#e0e0e0'};
    border-radius:20px;padding:36px 32px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,${dark?.4:.1});}
  @media(max-width:440px){.login-card{padding:24px 20px;}}
  .login-title{font-size:24px;font-weight:800;margin-bottom:4px;letter-spacing:-.3px;}
  .login-sub{font-size:13px;color:${dark?'#555':'#999'};margin-bottom:24px;}

  /* SECTION HEADER */
  .sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;}
  `;
}

export default function AdminPage() {
  const [dark] = useState(true);
  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [users, setUsers] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [subscribers, setSubscribers] = useState(null);
  const [subActionLoading, setSubActionLoading] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const odsInputRef = useRef(null);
  // Content management state
  const [activeSection,setActiveSection]=useState('internships');
  const [guideContent1,setGuideContent1]=useState([]);
  const [guideContent2,setGuideContent2]=useState([]);
  const [wellContent,setWellContent]=useState([]);
  const [showContentForm,setShowContentForm]=useState(null); // {section, editItem or null}
  const [contentForm,setContentForm]=useState({title:'',body:'',imageUrl:'',linkUrl:'',linkLabel:'',sortOrder:0});
  const [contentSaving,setContentSaving]=useState(false);
  const [contentErr,setContentErr]=useState('');

  useEffect(() => {
    const k = typeof window !== 'undefined' ? sessionStorage.getItem('adminKey') : '';
    if (k) { setAdminKey(k); fetchInternships(k); fetchUsers(k); fetchContent(k); fetchSubscribers(k); }
  }, []);

  async function fetchInternships(key) {
    setLoading(true);
    try {
      const r = await fetch('/api/internships');
      const d = await r.json();
      setInternships(Array.isArray(d) ? d : []);
    } catch { setInternships([]); }
    setLoading(false);
  }

  async function fetchUsers(key) {
    try {
      const r = await fetch('/api/admin/users', { headers: { 'x-admin-key': key } });
      const d = await r.json();
      setUsers(d);
    } catch { setUsers({ count: 0, emails: [] }); }
  }

  async function fetchSubscribers(key) {
    try {
      const r = await fetch('/api/admin/subscribers', { headers: { 'x-admin-key': key } });
      const d = await r.json();
      setSubscribers(d.subscribers || []);
    } catch { setSubscribers([]); }
  }

  async function handleSubAction(email, action) {
    setSubActionLoading(email + action);
    try {
      await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ email, action }),
      });
      await fetchSubscribers(adminKey);
    } catch {}
    setSubActionLoading('');
  }

  async function fetchContent(key) {
    const [r1,r2,r3] = await Promise.all([
      fetch('/api/content?section=internship_guide_1').then(r=>r.json()).catch(()=>[]),
      fetch('/api/content?section=internship_guide_2').then(r=>r.json()).catch(()=>[]),
      fetch('/api/content?section=mental_health').then(r=>r.json()).catch(()=>[]),
    ]);
    setGuideContent1(Array.isArray(r1)?r1:[]);
    setGuideContent2(Array.isArray(r2)?r2:[]);
    setWellContent(Array.isArray(r3)?r3:[]);
  }

  const SECTION_KEYS = { guide1:'internship_guide_1', guide2:'internship_guide_2', wellness:'mental_health' };

  function openContentForm(section,editItem){
    const sectionKey = SECTION_KEYS[section] || section;
    setShowContentForm({section:sectionKey,editItem});
    setContentErr('');
    if(editItem){
      setContentForm({title:editItem.title||'',body:editItem.body||'',imageUrl:editItem.imageUrl||'',linkUrl:editItem.linkUrl||'',linkLabel:editItem.linkLabel||'',sortOrder:editItem.sortOrder||0});
    } else {
      setContentForm({title:'',body:'',imageUrl:'',linkUrl:'',linkLabel:'',sortOrder:0});
    }
  }

  async function handleContentSave(e){
    e.preventDefault();
    setContentSaving(true);
    setContentErr('');
    try{
      const {section,editItem}=showContentForm;
      const method=editItem?'PUT':'POST';
      const url=editItem?'/api/content?id='+editItem.id:'/api/content';
      const r=await fetch(url,{method,headers:{'content-type':'application/json','x-admin-key':adminKey},body:JSON.stringify({...contentForm,section})});
      if(!r.ok){const d=await r.json();setContentErr(d.error||'Save failed');setContentSaving(false);return;}
      setShowContentForm(null);
      fetchContent(adminKey);
    }catch(err){setContentErr(err.message);}
    setContentSaving(false);
  }

  async function handleContentDelete(id){
    await fetch('/api/content?id='+id,{method:'DELETE',headers:{'x-admin-key':adminKey}});
    fetchContent(adminKey);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr('');
    const r = await fetch('/api/admin/verify', { method: 'POST', headers: { 'x-admin-key': keyInput } });
    if (r.status === 401) { setLoginErr('Invalid admin key.'); return; }
    if (!r.ok) { setLoginErr('Server error — check Railway is running.'); return; }
    sessionStorage.setItem('adminKey', keyInput);
    setAdminKey(keyInput);
    fetchInternships(keyInput);
    fetchUsers(keyInput);
    fetchContent(keyInput);
    fetchSubscribers(keyInput);
  }

  function openNew() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormErr('');
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      title: item.title || '',
      company: item.company || '',
      description: item.description || '',
      departments: item.departments || [],
      stipend: item.stipend || '',
      location: item.location || '',
      skills: (item.skills || []).join(', '),
      deadline: item.deadline || '',
      applyLink: item.applyLink || '',
    });
    setFormErr('');
    setShowForm(true);
  }

  function toggleArr(field, val) {
    setForm(f => {
      const arr = f[field] || [];
      return { ...f, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim()) { setFormErr('Title and company are required.'); return; }
    setSaving(true);
    setFormErr('');
    const body = {
      ...form,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      ...(editItem ? { id: editItem.id } : {}),
    };
    const method = editItem ? 'PUT' : 'POST';
    try {
      const r = await fetch('/api/internships', {
        method,
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); setFormErr(d.error || 'Save failed'); setSaving(false); return; }
      setShowForm(false);
      fetchInternships(adminKey);
    } catch (err) { setFormErr(err.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch('/api/internships?id=' + deleteId, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    setDeleteId(null);
    fetchInternships(adminKey);
  }

  async function handleOdsImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportStatus('Parsing file…');
    try {
      // Handle both CJS and ESM module shapes
      const xlsxMod = await import('xlsx');
      const XLSX = xlsxMod.default || xlsxMod;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      if (!wb.SheetNames.length) throw new Error('No sheets found in file');
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rows.length) throw new Error('Sheet is empty');
      setImportStatus(`Sheet has ${rows.length} rows, detecting format…`);

      // ── Format A: labels in column A, each column = one internship ──
      // Row n: "Text" | val1 | val2 | ...
      // Row n: "HeadLine" | title1 | title2 | ...
      const rowIdx = {};
      rows.forEach((row, i) => {
        const label = String(row[0] || '').trim().toLowerCase().replace(/\s+/g, '');
        if (label === 'text') rowIdx.text = i;
        else if (label === 'url') rowIdx.url = i;
        else if (label === 'time') rowIdx.time = i;
        else if (label === 'headline') rowIdx.headline = i;
        else if (label === 'category') rowIdx.category = i;
      });

      let internshipsToImport = [];

      if (rowIdx.headline !== undefined) {
        // Format A found
        const maxCols = rows.length > 0 ? Math.max(...rows.map(r => r.length)) : 0;
        for (let col = 1; col < maxCols; col++) {
          const title = String(rows[rowIdx.headline]?.[col] || '').trim();
          if (!title) continue;
          internshipsToImport.push({
            title,
            text:     String(rows[rowIdx.text]?.[col]     || '').trim(),
            url:      String(rows[rowIdx.url]?.[col]      || '').trim(),
            time:     String(rows[rowIdx.time]?.[col]     || '').trim(),
            category: String(rows[rowIdx.category]?.[col] || '').trim(),
          });
        }
      } else {
        // ── Format B: header row, each row = one internship ──
        // Row 0: HeadLine | Text | URL | Time | Category
        // Row 1: title1   | text1| url1| ...
        const headers = rows[0].map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, ''));
        const colOf = key => headers.findIndex(h => h === key || h.includes(key));
        const hI = colOf('headline'), tI = colOf('text'), uI = colOf('url'),
              tmI = colOf('time'), cI = colOf('category');

        if (hI === -1) throw new Error(
          `Could not find label rows or header columns.\n` +
          `First column values found: ${rows.slice(0,6).map(r=>JSON.stringify(r[0])).join(', ')}`
        );

        for (let row = 1; row < rows.length; row++) {
          const r = rows[row];
          const title = String(r[hI] || '').trim();
          if (!title) continue;
          internshipsToImport.push({
            title,
            text:     tI  >= 0 ? String(r[tI]  || '').trim() : '',
            url:      uI  >= 0 ? String(r[uI]  || '').trim() : '',
            time:     tmI >= 0 ? String(r[tmI] || '').trim() : '',
            category: cI  >= 0 ? String(r[cI]  || '').trim() : '',
          });
        }
      }

      setImportStatus(`Found ${internshipsToImport.length} internships, uploading…`);
      let success = 0;
      let firstError = '';

      for (const item of internshipsToImport) {
        setImportStatus(`Uploading ${success + 1}/${internshipsToImport.length}…`);
        const departments = catToDepts(item.category);
        const description = item.time ? `[${item.time}]\n\n${item.text}` : item.text;
        const company = extractCompany(item.title) || item.title.split(' ')[0] || 'Unknown';
        try {
          const r = await fetch('/api/internships', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
            body: JSON.stringify({ title: item.title, company, description, departments, semesters: [], skills: [], applyLink: item.url }),
          });
          if (r.ok) {
            success++;
          } else if (!firstError) {
            const d = await r.json().catch(() => ({}));
            firstError = `HTTP ${r.status}: ${d.error || 'unknown error'}`;
          }
        } catch (e) {
          if (!firstError) firstError = e.message;
        }
      }

      const statusMsg = firstError
        ? `Done — ${success}/${internshipsToImport.length} imported. First error: ${firstError}`
        : `Done — ${success}/${internshipsToImport.length} imported`;
      setImportStatus(statusMsg);
      fetchInternships(adminKey);
      setTimeout(() => setImportStatus(''), 6000);
    } catch (err) {
      setImportStatus('Error: ' + err.message);
      setTimeout(() => setImportStatus(''), 8000);
    }
    setImporting(false);
  }

  if (!adminKey) {
    return (
      <>
        <style>{css(dark)}</style>
        <div className="login-wrap">
          <div className="login-card">
            <div className="login-title">Admin Login</div>
            <div className="login-sub">Enter the admin key to manage internships.</div>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Admin Key</label>
                <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="••••••••" autoFocus/>
              </div>
              {loginErr && <div className="err">{loginErr}</div>}
              <button className="btn btn-p" style={{width:'100%',marginTop:4}} type="submit">Sign in →</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css(dark)}</style>
      <div className="wrap">
        <div className="top">
          <div className="logo">Campus<span>Hub</span> <span style={{fontWeight:400,fontSize:14,color:'#555'}}>Admin</span></div>
          <div className="top-actions">
            <button className="btn btn-p btn-sm" onClick={openNew}>+ New Internship</button>
            <div>
              <input ref={odsInputRef} type="file" accept=".ods,.obs,.xlsx,.xls,.csv" style={{display:'none'}} onChange={handleOdsImport}/>
              <button className="btn btn-g btn-sm" onClick={() => odsInputRef.current?.click()} disabled={importing}>
                {importing ? importStatus : '↑ Import ODS'}
              </button>
              {importStatus && !importing && <div className="import-status">{importStatus}</div>}
            </div>
            <button className="btn btn-g btn-sm" onClick={() => { sessionStorage.removeItem('adminKey'); setAdminKey(''); }}>Sign out</button>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="stats-grid">
          <div className="stat-card" onClick={()=>setShowUsers(true)}>
            <div className="stat-lbl">Total Users</div>
            <div className="stat-val" style={{color:'#4f8dff'}}>{users?.count??'–'}</div>
            <div className="stat-sub">click to view emails</div>
          </div>
          <div className="stat-card" style={{cursor:'default'}}>
            <div className="stat-lbl">Internship Listings</div>
            <div className="stat-val" style={{color:'#22d17a'}}>{internships.length}</div>
            <div className="stat-sub">active postings</div>
          </div>
          <div className="stat-card" onClick={()=>setActiveSection('subscribers')}>
            <div className="stat-lbl">Pro Subscribers</div>
            <div className="stat-val" style={{color:'#f59e0b'}}>
              {subscribers===null?'–':subscribers.filter(s=>s.isPro).length}
            </div>
            <div className="stat-sub">active pro users</div>
          </div>
        </div>

        <div className="section-tabs">
          <button className={'stab'+(activeSection==='internships'?' on':'')} onClick={()=>setActiveSection('internships')}>Internships</button>
          <button className={'stab'+(activeSection==='guide1'?' on':'')} onClick={()=>setActiveSection('guide1')}>Guide Topic 1</button>
          <button className={'stab'+(activeSection==='guide2'?' on':'')} onClick={()=>setActiveSection('guide2')}>Guide Topic 2</button>
          <button className={'stab'+(activeSection==='wellness'?' on':'')} onClick={()=>setActiveSection('wellness')}>Mental Health</button>
          <button className={'stab'+(activeSection==='subscribers'?' on':'')} onClick={()=>setActiveSection('subscribers')}>Subscribers</button>
        </div>

        {activeSection==='internships'&&(
        <>
        <div className="sec-header">
          <h2 style={{margin:0}}>Internship Listings ({internships.length})</h2>
        </div>
        {loading && <div className="empty">Loading…</div>}
        {!loading && internships.length === 0 && <div className="empty">No internships yet. Add one or import an ODS file!</div>}
        {internships.map(item => (
          <div key={item.id} className="intern-row">
            <div style={{flex:1,minWidth:0}}>
              <div className="intern-title">{item.title}</div>
              <div className="intern-meta">{item.company}{item.location ? ' · ' + item.location : ''}{item.stipend ? ' · ' + item.stipend : ''}</div>
              {item.deadline && <div className="intern-meta">Due: {new Date(item.deadline).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>}
            </div>
            <div className="intern-actions">
              <button className="btn btn-g btn-sm" onClick={() => openEdit(item)}>Edit</button>
              <button className="btn btn-r btn-sm" onClick={() => setDeleteId(item.id)}>Delete</button>
            </div>
          </div>
        ))}
        </>
        )}

        {/* SUBSCRIBERS SECTION */}
        {activeSection==='subscribers'&&(
          <>
            <div className="sec-header">
              <h2 style={{margin:0}}>Pro Subscribers <span style={{fontSize:13,fontWeight:400,color:'#888'}}>({subscribers===null?'…':subscribers.filter(s=>s.isPro).length} active / {subscribers===null?'…':subscribers.length} total)</span></h2>
              <button className="btn btn-g btn-sm" onClick={()=>fetchSubscribers(adminKey)}>↻ Refresh</button>
            </div>
            {subscribers===null&&<div className="empty">Loading…</div>}
            {subscribers!==null&&subscribers.length===0&&<div className="empty">No subscribers yet.</div>}
            {(subscribers||[]).map(s=>{
              const expiry=s.currentPeriodEnd?new Date(s.currentPeriodEnd).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):null;
              const grantBusy=subActionLoading===s.email+'grant';
              const revokeBusy=subActionLoading===s.email+'revoke';
              return(
                <div key={s.email} className="sub-row">
                  <div style={{flex:1,minWidth:0}}>
                    <div className="sub-email">{s.email}</div>
                    <div className="sub-meta">
                      <span className={s.isPro?'badge-pro':'badge-free'}>{s.isPro?'PRO':'FREE'}</span>
                      {expiry&&<span style={{fontSize:11,color:'#666'}}>Expires {expiry}</span>}
                    </div>
                  </div>
                  <div className="sub-actions">
                    {!s.isPro&&(
                      <button className="btn btn-p btn-sm" disabled={grantBusy}
                        onClick={()=>handleSubAction(s.email,'grant')}>
                        {grantBusy?'…':'Grant Pro'}
                      </button>
                    )}
                    {s.isPro&&(
                      <button className="btn btn-r btn-sm" disabled={revokeBusy}
                        onClick={()=>handleSubAction(s.email,'revoke')}>
                        {revokeBusy?'…':'Revoke'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <GrantNewUser adminKey={adminKey} onDone={()=>fetchSubscribers(adminKey)}/>
          </>
        )}

        {/* CONTENT SECTIONS — Guide + Wellness */}
        {activeSection!=='internships'&&activeSection!=='subscribers'&&(()=>{
          const sectionMap={'guide1':{label:'Internship Guide — Topic 1',data:guideContent1},'guide2':{label:'Internship Guide — Topic 2',data:guideContent2},'wellness':{label:'Mental Health & Wellness',data:wellContent}};
          const {label,data}=sectionMap[activeSection]||{};
          return(
            <>
              <div className="sec-header">
                <h2 style={{margin:0}}>{label}</h2>
                <button className="btn btn-p btn-sm" onClick={()=>openContentForm(activeSection,null)}>+ Add Entry</button>
              </div>
            {data.length===0&&<div className="empty">No entries yet. Add one!</div>}
            {data.map(e=>(
              <div key={e.id} className="content-row">
                <div style={{flex:1,minWidth:0}}>
                  {e.title&&<div className="content-title">{e.title}</div>}
                  {e.body&&<div className="content-body">{e.body}</div>}
                  {e.imageUrl&&<div style={{fontSize:11,color:'#4f8dff',marginTop:2}}>Has image</div>}
                  {e.linkUrl&&<div style={{fontSize:11,color:'#888',marginTop:2}}>Link: {e.linkLabel||e.linkUrl}</div>}
                </div>
                <div className="content-actions">
                  <button className="btn btn-g btn-sm" onClick={()=>openContentForm(activeSection,e)}>Edit</button>
                  <button className="btn btn-r btn-sm" onClick={()=>handleContentDelete(e.id)}>Delete</button>
                </div>
              </div>
            ))}
            </>
          );
        })()}
      </div>

      {/* CONTENT FORM MODAL */}
      {showContentForm&&(
        <div className="modal-bg" onClick={()=>setShowContentForm(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{showContentForm.editItem?'Edit Entry':'New Entry'}</div>
            <form onSubmit={handleContentSave}>
              <div className="field"><label>Title</label><input value={contentForm.title} onChange={e=>setContentForm(f=>({...f,title:e.target.value}))} placeholder="Section heading"/></div>
              <div className="field"><label>Body Text</label><textarea value={contentForm.body} onChange={e=>setContentForm(f=>({...f,body:e.target.value}))} placeholder="Main content…" style={{minHeight:100}}/></div>
              <div className="field"><label>Image URL</label><input value={contentForm.imageUrl} onChange={e=>setContentForm(f=>({...f,imageUrl:e.target.value}))} placeholder="https://example.com/image.jpg"/></div>
              <div className="row">
                <div className="field"><label>Link URL</label><input value={contentForm.linkUrl} onChange={e=>setContentForm(f=>({...f,linkUrl:e.target.value}))} placeholder="https://…"/></div>
                <div className="field"><label>Link Label</label><input value={contentForm.linkLabel} onChange={e=>setContentForm(f=>({...f,linkLabel:e.target.value}))} placeholder="Learn more"/></div>
              </div>
              <div className="field"><label>Sort Order</label><input type="number" value={contentForm.sortOrder} onChange={e=>setContentForm(f=>({...f,sortOrder:parseInt(e.target.value)||0}))} style={{width:80}}/></div>
              {contentErr&&<div className="err">{contentErr}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-g" onClick={()=>setShowContentForm(null)}>Cancel</button>
                <button type="submit" className="btn btn-p" disabled={contentSaving}>{contentSaving?'Saving…':(showContentForm.editItem?'Save Changes':'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editItem ? 'Edit Internship' : 'New Internship'}</div>
            <form onSubmit={handleSave}>
              <div className="row">
                <div className="field"><label>Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Software Engineering Intern"/></div>
                <div className="field"><label>Company *</label><input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} placeholder="Acme Corp"/></div>
              </div>
              <div className="field"><label>Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Role details, responsibilities…"/></div>
              <div className="row">
                <div className="field"><label>Stipend</label><input value={form.stipend} onChange={e=>setForm(f=>({...f,stipend:e.target.value}))} placeholder="₹15,000/month or Unpaid"/></div>
                <div className="field"><label>Location</label><input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Chennai / Remote"/></div>
              </div>
              <div className="row">
                <div className="field"><label>Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/></div>
                <div className="field"><label>Apply Link</label><input value={form.applyLink} onChange={e=>setForm(f=>({...f,applyLink:e.target.value}))} placeholder="https://…"/></div>
              </div>
              <div className="field"><label>Skills (comma-separated)</label><input value={form.skills} onChange={e=>setForm(f=>({...f,skills:e.target.value}))} placeholder="React, Python, SQL"/></div>
              <div className="field">
                <label>Eligible Departments</label>
                <div className="check-group">
                  {DEPARTMENTS.map(d => (
                    <div key={d} className={'check-item'+(form.departments.includes(d)?' on':'')} onClick={()=>toggleArr('departments',d)}>
                      <input type="checkbox" readOnly checked={form.departments.includes(d)}/> {d}
                    </div>
                  ))}
                </div>
              </div>
              {formErr && <div className="err">{formErr}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-g" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-p" disabled={saving}>{saving?'Saving…':(editItem?'Save Changes':'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div className="modal-bg" onClick={()=>setDeleteId(null)}>
          <div className="modal-box" style={{maxWidth:340}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Delete internship?</div>
            <p style={{fontSize:13,color:'#888',marginBottom:18}}>This cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-g" onClick={()=>setDeleteId(null)}>Cancel</button>
              <button className="btn btn-r" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* USERS MODAL */}
      {showUsers && (
        <div className="modal-bg" onClick={()=>setShowUsers(false)}>
          <div className="modal-box" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Registered Users ({users?.count ?? 0})</div>
            {(!users?.emails||users.emails.length===0)
              ? <p style={{fontSize:13,color:'#888'}}>No users yet.</p>
              : <div style={{maxHeight:400,overflowY:'auto',margin:'0 -4px'}}>
                  {(users.emails||[]).map((e,i)=>(
                    <div key={e} style={{
                      padding:'9px 4px',
                      borderBottom:'1px solid rgba(255,255,255,.06)',
                      fontSize:13,
                      display:'flex',
                      alignItems:'center',
                      gap:10,
                    }}>
                      <span style={{fontSize:10,color:'#555',minWidth:24,textAlign:'right'}}>{i+1}</span>
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
            }
            <div className="modal-footer">
              <button className="btn btn-g" onClick={()=>setShowUsers(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GrantNewUser({ adminKey, onDone }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function handle(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ email: email.trim(), action: 'grant' }),
      });
      const d = await r.json();
      if (r.ok) { setMsg('Pro granted to ' + email.trim()); setEmail(''); onDone(); }
      else setMsg('Error: ' + (d.error || 'unknown'));
    } catch { setMsg('Network error'); }
    setBusy(false);
  }
  return (
    <div style={{marginTop:20,padding:'18px 20px',borderRadius:12,border:'1px dashed rgba(79,141,255,.25)',background:'rgba(79,141,255,.03)'}}>
      <div style={{fontSize:11,fontWeight:700,color:'#4f8dff',marginBottom:12,textTransform:'uppercase',letterSpacing:'.08em'}}>Grant Pro to any user</div>
      <form onSubmit={handle} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-start'}}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="student@srmist.edu.in"
          style={{flex:'1 1 220px',minWidth:0,padding:'8px 12px',borderRadius:9,border:'1px solid rgba(79,141,255,.2)',
            background:'rgba(79,141,255,.05)',color:'inherit',fontSize:13,outline:'none'}}/>
        <button type="submit" className="btn btn-p btn-sm" disabled={busy} style={{flexShrink:0}}>{busy?'Granting…':'Grant Pro'}</button>
      </form>
      {msg&&<div style={{marginTop:10,fontSize:12,color:msg.startsWith('Error')?'#f87171':'#22d17a',fontWeight:500}}>{msg}</div>}
    </div>
  );
}
