const express  = require('express');
const router   = express.Router();
const { requireOwner, requireClient, generateOwnerToken, generateClientToken, hashPassword } = require('../middleware/auth');
const supabase = require('../lib/supabase');
const { v4: uuidv4 } = require('uuid');

// ── POST /api/clients/auth/owner-login ────────────────────────
router.post('/auth/owner-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email !== process.env.OWNER_EMAIL) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (hashPassword(password) !== process.env.OWNER_PASSWORD_HASH) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateOwnerToken();
    res.json({ token, role: 'owner' });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/clients/register ─ Owner creates enterprise client ──
router.post('/register', requireOwner, async (req, res) => {
  try {
    const { name, email, password, plan = 'starter', websiteUrl, industry } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password required' });
    }

    const { data, error } = await supabase
      .from('enterprise_clients')
      .insert({
        name,
        email,
        password_hash: hashPassword(password),
        plan,
        website_url  : websiteUrl,
        industry,
        monthly_limit: plan === 'starter' ? 10000 : plan === 'growth' ? 100000 : 999999,
      })
      .select('id, name, email, api_key, plan, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Email already registered' });
      throw new Error(error.message);
    }

    res.status(201).json({
      success : true,
      client  : { id: data.id, name: data.name, email: data.email, plan: data.plan },
      apiKey  : data.api_key,
      message : `✓ Enterprise client ${name} created. Share the API key with them.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/clients/auth/login ─ Client login ───────────────
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: client } = await supabase
      .from('enterprise_clients')
      .select('id, name, email, plan, is_active, api_key')
      .eq('email', email)
      .eq('password_hash', hashPassword(password))
      .single();

    if (!client) return res.status(401).json({ error: 'Invalid email or password' });
    if (!client.is_active) return res.status(403).json({ error: 'Account suspended. Contact support.' });

    const token = generateClientToken(client);
    res.json({
      token,
      client: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      apiKey: client.api_key,
    });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/clients/me ─ Client dashboard data ───────────────
router.get('/me', requireClient, async (req, res) => {
  try {
    const clientId = req.client.id;

    // Get full client info
    const { data: client } = await supabase
      .from('enterprise_clients')
      .select('id, name, email, plan, api_key, website_url, industry, monthly_limit, calls_used, created_at')
      .eq('id', clientId)
      .single();

    // Get user count
    const { count: userCount } = await supabase
      .from('end_users')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId);

    // Get message count (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: msgCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)
      .gte('created_at', thirtyDaysAgo);

    // Get active catalog info
    const { data: catalog } = await supabase
      .from('product_catalogs')
      .select('product_count, uploaded_at, filename')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    // Get brain status
    const { data: brain } = await supabase
      .from('brain_files')
      .select('filename, version, created_at')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    // Get total orders
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId);

    res.json({
      client,
      stats: {
        totalUsers   : userCount || 0,
        messagesMonth: msgCount  || 0,
        totalOrders  : orderCount || 0,
        callsUsed    : client.calls_used,
        callsRemaining: client.monthly_limit - client.calls_used,
        usagePercent : Math.round((client.calls_used / client.monthly_limit) * 100),
      },
      catalog: catalog || null,
      brain  : brain   || null,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ── GET /api/clients/embed-config ─ Get embed snippet config ─
router.get('/embed-config', requireClient, async (req, res) => {
  const backendUrl  = process.env.BACKEND_URL || `https://quickai-backend.up.railway.app`;
  const frontendUrl = process.env.FRONTEND_URL || `https://quickai.vercel.app`;

  res.json({
    clientId   : req.client.id,
    apiKey     : req.client.api_key,
    embedSnippet: `<script src="${frontendUrl}/embed.js" data-key="${req.client.api_key}" data-theme="light" async></script>`,
    standaloneUrl: `${frontendUrl}/chat/${req.client.id}`,
    iframeEmbed : `<iframe src="${frontendUrl}/chat/${req.client.id}" width="400" height="600" frameborder="0" allow="microphone"></iframe>`,
    apiDocs     : `${backendUrl}/api/docs`,
  });
});

// ── GET /api/clients/users ─ Client's end users ───────────────
router.get('/users', requireClient, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: users, count } = await supabase
      .from('end_users')
      .select(`
        id, display_name, email, last_seen, created_at,
        user_memory (total_sessions, total_messages, total_spent, behavior_summary, category_counts)
      `, { count: 'exact' })
      .eq('client_id', req.client.id)
      .order('last_seen', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    res.json({ users: users || [], total: count, page: parseInt(page) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// ── Admin: GET /api/clients/all ─ Owner sees all clients ──────
router.get('/all', requireOwner, async (req, res) => {
  try {
    const { data: clients } = await supabase
      .from('enterprise_clients')
      .select('id, name, email, plan, is_active, calls_used, monthly_limit, created_at, website_url')
      .order('created_at', { ascending: false });

    // Enrich with user counts
    const enriched = await Promise.all((clients || []).map(async c => {
      const { count: users }    = await supabase.from('end_users').select('*', { count: 'exact' }).eq('client_id', c.id);
      const { count: messages } = await supabase.from('chat_messages').select('*', { count: 'exact' }).eq('client_id', c.id);
      return { ...c, totalUsers: users || 0, totalMessages: messages || 0 };
    }));

    res.json({ clients: enriched });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

// ── Admin: PATCH /api/clients/:id ─ Toggle active, change plan ─
router.patch('/:id', requireOwner, async (req, res) => {
  try {
    const { is_active, plan } = req.body;
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (plan)                    updates.plan       = plan;

    await supabase.from('enterprise_clients').update(updates).eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
