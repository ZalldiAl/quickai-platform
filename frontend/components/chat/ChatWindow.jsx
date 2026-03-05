'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { chat, catalog as catalogApi, getFingerprint } from '../../lib/api';
import MessageBubble  from './MessageBubble';
import ChatInput      from './ChatInput';
import ProductCard    from './ProductCard';

export default function ChatWindow({ clientKey, mode = 'embed' }) {
  const [sessionId,   setSessionId]   = useState(null);
  const [userId,      setUserId]      = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [products,    setProducts]    = useState([]);     // AI-recommended products
  const [catalog,     setCatalog]     = useState([]);
  const [cart,        setCart]        = useState([]);
  const [isTyping,    setIsTyping]    = useState(false);
  const [view,        setView]        = useState('chat'); // 'chat' | 'products' | 'cart'
  const [searchQuery, setSearchQuery] = useState('');
  const [initError,   setInitError]   = useState(null);
  const [initDone,    setInitDone]    = useState(false);
  const messagesEndRef = useRef(null);
  const historyRef     = useRef([]);

  // ── Init session ───────────────────────────────────────────
  useEffect(() => {
    if (!clientKey) return;
    initSession();
  }, [clientKey]);

  async function initSession() {
    try {
      const fp          = getFingerprint();
      const displayName = localStorage.getItem('qai_display_name') || undefined;
      const result      = await chat.startSession(clientKey, fp, displayName);

      setSessionId(result.sessionId);
      setUserId(result.userId);
      setProducts(result.recommendations || []);
      setInitDone(true);

      // Load catalog
      try {
        const catResult = await catalogApi.getActive();
        setCatalog(catResult.catalog || []);
      } catch (e) {}

      // Show greeting
      if (result.greeting) {
        const greetMsg = { role:'assistant', content: result.greeting, model:'groq', id: Date.now() };
        setMessages([greetMsg]);
        historyRef.current = [{ role:'assistant', content: result.greeting }];
      }
    } catch (e) {
      setInitError('Failed to connect. Please refresh.');
      setInitDone(true);
    }
  }

  // ── Scroll to bottom ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Send message ───────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isTyping || !sessionId) return;

    const userMsg = { role:'user', content: text, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    historyRef.current.push({ role:'user', content: text });
    setIsTyping(true);

    // Track search
    if (text.length > 2) {
      chat.track(clientKey, userId, 'search', { query: text }).catch(() => {});
    }

    try {
      const result = await chat.sendMessage(
        clientKey,
        sessionId,
        userId,
        text,
        historyRef.current.slice(-10)
      );

      const aiMsg = {
        role    : 'assistant',
        content : result.response,
        model   : result.model,
        intent  : result.intent,
        products: result.products || [],
        id      : Date.now() + 1,
      };

      setMessages(prev => [...prev, aiMsg]);
      historyRef.current.push({ role:'assistant', content: result.response });

      // Update product spotlight if response includes products
      if (result.products?.length) setProducts(result.products);
    } catch (e) {
      setMessages(prev => [...prev, {
        role:'assistant', content:'⚠️ Connection error. Please try again.', id: Date.now()+1
      }]);
    }
    setIsTyping(false);
  }, [isTyping, sessionId, userId, clientKey]);

  // ── Search products ────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setView('products');
    try {
      const result = await catalogApi.search(q);
      setCatalog(result.products || []);
    } catch (e) {}
  }, []);

  // ── Cart actions ───────────────────────────────────────────
  function addToCart(product) {
    if (cart.find(i => i.id === product.id)) return;
    setCart(prev => [...prev, { ...product, qty: 1 }]);
    chat.track(clientKey, userId, 'cart_add', { productId: product.id, brand: product.brand }).catch(() => {});
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(i => i.id !== productId));
  }

  async function placeOrder() {
    if (!cart.length) return;
    try {
      const result = await catalogApi.placeOrder(userId, sessionId, cart);
      setCart([]);
      setView('chat');
      sendMessage(`I just placed an order! Order ID: ${result.orderId}`);
    } catch (e) {
      sendMessage('I tried to place an order but got an error. Can you help?');
    }
  }

  // ── Quick prompts ──────────────────────────────────────────
  const quickPrompts = [
    "What's on offer today?",
    "Recommend something for me",
    "Show me fresh produce",
    "What are the best deals?",
  ];

  const cartTotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);

  if (!initDone) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-textsecond">
        <div className="flex gap-1.5"><div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/></div>
        <span className="text-xs">Connecting to QuickAI...</span>
      </div>
    </div>
  );

  if (initError) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-danger text-sm">{initError}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* HEADER */}
      <div className="bg-surface border-b border-[#1E2230] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00C853] to-emerald-700 flex items-center justify-center text-sm">⚡</div>
          <span style={{ color:'#E8ECF4', fontWeight:700, fontSize:14 }}>QuickAI</span>
          <div className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse-ring ml-1"/>
        </div>
        <div className="flex gap-1">
          {['chat','products','cart'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className="relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: view===v ? '#00C853' : '#151820', color: view===v ? '#07080A' : '#7A8090' }}>
              {v === 'cart' && cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B35] rounded-full text-[9px] flex items-center justify-center text-white font-bold">{cart.length}</span>
              )}
              {v === 'chat' ? '💬' : v === 'products' ? '🛒' : `🛍️`}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT VIEW */}
      {view === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.length === 0 && (
              <div className="text-center py-10" style={{ color:'#3A404E' }}>
                <div className="text-3xl mb-2">⚡</div>
                <div style={{ color:'#7A8090', fontSize:13 }}>Ask me anything about products or your order</div>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} onAddToCart={addToCart} catalog={catalog} />
            ))}
            {isTyping && (
              <div className="flex gap-2 items-end">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00C853] to-emerald-700 flex items-center justify-center text-sm flex-shrink-0">⚡</div>
                <div style={{ background:'#0F1115', border:'1px solid #1E2230' }} className="rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                  <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Quick prompts (only when no messages besides greeting) */}
          {messages.length <= 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none flex-shrink-0" style={{ borderTop:'1px solid #1E2230' }}>
              {quickPrompts.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  style={{ background:'#151820', border:'1px solid #1E2230', color:'#7A8090', whiteSpace:'nowrap', fontSize:12 }}
                  className="px-3 py-1.5 rounded-full flex-shrink-0 hover:border-[#00C853] hover:text-[#E8ECF4] transition-all">
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Pinned product recommendations */}
          {products.length > 0 && (
            <div style={{ background:'#0F1115', borderTop:'1px solid #1E2230' }} className="px-4 py-3 flex-shrink-0">
              <div style={{ fontSize:10, color:'#7A8090', letterSpacing:2, marginBottom:8, fontFamily:'Space Mono, monospace' }}>✦ FOR YOU</div>
              <div className="flex gap-2 overflow-x-auto">
                {products.slice(0,4).map(p => (
                  <div key={p.id} style={{ background:'#151820', border:'1px solid #1E2230', borderRadius:10, padding:'10px 12px', flexShrink:0, minWidth:120 }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{p.emoji || '📦'}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:'#E8ECF4', marginBottom:2 }}>{p.name?.slice(0,20)}</div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#00C853' }}>₹{p.price}</div>
                    <button onClick={() => addToCart(p)}
                      style={{ width:'100%', background:'#1C2130', border:'1px solid #1E2230', borderRadius:6, padding:'4px 0', fontSize:10, color:'#7A8090', marginTop:6, cursor:'pointer' }}
                      onMouseOver={e=>e.target.style.color='#00C853'} onMouseOut={e=>e.target.style.color='#7A8090'}>
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ChatInput onSend={sendMessage} disabled={isTyping} onSearch={doSearch} />
        </div>
      )}

      {/* PRODUCTS VIEW */}
      {view === 'products' && (
        <div className="flex-1 overflow-y-auto p-4">
          <input
            style={{ width:'100%', background:'#151820', border:'1px solid #1E2230', borderRadius:8, padding:'10px 14px', color:'#E8ECF4', fontSize:13, outline:'none', marginBottom:12 }}
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(searchQuery)}
          />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10 }}>
            {(catalog.length ? catalog : []).map(p => (
              <ProductCard key={p.id} product={p}
                onAdd={() => addToCart(p)}
                onView={() => chat.track(clientKey, userId, 'product_view', { productId: p.id, category: p.category }).catch(()=>{})}
              />
            ))}
            {!catalog.length && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'#3A404E', fontSize:13 }}>No products loaded</div>}
          </div>
        </div>
      )}

      {/* CART VIEW */}
      {view === 'cart' && (
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center py-16" style={{ color:'#3A404E' }}>
              <div className="text-5xl mb-3">🛒</div>
              <div style={{ fontSize:14, color:'#7A8090' }}>Your cart is empty</div>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {cart.map(item => (
                  <div key={item.id} style={{ background:'#0F1115', border:'1px solid #1E2230', borderRadius:10, padding:'12px 14px', display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ fontSize:22 }}>{item.emoji || '📦'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#E8ECF4' }}>{item.name}</div>
                      <div style={{ fontSize:12, color:'#00C853', marginTop:2 }}>₹{item.price}</div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} style={{ background:'none', border:'none', color:'#3A404E', cursor:'pointer', fontSize:16 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ background:'#151820', border:'1px solid #1E2230', borderRadius:12, padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:800, color:'#E8ECF4', marginBottom:14 }}>
                  <span>Total</span><span>₹{cartTotal}</span>
                </div>
                <button onClick={placeOrder}
                  style={{ width:'100%', background:'linear-gradient(135deg, #FF6B35, #FF8C00)', border:'none', borderRadius:8, padding:14, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                  ⚡ Place Order — 10 min delivery
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
