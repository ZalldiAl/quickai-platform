'use client';

const MODEL_BADGE = {
  'gemini' : { label: '✦ Gemini', color: '#4AAFFF' },
  'groq'   : { label: '⚡ Groq',   color: '#FF6B35' },
  'demo'   : { label: '🧪 Demo',   color: '#7A8090' },
};

export default function MessageBubble({ message, onAddToCart, catalog = [] }) {
  const isUser = message.role === 'user';
  const badge  = MODEL_BADGE[message.model] || null;

  // Render inline product mentions
  const mentionedProducts = message.products?.length
    ? catalog.filter(p => message.products.some(mp => mp.id === p.id || mp.name === p.name))
    : [];

  return (
    <div style={{ display:'flex', gap:10, marginBottom:14, flexDirection: isUser ? 'row-reverse' : 'row', animation:'fadeUp .3s ease' }}>
      {/* Avatar */}
      <div style={{
        width:28, height:28, borderRadius:'50%', flexShrink:0,
        background: isUser
          ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
          : 'linear-gradient(135deg, #00C853, #00897B)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:13, marginTop:2,
      }}>
        {isUser ? '👤' : '⚡'}
      </div>

      <div style={{ maxWidth:'78%' }}>
        {/* Bubble */}
        <div style={{
          background: isUser ? '#151820' : '#0F1115',
          border: `1px solid ${isUser ? '#FF6B3522' : '#00C85322'}`,
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          padding: '11px 15px',
          fontSize: 13.5,
          lineHeight: 1.65,
          color: '#E8ECF4',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>

        {/* Inline product cards */}
        {!isUser && mentionedProducts.length > 0 && (
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            {mentionedProducts.slice(0,3).map(p => (
              <div key={p.id} style={{ background:'#151820', border:'1px solid #1E2230', borderRadius:10, padding:'8px 10px', minWidth:110 }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{p.emoji || '📦'}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'#E8ECF4', marginBottom:2 }}>{p.name?.slice(0,22)}</div>
                <div style={{ fontSize:12, fontWeight:800, color:'#00C853' }}>₹{p.price}</div>
                <button
                  onClick={() => onAddToCart(p)}
                  style={{ width:'100%', background:'#1C2130', border:'1px solid #1E2230', borderRadius:5, padding:'3px 0', fontSize:10, color:'#7A8090', marginTop:5, cursor:'pointer' }}>
                  + Cart
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:5 }}>
          <span style={{ fontSize:10, color:'#3A404E', fontFamily:'Space Mono, monospace' }}>
            {new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
          </span>
          {badge && !isUser && (
            <span style={{ fontSize:10, fontFamily:'Space Mono, monospace', color: badge.color, background: badge.color + '15', border: `1px solid ${badge.color}33`, borderRadius:4, padding:'1px 6px' }}>
              {badge.label}
            </span>
          )}
          {message.intent && !isUser && (
            <span style={{ fontSize:9, color:'#3A404E', fontFamily:'Space Mono, monospace', letterSpacing:1 }}>
              {message.intent}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
