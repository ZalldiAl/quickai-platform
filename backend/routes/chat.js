const express     = require('express');
const router      = express.Router();
const { requireClient } = require('../middleware/auth');
const orchestrator      = require('../services/orchestrator');
const memoryService     = require('../services/memory');
const supabase          = require('../lib/supabase');

// ── POST /api/chat/session ─ Start or resume a session ───────
router.post('/session', requireClient, async (req, res) => {
  try {
    const { fingerprint, displayName, email } = req.body;
    if (!fingerprint) return res.status(400).json({ error: 'fingerprint required' });

    const user = await memoryService.getOrCreateUser(
      fingerprint,
      req.client.id,
      { display_name: displayName, email }
    );

    // Create new chat session
    const { data: session } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, client_id: req.client.id })
      .select('id')
      .single();

    await memoryService.startNewSession(user.id, req.client.id);

    // Get personalized greeting
    const greeting = await orchestrator.generateSessionGreeting(
      req.client.id,
      user.id,
      req.client
    );

    // Load active catalog
    const { data: catalogRow } = await supabase
      .from('product_catalogs')
      .select('catalog_data, product_count')
      .eq('client_id', req.client.id)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    // Get AI product recommendations for this session
    let recommendations = [];
    if (catalogRow?.catalog_data) {
      const memory   = await memoryService.getMemory(user.id, req.client.id);
      const gemini   = require('../services/gemini');
      const recData  = await gemini.getProductRecommendations(
        req.client.id,
        buildUserProfile(memory),
        catalogRow.catalog_data,
        4
      );
      const recIds   = recData.recommendations?.map(r => r.id) || [];
      recommendations = catalogRow.catalog_data
        .filter(p => recIds.includes(p.id))
        .slice(0, 4);
    }

    res.json({
      sessionId      : session.id,
      userId         : user.id,
      greeting,
      recommendations,
      catalogCount   : catalogRow?.product_count || 0,
    });
  } catch (e) {
    console.error('[Chat/session]', e.message);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// ── POST /api/chat/message ─ Send a message ───────────────────
router.post('/message', requireClient, async (req, res) => {
  try {
    const { sessionId, userId, message, chatHistory = [] } = req.body;

    if (!sessionId || !userId || !message) {
      return res.status(400).json({ error: 'sessionId, userId, and message required' });
    }

    // Load active catalog
    const { data: catalogRow } = await supabase
      .from('product_catalogs')
      .select('catalog_data')
      .eq('client_id', req.client.id)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    const catalog = catalogRow?.catalog_data || [];

    // Orchestrate (the brain decides everything)
    const result = await orchestrator.orchestrate({
      clientId      : req.client.id,
      userId,
      userMessage   : message,
      chatHistory,
      catalog,
      clientContext : req.client,
    });

    // Save messages to DB
    await supabase.from('chat_messages').insert([
      {
        session_id: sessionId, client_id: req.client.id, user_id: userId,
        role: 'user', content: message, intent: result.intent,
      },
      {
        session_id: sessionId, client_id: req.client.id, user_id: userId,
        role: 'assistant', content: result.response,
        ai_model: result.model, intent: result.intent,
        products_mentioned: result.products?.map(p => p.id) || [],
        latency_ms: result.latencyMs,
      },
    ]);

    // Update session message count
    await supabase.rpc('increment_session_count', { session_id: sessionId })
      .catch(() => {}); // non-critical

    // Increment client usage counter
    await supabase
      .from('enterprise_clients')
      .update({ calls_used: req.client.calls_used + 1 })
      .eq('id', req.client.id);

    res.json({
      response  : result.response,
      model     : result.model,
      intent    : result.intent,
      products  : result.products,
      latencyMs : result.latencyMs,
    });

    // Async: refresh behavior summary every 10 messages
    const memory = await memoryService.getMemory(userId, req.client.id);
    if ((memory.total_messages || 0) % 10 === 0) {
      memoryService.refreshBehaviorSummary(userId, req.client.id);
    }
  } catch (e) {
    console.error('[Chat/message]', e.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// ── GET /api/chat/history/:sessionId ──────────────────────────
router.get('/history/:sessionId', requireClient, async (req, res) => {
  try {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content, ai_model, intent, products_mentioned, created_at')
      .eq('session_id', req.params.sessionId)
      .eq('client_id', req.client.id)
      .order('created_at', { ascending: true })
      .limit(50);

    res.json({ messages: messages || [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ── POST /api/chat/track ─ Track behavior events ──────────────
router.post('/track', requireClient, async (req, res) => {
  try {
    const { userId, event, data } = req.body;
    if (!userId || !event) return res.status(400).json({ error: 'userId and event required' });

    switch (event) {
      case 'product_view':
        await memoryService.trackProductView(userId, req.client.id, data.productId, data.category);
        break;
      case 'search':
        await memoryService.trackSearch(userId, req.client.id, data.query);
        break;
      case 'cart_add':
        await memoryService.trackCartAdd(userId, req.client.id, data.productId, data.brand);
        break;
      case 'purchase':
        await memoryService.trackPurchase(userId, req.client.id, data.items, data.total);
        break;
    }

    res.json({ tracked: true });
  } catch (e) {
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// ── Helper ────────────────────────────────────────────────────
function buildUserProfile(memory) {
  const topCats = Object.entries(memory.category_counts || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return [
    memory.inferred_persona || '',
    memory.dietary_notes    || '',
    topCats.length ? `Likes: ${topCats.join(', ')}` : '',
    memory.searches?.slice(0, 4).join(', ') || '',
  ].filter(Boolean).join('. ');
}

module.exports = router;
