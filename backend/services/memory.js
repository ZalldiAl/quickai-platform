const supabase = require('../lib/supabase');
const gemini   = require('./gemini');

// ── Get or create user ────────────────────────────────────────
async function getOrCreateUser(fingerprint, clientId, metadata = {}) {
  // Try to find existing user
  let { data: user } = await supabase
    .from('end_users')
    .select('id, display_name, email, last_seen')
    .eq('fingerprint', fingerprint)
    .eq('client_id', clientId)
    .single();

  if (!user) {
    // Create new user
    const { data: newUser, error } = await supabase
      .from('end_users')
      .insert({ fingerprint, client_id: clientId, ...metadata })
      .select('id, display_name, email')
      .single();
    if (error) throw new Error('Failed to create user: ' + error.message);
    user = newUser;

    // Initialize empty memory
    await supabase.from('user_memory').insert({
      user_id  : user.id,
      client_id: clientId,
    });
  } else {
    // Update last seen
    await supabase
      .from('end_users')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', user.id);
  }

  return user;
}

// ── Get full memory ───────────────────────────────────────────
async function getMemory(userId, clientId) {
  const { data } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .single();

  return data || {};
}

// ── Track user message & update memory ───────────────────────
async function trackMessage(userId, clientId, message, intent) {
  const mem = await getMemory(userId, clientId);

  await supabase
    .from('user_memory')
    .update({
      total_messages: (mem.total_messages || 0) + 1,
      updated_at    : new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_id', clientId);
}

// ── Track product view ────────────────────────────────────────
async function trackProductView(userId, clientId, productId, category) {
  const mem = await getMemory(userId, clientId);

  const viewedProducts  = [...new Set([...(mem.viewed_products || []), productId])].slice(-50);
  const categoryCounts  = { ...(mem.category_counts || {}) };
  if (category) categoryCounts[category] = (categoryCounts[category] || 0) + 1;

  await supabase
    .from('user_memory')
    .update({ viewed_products: viewedProducts, category_counts: categoryCounts, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('client_id', clientId);
}

// ── Track search ──────────────────────────────────────────────
async function trackSearch(userId, clientId, query) {
  if (!query?.trim()) return;
  const mem = await getMemory(userId, clientId);
  const searches = [query, ...(mem.searches || []).filter(s => s !== query)].slice(0, 30);
  await supabase
    .from('user_memory')
    .update({ searches, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('client_id', clientId);
}

// ── Track cart add ────────────────────────────────────────────
async function trackCartAdd(userId, clientId, productId, brand) {
  const mem = await getMemory(userId, clientId);
  const addedToCart = [...new Set([...(mem.added_to_cart || []), productId])].slice(-30);
  const brandCounts = { ...(mem.brand_counts || {}) };
  if (brand) brandCounts[brand] = (brandCounts[brand] || 0) + 1;

  await supabase
    .from('user_memory')
    .update({ added_to_cart: addedToCart, brand_counts: brandCounts, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('client_id', clientId);
}

// ── Track purchase ────────────────────────────────────────────
async function trackPurchase(userId, clientId, orderItems, totalAmount) {
  const mem       = await getMemory(userId, clientId);
  const purchased = [...(mem.purchased_products || []), ...orderItems.map(i => i.product_id)].slice(-100);
  const newSpent  = (parseFloat(mem.total_spent) || 0) + totalAmount;
  const orders    = (mem.total_sessions || 1);
  const avgOrder  = newSpent / orders;

  await supabase
    .from('user_memory')
    .update({
      purchased_products: purchased,
      total_spent       : newSpent,
      avg_order_value   : avgOrder,
      updated_at        : new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_id', clientId);
}

// ── Update session count ──────────────────────────────────────
async function startNewSession(userId, clientId) {
  const mem = await getMemory(userId, clientId);
  await supabase
    .from('user_memory')
    .update({
      total_sessions: (mem.total_sessions || 0) + 1,
      updated_at    : new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_id', clientId);
}

// ── Refresh AI behavior summary (runs async, not blocking) ────
async function refreshBehaviorSummary(userId, clientId) {
  try {
    const mem     = await getMemory(userId, clientId);
    const summary = await gemini.analyzeBehavior(clientId, userId, mem);
    if (summary) {
      await supabase
        .from('user_memory')
        .update({ behavior_summary: summary, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('client_id', clientId);
    }
  } catch (e) {
    // Non-blocking — don't throw
    console.error('[Memory] Behavior refresh failed:', e.message);
  }
}

module.exports = {
  getOrCreateUser,
  getMemory,
  trackMessage,
  trackProductView,
  trackSearch,
  trackCartAdd,
  trackPurchase,
  startNewSession,
  refreshBehaviorSummary,
};
