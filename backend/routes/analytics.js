const express  = require('express');
const router   = express.Router();
const { requireOwner, requireClient } = require('../middleware/auth');
const supabase = require('../lib/supabase');

// ── GET /api/analytics/overview ─ Owner: full platform overview ──
router.get('/overview', requireOwner, async (req, res) => {
  try {
    const now           = new Date();
    const last30        = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last7         = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString();

    // Parallel queries
    const [
      { count: totalClients },
      { count: activeClients },
      { count: totalUsers },
      { count: totalMessages },
      { count: messages7d },
      { data: costData },
      { data: revenueData },
    ] = await Promise.all([
      supabase.from('enterprise_clients').select('*', { count: 'exact' }),
      supabase.from('enterprise_clients').select('*', { count: 'exact' }).eq('is_active', true),
      supabase.from('end_users').select('*', { count: 'exact' }),
      supabase.from('chat_messages').select('*', { count: 'exact' }),
      supabase.from('chat_messages').select('*', { count: 'exact' }).gte('created_at', last7),
      supabase.from('api_usage_logs').select('cost_usd, model').gte('created_at', last30),
      supabase.from('enterprise_clients').select('plan, calls_used, monthly_limit'),
    ]);

    // Calculate AI costs
    const totalCostUSD = (costData || []).reduce((s, r) => s + parseFloat(r.cost_usd || 0), 0);
    const geminiCost   = (costData || []).filter(r => r.model.includes('gemini')).reduce((s, r) => s + parseFloat(r.cost_usd || 0), 0);
    const groqCost     = (costData || []).filter(r => r.model.includes('groq'))  .reduce((s, r) => s + parseFloat(r.cost_usd || 0), 0);

    // Estimated revenue (SaaS pricing)
    const planRevenue = { starter: 299, growth: 899, enterprise: 2499 };
    const mrr = (revenueData || []).reduce((s, c) => s + (planRevenue[c.plan] || 0), 0);

    res.json({
      clients: { total: totalClients, active: activeClients },
      users  : { total: totalUsers },
      messages: { total: totalMessages, last7d: messages7d },
      costs  : {
        last30dUSD: totalCostUSD.toFixed(4),
        geminiUSD : geminiCost.toFixed(4),
        groqUSD   : groqCost.toFixed(4),
      },
      revenue: {
        mrrUSD  : mrr,
        profitUSD: (mrr - totalCostUSD).toFixed(2),
        margin  : mrr > 0 ? (((mrr - totalCostUSD) / mrr) * 100).toFixed(1) + '%' : '0%',
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

// ── GET /api/analytics/usage-daily ─ Daily usage chart data ──
router.get('/usage-daily', requireOwner, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('chat_messages')
      .select('created_at, client_id, ai_model')
      .gte('created_at', since)
      .eq('role', 'assistant')
      .order('created_at');

    // Group by day
    const byDay = {};
    (data || []).forEach(msg => {
      const day = msg.created_at.split('T')[0];
      if (!byDay[day]) byDay[day] = { date: day, total: 0, gemini: 0, groq: 0 };
      byDay[day].total++;
      if (msg.ai_model?.includes('gemini')) byDay[day].gemini++;
      if (msg.ai_model?.includes('groq'))   byDay[day].groq++;
    });

    res.json({ daily: Object.values(byDay) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load usage data' });
  }
});

// ── GET /api/analytics/clients/:id ─ Single client analytics ─
router.get('/clients/:clientId', requireOwner, async (req, res) => {
  try {
    const { clientId } = req.params;
    const last30       = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: users },
      { count: messages30d },
      { data: intentData },
      { data: topUsers },
      { count: orders },
    ] = await Promise.all([
      supabase.from('end_users').select('*', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('chat_messages').select('*', { count: 'exact' }).eq('client_id', clientId).gte('created_at', last30),
      supabase.from('chat_messages').select('intent').eq('client_id', clientId).gte('created_at', last30).not('intent', 'is', null),
      supabase.from('end_users').select(`
        id, display_name, last_seen,
        user_memory (total_messages, total_spent, behavior_summary)
      `).eq('client_id', clientId).order('last_seen', { ascending: false }).limit(5),
      supabase.from('orders').select('*', { count: 'exact' }).eq('client_id', clientId),
    ]);

    // Intent breakdown
    const intentCounts = {};
    (intentData || []).forEach(r => {
      if (r.intent) intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
    });

    res.json({
      users     : users || 0,
      messages30d,
      orders    : orders || 0,
      intentBreakdown: intentCounts,
      topUsers  : topUsers || [],
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load client analytics' });
  }
});

// ── GET /api/analytics/health ─ System health ────────────────
router.get('/health', requireOwner, async (req, res) => {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last 1hr

    const { data: logs } = await supabase
      .from('api_usage_logs')
      .select('model, success, latency_ms, cost_usd, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const total    = logs?.length || 0;
    const errors   = (logs || []).filter(l => !l.success).length;
    const avgLatency = total
      ? Math.round((logs || []).reduce((s, l) => s + (l.latency_ms || 0), 0) / total)
      : 0;

    const geminiLogs = (logs || []).filter(l => l.model.includes('gemini'));
    const groqLogs   = (logs || []).filter(l => l.model.includes('groq'));

    res.json({
      lastHour: {
        totalCalls  : total,
        errors,
        successRate : total ? (((total - errors) / total) * 100).toFixed(1) + '%' : '100%',
        avgLatencyMs: avgLatency,
      },
      gemini: {
        calls      : geminiLogs.length,
        avgLatency : geminiLogs.length ? Math.round(geminiLogs.reduce((s,l) => s+l.latency_ms,0)/geminiLogs.length) : 0,
        errors     : geminiLogs.filter(l=>!l.success).length,
      },
      groq: {
        calls      : groqLogs.length,
        avgLatency : groqLogs.length ? Math.round(groqLogs.reduce((s,l) => s+l.latency_ms,0)/groqLogs.length) : 0,
        errors     : groqLogs.filter(l=>!l.success).length,
      },
      status: errors / (total || 1) < 0.05 ? 'healthy' : errors / (total || 1) < 0.2 ? 'degraded' : 'critical',
    });
  } catch (e) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

// ── GET /api/analytics/users/:userId ─ Single user deep dive ─
router.get('/users/:userId', requireOwner, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user } = await supabase
      .from('end_users')
      .select('*, user_memory(*)')
      .eq('id', userId)
      .single();

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content, intent, ai_model, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: orders } = await supabase
      .from('orders')
      .select('id, items, subtotal, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ user, recentMessages: messages || [], orders: orders || [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load user data' });
  }
});

// ── GET /api/analytics/my-stats ─ Client's own analytics ─────
router.get('/my-stats', requireClient, async (req, res) => {
  try {
    const clientId = req.client.id;
    const last7    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: totalMessages },
      { count: messages7d },
      { count: totalOrders },
      { data: intentData },
    ] = await Promise.all([
      supabase.from('end_users').select('*', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('chat_messages').select('*', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('chat_messages').select('*', { count: 'exact' }).eq('client_id', clientId).gte('created_at', last7),
      supabase.from('orders').select('*', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('chat_messages').select('intent').eq('client_id', clientId).not('intent', 'is', null).limit(500),
    ]);

    const intentCounts = {};
    (intentData || []).forEach(r => {
      if (r.intent) intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
    });

    res.json({
      totalUsers, totalMessages, messages7d, totalOrders, intentCounts,
      usagePercent: Math.round((req.client.calls_used / req.client.monthly_limit) * 100),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
