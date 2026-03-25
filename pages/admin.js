// pages/admin.js — Admin panel for managing internship listings
import { useState, useEffect } from 'react';

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

const SEMESTERS = ['1','2','3','4','5','6','7','8'];

const EMPTY_FORM = {
  title:'', company:'', description:'', departments:[], semesters:[],
  stipend:'', location:'', skills:'', deadline:'', applyLink:'',
};

function css(dark) {
  return `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',sans-serif;background:${dark?'#0d0d0d':'#f5f5f5'};color:${dark?'#e8e8e8':'#111'};min-height:100vh;}
  .wrap{max-width:900px;margin:0 auto;padding:24px 16px;}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;}
  .logo{font-size:20px;font-weight:800;letter-spacing:-.3px;}
  .logo span{color:#4f8dff;}
  h2{font-size:18px;font-weight:700;margin-bottom:16px;}
  .btn{padding:9px 16px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:600;transition:opacity .15s;}
  .btn:hover{opacity:.85;}
  .btn-p{background:#4f8dff;color:#fff;}
  .btn-g{background:${dark?'#222':'#e8e8e8'};color:${dark?'#ccc':'#444'};}
  .btn-r{background:#ff5c5c;color:#fff;}
  .btn-sm{padding:6px 12px;font-size:12px;}
  .card{background:${dark?'#141414':'#fff'};border:1px solid ${dark?'#222':'#e0e0e0'};border-radius:14px;padding:20px;}
  .field{margin-bottom:14px;}
  .field label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${dark?'#888':'#666'};margin-bottom:5px;}
  .field input,.field textarea,.field select{width:100%;background:${dark?'#1a1a1a':'#f9f9f9'};border:1px solid ${dark?'#2a2a2a':'#e0e0e0'};
    border-radius:8px;padding:9px 11px;color:${dark?'#e0e0e0':'#111'};font-size:13px;outline:none;font-family:inherit;}
  .field input:focus,.field textarea:focus{border-color:#4f8dff;}
  .field textarea{resize:vertical;min-height:80px;}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  @media(max-width:600px){.row{grid-template-columns:1fr;}}
  .check-group{display:flex;flex-wrap:wrap;gap:6px;}
  .check-item{display:flex;align-items:center;gap:5px;background:${dark?'#1a1a1a':'#f2f2f2'};
    border:1px solid ${dark?'#2a2a2a':'#e0e0e0'};border-radius:7px;padding:4px 9px;cursor:pointer;font-size:12px;}
  .check-item input{width:auto;margin:0;}
  .check-item.on{background:rgba(79,141,255,.12);border-color:rgba(79,141,255,.4);color:#4f8dff;}
  .intern-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
    padding:14px 16px;background:${dark?'#141414':'#fff'};border:1px solid ${dark?'#222':'#e5e5e5'};
    border-radius:12px;margin-bottom:8px;}
  .intern-title{font-size:14px;font-weight:700;margin-bottom:2px;}
  .intern-meta{font-size:11px;color:${dark?'#888':'#888'};}
  .intern-actions{display:flex;gap:6px;flex-shrink:0;}
  .empty{text-align:center;color:${dark?'#555':'#aaa'};padding:32px;font-size:13px;}
  .err{color:#ff5c5c;font-size:13px;margin-bottom:10px;}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;padding:16px;z-index:100;}
  .modal-box{background:${dark?'#141414':'#fff'};border:1px solid ${dark?'#222':'#e0e0e0'};
    border-radius:18px;padding:24px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;}
  .modal-title{font-size:17px;font-weight:700;margin-bottom:18px;}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;}
  .login-card{background:${dark?'#141414':'#fff'};border:1px solid ${dark?'#222':'#e0e0e0'};
    border-radius:18px;padding:32px 28px;max-width:360px;width:100%;}
  .login-title{font-size:22px;font-weight:800;margin-bottom:4px;}
  .login-sub{font-size:13px;color:${dark?'#666':'#888'};margin-bottom:24px;}
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

  useEffect(() => {
    const k = typeof window !== 'undefined' ? sessionStorage.getItem('adminKey') : '';
    if (k) { setAdminKey(k); fetchInternships(k); fetchUsers(k); }
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

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr('');
    // Validate key by making a test POST with intentionally invalid body (will fail 400, not 401)
    const r = await fetch('/api/internships', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': keyInput },
      body: JSON.stringify({}),
    });
    if (r.status === 401) { setLoginErr('Invalid admin key.'); return; }
    // 400 = key valid but missing fields — that's fine, means key is correct
    sessionStorage.setItem('adminKey', keyInput);
    setAdminKey(keyInput);
    fetchInternships(keyInput);
    fetchUsers(keyInput);
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
      semesters: item.semesters || [],
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
          <div className="logo">Campus<span>Hub</span> Admin</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-p btn-sm" onClick={openNew}>+ New Internship</button>
            <button className="btn btn-g btn-sm" onClick={() => { sessionStorage.removeItem('adminKey'); setAdminKey(''); }}>Sign out</button>
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
          <div className="card" style={{flex:'1 1 160px',cursor:'pointer',minWidth:140}} onClick={()=>setShowUsers(true)}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'#888',marginBottom:6}}>Total Users</div>
            <div style={{fontSize:28,fontWeight:800,color:'#4f8dff',fontFamily:'monospace'}}>{users?.count??'–'}</div>
            <div style={{fontSize:11,color:'#666',marginTop:3}}>click to view all emails</div>
          </div>
          <div className="card" style={{flex:'1 1 160px',minWidth:140}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'#888',marginBottom:6}}>Internship Listings</div>
            <div style={{fontSize:28,fontWeight:800,color:'#22d17a',fontFamily:'monospace'}}>{internships.length}</div>
            <div style={{fontSize:11,color:'#666',marginTop:3}}>active postings</div>
          </div>
        </div>

        <h2>Internship Listings ({internships.length})</h2>

        {loading && <div className="empty">Loading…</div>}
        {!loading && internships.length === 0 && <div className="empty">No internships yet. Add one!</div>}
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
      </div>

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
              <div className="field">
                <label>Eligible Semesters</label>
                <div className="check-group">
                  {SEMESTERS.map(s => (
                    <div key={s} className={'check-item'+(form.semesters.includes(s)?' on':'')} onClick={()=>toggleArr('semesters',s)}>
                      <input type="checkbox" readOnly checked={form.semesters.includes(s)}/> Sem {s}
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
