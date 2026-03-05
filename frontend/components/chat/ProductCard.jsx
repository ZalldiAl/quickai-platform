'use client';

export default function ProductCard({ product: p, onAdd, onView }) {
  const savings = p.original_price > p.price ? p.original_price - p.price : 0;

  return (
    <div
      onClick={onView}
      style={{ background:'#0F1115', border:'1px solid #1E2230', borderRadius:12, padding:'14px 12px', cursor:'pointer', transition:'all .2s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor='#00C853'; e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseOut={e  => { e.currentTarget.style.borderColor='#1E2230'; e.currentTarget.style.transform='translateY(0)'; }}>

      <div style={{ fontSize:30, marginBottom:8, textAlign:'center' }}>{p.emoji || '📦'}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'#E8ECF4', marginBottom:3, lineHeight:1.3 }}>{p.name}</div>
      <div style={{ fontSize:10, color:'#7A8090', marginBottom:6 }}>{p.brand}</div>

      <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
        <span style={{ fontSize:14, fontWeight:800, color:'#00C853' }}>₹{p.price}</span>
        {p.original_price > p.price && (
          <span style={{ fontSize:10, color:'#3A404E', textDecoration:'line-through' }}>₹{p.original_price}</span>
        )}
      </div>
      {savings > 0 && <div style={{ fontSize:10, color:'#00C853', marginTop:2 }}>Save ₹{savings}</div>}

      <button
        onClick={e => { e.stopPropagation(); onAdd(); }}
        style={{ width:'100%', background:'#151820', border:'1px solid #1E2230', borderRadius:6, padding:'6px 0', fontSize:11, fontWeight:600, color:'#7A8090', cursor:'pointer', marginTop:8, transition:'all .2s' }}
        onMouseOver={e => { e.target.style.background='rgba(0,200,83,.1)'; e.target.style.borderColor='#00C853'; e.target.style.color='#00C853'; }}
        onMouseOut={e  => { e.target.style.background='#151820'; e.target.style.borderColor='#1E2230'; e.target.style.color='#7A8090'; }}>
        + Add to Cart
      </button>
    </div>
  );
}
