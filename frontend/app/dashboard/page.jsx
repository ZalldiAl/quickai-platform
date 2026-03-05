'use client';
import { useState, useEffect } from 'react';
import { clients, catalog, brain, analytics, auth, setAuth, getToken, clearAuth } from '../../lib/api';
import { Upload, Code, Users, MessageSquare, Package, Brain, LogOut, RefreshCw, Copy, Check, BarChart2 } from 'lucide-react';

export default function DashboardPage() {
  const [authed,   setAuthed]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');
  const [me,       setMe]       = useState(null);
  const [embedCfg, setEmbedCfg] = useState(null);
  const [stats,    setStats]    = useState(null);
  const [users,    setUsers]    = useState([]);
  const [brainInfo, setBrainInfo] = useState(null);
  const [catalogHistory, setCatalogHistory] = useState([]);
  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [error,    setError]    = useState('');
  const [msg,      setMsg]      = useState('');
  const [copied,   setCopied]   = useState(null);
  const [catFile,  setCatFile]  = useState(null);
  const [brainFile, setBrainFile] = useState(null);
  const [brainText, setBrainText] = useState('');
  const [uploading, setUploading] = useState('');

  useEffect(() => {
    if (getToken() && localStorage.getItem('qai_role') === 'client') {
      setAuthed(true); loadAll();
    }
    setLoading(false);
  }, []);

  async function loadAll() {
    try {
      const [m, ec, st, us, bi, ch] = await Promise.all([
        clients.getMe(),
        clients.getEmbedConfig(),
        analytics.myStats(),
        clients.getUsers(1),
        brain.getClient(),
        catalog.getHistory(),
      ]);
      setMe(m); setEmbedCfg(ec); setStats(st);
      setUsers(us.users || []);
      setBrainInfo(bi.brain);
      if (bi.brain?.content) setBrainText(bi.brain.content);
      setCatalogHistory(ch.catalogs || []);
    } catch (e) { console.error(e); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const data = await auth.clientLogin(email, pass);
      setAuth(data.token, data.apiKey);
      localStorage.setItem('qai_role', 'client');
      setAuthed(true); loadAll();
    } catch (e) { setError(e.message); }
  }

  async function handleCatalogUpload(e) {
    e.preventDefault();
    if (!catFile) return;
    setUploading('catalog');
    try {
      const result = await catalog.upload(catFile);
      setMsg(result.message);
      loadAll();
    } catch (e) { setMsg('Error: ' + e.message); }
    setUploading('');
  }

  async function handleBrainUpload(e) {
    e.preventDefault();
    setUploading('brain');
    try {
      let result;
      if (brainFile) {
        result = await brain.uploadClient(brainFile);
      } else if (brainText.trim()) {
        const blob = new Blob([brainText], { type: 'text/plain' });
        const file = new File([blob], 'client-brain.txt', { type: 'text/plain' });
        result = await brain.uploadClient(file);
      }
      if (result) { setMsg(result.message); loadAll(); }
    } catch (e) { setMsg('Error: ' + e.message); }
    setUploading('');
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-textsecond">Loading...</div>;

  if (!authed) return (
    <div className="flex items-center justify-center min-h-screen bg-bg p-4">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-gradient-to-br from-accent to-emerald-700 rounded-xl flex items-center justify-center text-xl">⚡</div>
          <h1 className="text-xl font-extrabold">QuickAI</h1>
        </div>
        <p className="text-textsecond text-sm mb-6">Enterprise Dashboard</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-accent text-textprimary" type="email" placeholder="Your email" value={email} onChange={e=>setEmail(e.target.value)} required/>
          <input className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-accent text-textprimary" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} required/>
          {error && <p className="text-danger text-xs">{error}</p>}
          <button className="w-full bg-gradient-to-r from-accent to-emerald-700 text-bg font-bold py-3 rounded-lg text-sm">Sign In</button>
        </form>
      </div>
    </div>
  );

  const TABS = [
    { id:'overview', label:'Overview',  icon:<BarChart2 size={14}/> },
    { id:'catalog',  label:'Catalog',   icon:<Package size={14}/> },
    { id:'brain',    label:'My Brain',  icon:<Brain size={14}/> },
    { id:'embed',    label:'Embed',     icon:<Code size={14}/> },
    { id:'users',    label:'Users',     icon:<Users size={14}/> },
  ];

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* NAV */}
      <div className="bg-surface border-b border-border px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-accent to-emerald-700 rounded-lg flex items-center justify-center text-sm">⚡</div>
          <span className="font-bold text-sm">{me?.client?.name || 'Dashboard'}</span>
          {me?.client && <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{me.client.plan}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="text-textsecond hover:text-textprimary p-1.5"><RefreshCw size={14}/></button>
          <button onClick={() => { clearAuth(); setAuthed(false); }} className="text-textsecond hover:text-danger p-1.5"><LogOut size={14}/></button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-border bg-surface flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${tab===t.id?'border-accent text-accent':'border-transparent text-textsecond hover:text-textprimary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-5">
        {msg && <div className="mb-4 bg-accent/10 border border-accent/30 text-accent text-sm rounded-lg p-3">{msg}<button onClick={()=>setMsg('')} className="float-right text-textsecond">✕</button></div>}

        {/* OVERVIEW */}
        {tab === 'overview' && stats && me && (
          <div className="space-y-4 animate-fade-up">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l:'End Users',     v:stats.totalUsers,    c:'text-accent3' },
                { l:'Total Messages',v:stats.totalMessages, c:'text-accent' },
                { l:'Messages (7d)', v:stats.messages7d,    c:'text-warn' },
                { l:'Orders Placed', v:stats.totalOrders,   c:'text-accent2' },
              ].map(s => (
                <div key={s.l} className="bg-surface border border-border rounded-xl p-4">
                  <div className={`text-2xl font-extrabold ${s.c}`}>{s.v ?? 0}</div>
                  <div className="text-textsecond text-xs mt-1">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Usage bar */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-sm">API Usage This Month</span>
                <span className="font-mono text-xs text-textsecond">{me.stats?.callsUsed?.toLocaleString()} / {me.stats?.callsRemaining + me.stats?.callsUsed} calls</span>
              </div>
              <div className="h-2 bg-surface3 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${me.stats?.usagePercent > 80 ? 'bg-danger' : me.stats?.usagePercent > 60 ? 'bg-warn' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, me.stats?.usagePercent || 0)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-textsecond mt-1.5">
                <span>{me.stats?.usagePercent}% used</span>
                <span>{me.stats?.callsRemaining?.toLocaleString()} remaining</span>
              </div>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="text-xs text-textsecond mb-1">Active Catalog</div>
                {me.catalog ? (
                  <><div className="font-bold text-sm">{me.catalog.product_count} products</div>
                  <div className="text-xs text-textsecond mt-1">{new Date(me.catalog.uploaded_at).toLocaleDateString()}</div></>
                ) : <div className="text-danger text-sm font-semibold">Not uploaded today</div>}
              </div>
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="text-xs text-textsecond mb-1">My Brain</div>
                {me.brain ? (
                  <><div className="font-bold text-sm">v{me.brain.version} active</div>
                  <div className="text-xs text-textsecond mt-1">{new Date(me.brain.created_at).toLocaleDateString()}</div></>
                ) : <div className="text-textsecond text-sm">Using master brain only</div>}
              </div>
            </div>
          </div>
        )}

        {/* CATALOG */}
        {tab === 'catalog' && (
          <div className="space-y-4 animate-fade-up">
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-bold text-sm mb-1">📦 Upload Daily Product Catalog</h3>
              <p className="text-textsecond text-xs mb-4">Upload a JSON file each day. Previous catalog is replaced automatically.</p>

              {/* JSON format guide */}
              <div className="bg-surface2 border border-border rounded-lg p-3 mb-4 text-xs font-mono text-textsecond overflow-x-auto">
                <div className="text-accent mb-1">// Required JSON format:</div>
                {`[
  {
    "id":       "prod_001",      // required: unique ID
    "name":     "Organic Milk",  // required
    "price":    78,              // required: number
    "category": "Dairy",
    "brand":    "Amul Organic",
    "original_price": 95,        // for discount display
    "emoji":    "🥛",
    "tags":     ["organic","fresh"]
  }
]`}
              </div>

              <form onSubmit={handleCatalogUpload} className="space-y-3">
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${catFile ? 'border-accent bg-accent/5' : 'border-border hover:border-textsecond'}`}>
                  <Upload size={24} className={catFile ? 'text-accent' : 'text-textsecond'} />
                  <span className="text-sm mt-2">{catFile ? catFile.name : 'Click to upload catalog.json'}</span>
                  <span className="text-xs text-textsecond mt-1">JSON file, max 10MB</span>
                  <input type="file" accept=".json" className="hidden" onChange={e => setCatFile(e.target.files[0])} />
                </label>
                <button disabled={!catFile || uploading==='catalog'} className="w-full bg-gradient-to-r from-accent to-emerald-700 disabled:opacity-40 text-bg font-bold py-3 rounded-lg text-sm">
                  {uploading === 'catalog' ? 'Uploading...' : 'Upload Catalog'}
                </button>
              </form>
            </div>

            {/* Upload history */}
            {catalogHistory.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-5">
                <h4 className="font-bold text-sm mb-3">Upload History</h4>
                {catalogHistory.map(c => (
                  <div key={c.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                    <span className="text-textsecond text-xs font-mono">{c.filename}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-textsecond">{c.product_count} products</span>
                      <span className="text-xs text-textsecond">{new Date(c.uploaded_at).toLocaleDateString()}</span>
                      {c.is_active && <span className="text-accent text-xs bg-accent/10 px-2 py-0.5 rounded-full">Active</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BRAIN */}
        {tab === 'brain' && (
          <div className="space-y-4 animate-fade-up">
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-2"><Brain size={15} className="text-accent"/>Your AI Brain Override</h3>
              <p className="text-textsecond text-xs mb-4">This extends the master brain. Use it to define your brand tone, product rules, and specific instructions for your business.</p>
              <form onSubmit={handleBrainUpload} className="space-y-3">
                <textarea
                  className="w-full bg-surface2 border border-border rounded-lg p-4 text-sm font-mono text-textprimary outline-none focus:border-accent resize-y"
                  rows={10}
                  placeholder={`Your business-specific AI instructions...\n\nExample:\n=== BRAND NAME ===\nZeptoMart — premium quick commerce for Mumbai\n\n=== TONE ===\nFriendly, young, slightly casual.\nUse "bhai" occasionally for warmth.\n\n=== PRODUCT RULES ===\nAlways mention delivery time (10 minutes).\nHighlight organic products first.\n\n=== RESTRICTIONS ===\nDon't mention Blinkit or Swiggy Instamart.`}
                  value={brainText}
                  onChange={e => setBrainText(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 bg-surface2 border border-border rounded-lg px-4 py-2 text-sm text-textsecond cursor-pointer hover:border-accent transition-colors">
                    <Upload size={13}/> Upload .txt
                    <input type="file" accept=".txt" className="hidden" onChange={e=>{setBrainFile(e.target.files[0]);if(e.target.files[0]){const r=new FileReader();r.onload=ev=>setBrainText(ev.target.result);r.readAsText(e.target.files[0]);}}} />
                  </label>
                  <button type="submit" disabled={uploading==='brain'} className="bg-gradient-to-r from-accent to-emerald-700 disabled:opacity-40 text-bg font-bold px-6 py-2 rounded-lg text-sm">
                    {uploading==='brain' ? 'Uploading...' : 'Save Brain'}
                  </button>
                  {brainInfo && <span className="text-xs text-textsecond">v{brainInfo.version} active</span>}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EMBED */}
        {tab === 'embed' && embedCfg && (
          <div className="space-y-4 animate-fade-up">
            {[
              { label: '1-Line JS Embed (paste into your website <body>)', key: 'embed', value: embedCfg.embedSnippet, mono: true },
              { label: 'Standalone Chat URL (share with customers)', key: 'url', value: embedCfg.standaloneUrl, mono: false },
              { label: 'iFrame Embed', key: 'iframe', value: embedCfg.iframeEmbed, mono: true },
              { label: 'Your API Key', key: 'key', value: embedCfg.apiKey, mono: true },
            ].map(item => (
              <div key={item.key} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm">{item.label}</h4>
                  <button onClick={() => copyText(item.value, item.key)} className="flex items-center gap-1.5 text-xs text-textsecond hover:text-textprimary transition-colors">
                    {copied === item.key ? <Check size={13} className="text-accent"/> : <Copy size={13}/>}
                    {copied === item.key ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className={`bg-surface2 border border-border rounded-lg p-3 text-xs overflow-x-auto ${item.mono ? 'font-mono text-accent' : 'text-textprimary'}`}>
                  {item.value}
                </div>
              </div>
            ))}

            <div className="bg-surface2 border border-warn/30 rounded-xl p-4 text-xs text-textsecond">
              <span className="text-warn font-bold">⚠ Security:</span> Keep your API key private. The JS embed uses it to authenticate. Regenerate if compromised.
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div className="space-y-4 animate-fade-up">
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border font-bold text-sm">End Users ({users.length})</div>
              <div className="divide-y divide-border">
                {users.length === 0 && <div className="p-6 text-center text-textsecond text-sm">No users yet. Share your embed to get started.</div>}
                {users.map(u => (
                  <div key={u.id} className="p-4 hover:bg-surface2 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">{u.display_name || `User ${u.id.slice(-6)}`}</div>
                        <div className="text-xs text-textsecond mt-0.5">Last seen: {new Date(u.last_seen).toLocaleString()}</div>
                        {u.user_memory?.[0]?.behavior_summary && (
                          <div className="text-xs text-textsecond mt-1 italic">"{u.user_memory[0].behavior_summary.slice(0, 80)}..."</div>
                        )}
                      </div>
                      <div className="text-right text-xs text-textsecond">
                        <div>{u.user_memory?.[0]?.total_messages || 0} messages</div>
                        <div>₹{u.user_memory?.[0]?.total_spent || 0} spent</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
