const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ── Token helpers ─────────────────────────────────────────────
export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('qai_token');
}
export function getApiKey() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('qai_api_key');
}
export function setAuth(token, apiKey) {
  localStorage.setItem('qai_token', token);
  if (apiKey) localStorage.setItem('qai_api_key', apiKey);
}
export function clearAuth() {
  localStorage.removeItem('qai_token');
  localStorage.removeItem('qai_api_key');
  localStorage.removeItem('qai_role');
}

// ── Base fetch wrapper ─────────────────────────────────────────
async function apiFetch(path, options = {}, useApiKey = false) {
  const token  = getToken();
  const apiKey = getApiKey();

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token)               headers['Authorization'] = `Bearer ${token}`;
  if (useApiKey && apiKey) headers['X-Client-Key']  = apiKey;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  ownerLogin : (email, password) =>
    apiFetch('/api/clients/auth/owner-login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  clientLogin: (email, password) =>
    apiFetch('/api/clients/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
};

// ── Chat ──────────────────────────────────────────────────────
export const chat = {
  startSession: (clientKey, fingerprint, displayName) =>
    apiFetch('/api/chat/session', {
      method : 'POST',
      body   : JSON.stringify({ fingerprint, displayName }),
      headers: { 'X-Client-Key': clientKey },
    }),

  sendMessage: (clientKey, sessionId, userId, message, chatHistory) =>
    apiFetch('/api/chat/message', {
      method : 'POST',
      body   : JSON.stringify({ sessionId, userId, message, chatHistory }),
      headers: { 'X-Client-Key': clientKey },
    }),

  getHistory: (clientKey, sessionId) =>
    apiFetch(`/api/chat/history/${sessionId}`, {
      headers: { 'X-Client-Key': clientKey },
    }),

  track: (clientKey, userId, event, data) =>
    apiFetch('/api/chat/track', {
      method : 'POST',
      body   : JSON.stringify({ userId, event, data }),
      headers: { 'X-Client-Key': clientKey },
    }),
};

// ── Catalog ───────────────────────────────────────────────────
export const catalog = {
  getActive: () =>
    apiFetch('/api/catalog/active', {}, true),

  search: (q, category) =>
    apiFetch(`/api/catalog/search?q=${encodeURIComponent(q || '')}&category=${category || ''}`, {}, true),

  upload: async (file) => {
    const token  = getToken();
    const apiKey = getApiKey();
    const form   = new FormData();
    form.append('catalog', file);
    const res = await fetch(`${API}/api/catalog/upload`, {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Client-Key' : apiKey,
      },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  getHistory: () => apiFetch('/api/catalog/history', {}, true),

  placeOrder: (userId, sessionId, items) =>
    apiFetch('/api/catalog/order', {
      method : 'POST',
      body   : JSON.stringify({ userId, sessionId, items }),
    }, true),
};

// ── Brain ─────────────────────────────────────────────────────
export const brain = {
  uploadMaster: async (file) => {
    const token = getToken();
    const form  = new FormData();
    form.append('brain', file);
    const res = await fetch(`${API}/api/brain/master`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  getMaster  : () => apiFetch('/api/brain/master'),
  getMasterHistory: () => apiFetch('/api/brain/master/history'),

  uploadClient: async (file) => {
    const token  = getToken();
    const apiKey = getApiKey();
    const form   = new FormData();
    form.append('brain', file);
    const res = await fetch(`${API}/api/brain/client`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'X-Client-Key': apiKey },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  getClient: () => apiFetch('/api/brain/client', {}, true),
};

// ── Clients (owner) ───────────────────────────────────────────
export const clients = {
  getAll        : () => apiFetch('/api/clients/all'),
  register      : (data) => apiFetch('/api/clients/register', { method: 'POST', body: JSON.stringify(data) }),
  update        : (id, data) => apiFetch(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getMe         : () => apiFetch('/api/clients/me', {}, true),
  getEmbedConfig: () => apiFetch('/api/clients/embed-config', {}, true),
  getUsers      : (page) => apiFetch(`/api/clients/users?page=${page || 1}`, {}, true),
};

// ── Analytics ─────────────────────────────────────────────────
export const analytics = {
  overview    : () => apiFetch('/api/analytics/overview'),
  usageDaily  : (days) => apiFetch(`/api/analytics/usage-daily?days=${days || 14}`),
  clientStats : (clientId) => apiFetch(`/api/analytics/clients/${clientId}`),
  health      : () => apiFetch('/api/analytics/health'),
  userDeep    : (userId) => apiFetch(`/api/analytics/users/${userId}`),
  myStats     : () => apiFetch('/api/analytics/my-stats', {}, true),
};

// ── Browser fingerprint (anonymous user ID) ───────────────────
export function getFingerprint() {
  if (typeof window === 'undefined') return 'ssr';
  let fp = localStorage.getItem('qai_fp');
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('qai_fp', fp);
  }
  return fp;
}
