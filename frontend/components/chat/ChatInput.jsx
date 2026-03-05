'use client';
import { useState, useRef } from 'react';

export default function ChatInput({ onSend, disabled, onSearch }) {
  const [value, setValue] = useState('');
  const textareaRef       = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(text);
  }

  function handleInput(e) {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  }

  return (
    <div style={{ padding:'10px 14px', borderTop:'1px solid #1E2230', background:'#0F1115', display:'flex', gap:8, flexShrink:0 }}>
      <textarea
        ref={textareaRef}
        style={{
          flex:1, background:'#151820', border:'1px solid #1E2230',
          borderRadius:12, padding:'11px 14px', color:'#E8ECF4',
          fontSize:13, outline:'none', resize:'none', maxHeight:100,
          fontFamily:'Plus Jakarta Sans, sans-serif', lineHeight:1.5,
          transition:'border-color .2s',
        }}
        placeholder="Ask about products, deals, or your order..."
        rows={1}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        onFocus={e => e.target.style.borderColor = '#00C853'}
        onBlur={e  => e.target.style.borderColor = '#1E2230'}
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
        style={{
          background: 'linear-gradient(135deg, #00C853, #00897B)',
          border:'none', borderRadius:10, width:42, height:42,
          cursor: (!value.trim() || disabled) ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:20, flexShrink:0, alignSelf:'flex-end',
          opacity: (!value.trim() || disabled) ? .4 : 1,
          transition:'opacity .2s',
          color:'#07080A',
        }}>
        ↑
      </button>
    </div>
  );
}
