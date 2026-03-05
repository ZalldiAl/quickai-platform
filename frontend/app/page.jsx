import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'100vh', background:'#07080A',
      padding:'24px', textAlign:'center'
    }}>
      {/* Logo */}
      <div style={{
        width:64, height:64, background:'linear-gradient(135deg,#00C853,#00897B)',
        borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:32, marginBottom:24, boxShadow:'0 8px 32px rgba(0,200,83,0.3)'
      }}>⚡</div>

      {/* Title */}
      <h1 style={{
        fontSize:48, fontWeight:800, letterSpacing:'-1px', marginBottom:12,
        background:'linear-gradient(90deg,#00C853,#4AAFFF,#FF6B35)',
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        backgroundClip:'text'
      }}>ZalldiAI</h1>

      <p style={{ color:'#7A8090', fontSize:18, marginBottom:8, fontWeight:500 }}>
        Enterprise AI Commerce Platform
      </p>
      <p style={{ color:'#3A404E', fontSize:14, marginBottom:48 }}>
        Personalized · Fast · Embeddable
      </p>

      {/* Buttons */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center', marginBottom:64 }}>
        <Link href="/admin" style={{
          background:'linear-gradient(135deg,#00C853,#00897B)',
          color:'#07080A', fontWeight:800, padding:'14px 32px',
          borderRadius:12, textDecoration:'none', fontSize:15,
          boxShadow:'0 4px 20px rgba(0,200,83,0.3)'
        }}>
          Owner Admin Panel
        </Link>
        <Link href="/dashboard" style={{
          background:'#0F1115', border:'1px solid #1E2230',
          color:'#E8ECF4', fontWeight:700, padding:'14px 32px',
          borderRadius:12, textDecoration:'none', fontSize:15
        }}>
          Enterprise Dashboard
        </Link>
      </div>

      {/* Feature cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, maxWidth:480, width:'100%' }}>
        {[
          { icon:'🧠', label:'Orchestration Brain', desc:'Gemini + Groq routing' },
          { icon:'💬', label:'Built-in AI Chat',    desc:'Perplexity-style interface' },
          { icon:'📦', label:'Daily Catalog Upload', desc:'JSON product sync' },
          { icon:'🔌', label:'1-Line JS Embed',     desc:'Drop into any website' },
        ].map(f => (
          <div key={f.label} style={{
            background:'#0F1115', border:'1px solid #1E2230',
            borderRadius:14, padding:'20px 16px', textAlign:'center'
          }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{f.icon}</div>
            <div style={{ fontWeight:700, fontSize:13, color:'#E8ECF4', marginBottom:4 }}>{f.label}</div>
            <div style={{ fontSize:11, color:'#3A404E' }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div style={{
        marginTop:48, display:'flex', gap:12, alignItems:'center',
        background:'#0F1115', border:'1px solid #1E2230',
        borderRadius:40, padding:'10px 24px'
      }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#00C853', animation:'pulse-ring 1.5s ease infinite' }}/>
        <span style={{ fontSize:12, color:'#7A8090', fontFamily:'Space Mono, monospace' }}>
          Platform Online · Gemini + Groq Active
        </span>
      </div>
    </main>
  );
}