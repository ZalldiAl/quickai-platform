const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const supabase = require('../lib/supabase');

// ── Owner JWT Auth (admin routes) ────────────────────────────
function requireOwner(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Owner token required' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    if (payload.role !== 'owner') throw new Error('Not owner');
    req.owner = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired owner token' });
  }
}

// ── Enterprise Client API Key Auth ────────────────────────────
async function requireClient(req, res, next) {
  const apiKey =
    req.headers['x-client-key'] ||
    req.query.clientKey          ||
    req.body?.clientKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'Client API key required (X-Client-Key header)' });
  }

  const { data: client, error } = await supabase
    .from('enterprise_clients')
    .select('id, name, email, plan, is_active, monthly_limit, calls_used')
    .eq('api_key', apiKey)
    .single();

  if (error || !client) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  if (!client.is_active) {
    return res.status(403).json({ error: 'Client account is suspended' });
  }
  if (client.calls_used >= client.monthly_limit) {
    return res.status(429).json({ error: 'Monthly AI call limit reached. Upgrade your plan.' });
  }

  req.client = client;
  next();
}

// ── Owner OR Client (for shared routes) ──────────────────────
async function requireAuth(req, res, next) {
  const auth   = req.headers.authorization;
  const apiKey = req.headers['x-client-key'];

  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      req.authType = payload.role; // 'owner' or 'client'
      if (payload.role === 'client') req.client = payload;
      if (payload.role === 'owner')  req.owner  = payload;
      return next();
    } catch (e) { /* fall through */ }
  }

  if (apiKey) return requireClient(req, res, next);

  return res.status(401).json({ error: 'Authentication required' });
}

// ── Generate owner JWT ────────────────────────────────────────
function generateOwnerToken() {
  return jwt.sign(
    { role: 'owner', iat: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// ── Generate client JWT (after login) ────────────────────────
function generateClientToken(client) {
  return jwt.sign(
    { role: 'client', clientId: client.id, email: client.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Hash password ─────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
  requireOwner,
  requireClient,
  requireAuth,
  generateOwnerToken,
  generateClientToken,
  hashPassword,
};
