/**
 * QuickAI Embed Widget
 * ─────────────────────────────────────────────────────────────
 * Usage (enterprise client pastes this ONE line into their site):
 *
 *   <script src="https://your-app.vercel.app/embed.js"
 *           data-key="CLIENT_API_KEY"
 *           data-theme="light"
 *           data-position="bottom-right"
 *           async></script>
 *
 * Optional attributes:
 *   data-key       (required) - Enterprise client API key
 *   data-theme     - "dark" (default) | "light"
 *   data-position  - "bottom-right" (default) | "bottom-left"
 *   data-color     - Hex accent color, e.g. "#00C853"
 *   data-title     - Chat widget title, e.g. "ZeptoMart AI"
 *   data-logo      - URL to brand logo (optional)
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────
  const PLATFORM_URL = document.currentScript?.src
    ?.replace('/embed.js', '')
    || 'https://quickai.vercel.app';

  const script    = document.currentScript || document.querySelector('script[data-key]');
  const API_KEY   = script?.getAttribute('data-key');
  const THEME     = script?.getAttribute('data-theme')    || 'dark';
  const POSITION  = script?.getAttribute('data-position') || 'bottom-right';
  const ACCENT    = script?.getAttribute('data-color')    || '#00C853';
  const TITLE     = script?.getAttribute('data-title')    || 'QuickAI';

  if (!API_KEY) {
    console.warn('[QuickAI] Missing data-key attribute. Embed will not load.');
    return;
  }

  // ── Prevent double-init ───────────────────────────────────
  if (window.__QUICKAI_LOADED__) return;
  window.__QUICKAI_LOADED__ = true;

  // ── Colors ────────────────────────────────────────────────
  const BG      = THEME === 'light' ? '#FFFFFF' : '#07080A';
  const SURFACE = THEME === 'light' ? '#F5F5F7' : '#0F1115';
  const BORDER  = THEME === 'light' ? '#E5E5EA' : '#1E2230';
  const TEXT    = THEME === 'light' ? '#1A1A1A' : '#E8ECF4';

  // ── Position styles ────────────────────────────────────────
  const posStyle = POSITION === 'bottom-left'
    ? 'bottom:20px;left:20px;'
    : 'bottom:20px;right:20px;';

  // ── Inject CSS ────────────────────────────────────────────
  const css = `
    #qai-launcher {
      position:fixed;${posStyle}z-index:999999;
      width:56px;height:56px;border-radius:50%;
      background:linear-gradient(135deg,${ACCENT},${ACCENT}BB);
      border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      font-size:24px;box-shadow:0 4px 20px ${ACCENT}44;
      transition:transform .2s,box-shadow .2s;
      font-family:sans-serif;
    }
    #qai-launcher:hover { transform:scale(1.08); box-shadow:0 6px 28px ${ACCENT}66; }
    #qai-panel {
      position:fixed;${posStyle}z-index:999998;
      width:380px;height:600px;
      border-radius:20px;
      overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,.5);
      border:1px solid ${BORDER};
      transition:all .3s cubic-bezier(.34,1.56,.64,1);
      transform-origin: ${POSITION.includes('right') ? 'bottom right' : 'bottom left'};
    }
    #qai-panel.qai-hidden { transform:scale(.85);opacity:0;pointer-events:none; }
    #qai-panel iframe { width:100%;height:100%;border:none;display:block; }
    #qai-badge {
      position:absolute;top:-4px;${POSITION.includes('right')?'right:-4px':'left:-4px'};
      width:18px;height:18px;border-radius:50%;
      background:${ACCENT};
      display:flex;align-items:center;justify-content:center;
      font-size:9px;color:#07080A;font-weight:800;
      font-family:sans-serif;display:none;
    }
    @media(max-width:440px){
      #qai-panel { width:100vw;height:100vh;bottom:0!important;right:0!important;left:0!important;border-radius:0; }
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Create launcher button ────────────────────────────────
  const launcherWrap = document.createElement('div');
  launcherWrap.style.cssText = `position:fixed;${posStyle}z-index:999999;`;
  launcherWrap.innerHTML = `
    <button id="qai-launcher" title="Chat with ${TITLE}" aria-label="Open ${TITLE} chat">
      <span id="qai-icon-open">⚡</span>
      <span id="qai-icon-close" style="display:none">✕</span>
    </button>
    <span id="qai-badge"></span>
  `;
  document.body.appendChild(launcherWrap);

  // ── Create chat panel (iframe) ────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'qai-panel';
  panel.classList.add('qai-hidden');
  panel.innerHTML = `<iframe
    src="${PLATFORM_URL}/chat/${encodeURIComponent(API_KEY)}"
    title="${TITLE} Chat"
    allow="clipboard-write"
    loading="lazy"
  ></iframe>`;
  document.body.appendChild(panel);

  // ── Toggle logic ──────────────────────────────────────────
  let isOpen = false;

  function toggle() {
    isOpen = !isOpen;
    const iconOpen  = document.getElementById('qai-icon-open');
    const iconClose = document.getElementById('qai-icon-close');
    if (isOpen) {
      panel.classList.remove('qai-hidden');
      iconOpen.style.display  = 'none';
      iconClose.style.display = 'block';
    } else {
      panel.classList.add('qai-hidden');
      iconOpen.style.display  = 'block';
      iconClose.style.display = 'none';
    }
  }

  document.getElementById('qai-launcher').addEventListener('click', toggle);

  // ── Keyboard accessibility ────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) toggle();
  });

  // ── Message API (parent page can control widget) ──────────
  // Parent can call: window.QuickAI.open() / .close() / .toggle()
  window.QuickAI = {
    open  : () => { if (!isOpen) toggle(); },
    close : () => { if (isOpen)  toggle(); },
    toggle: toggle,
    setUnread: (count) => {
      const badge = document.getElementById('qai-badge');
      if (count > 0) { badge.style.display='flex'; badge.textContent=count; }
      else           { badge.style.display='none'; }
    },
  };

  // ── Auto-open after delay (optional) ──────────────────────
  const autoOpen = script?.getAttribute('data-auto-open');
  if (autoOpen) {
    setTimeout(() => { if (!isOpen) toggle(); }, parseInt(autoOpen) * 1000);
  }

})();
