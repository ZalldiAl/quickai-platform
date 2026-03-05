const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../lib/supabase');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL  = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Helper: log usage
async function logUsage(clientId, useCase, inputTokens, outputTokens, latencyMs, success, errorMsg) {
  const costPer1k = parseFloat(process.env.COST_PER_GEMINI_1K_TOKENS || '0.000075');
  const totalTokens = inputTokens + outputTokens;
  await supabase.from('api_usage_logs').insert({
    client_id    : clientId,
    model        : 'gemini-1.5-flash',
    use_case     : useCase,
    tokens_input : inputTokens,
    tokens_output: outputTokens,
    cost_usd     : (totalTokens / 1000) * costPer1k,
    latency_ms   : latencyMs,
    success,
    error_msg    : errorMsg || null,
  }).catch(console.error);
}

// Helper: call Gemini
async function callGemini(prompt, maxTokens = 300, temperature = 0.8) {
  const model = genAI.getGenerativeModel({
    model,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  });
  const result = await model.generateContent(prompt);
  const response = result.response;
  return {
    text       : response.text(),
    inputTokens : response.usageMetadata?.promptTokenCount     || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
  };
}

// ── USE CASE 1: Personalized Chat Response ────────────────────
async function personalizedChat(clientId, systemContext, conversationHistory, userMessage) {
  const start = Date.now();
  try {
    // Build prompt with full conversation history
    const historyText = conversationHistory
      .slice(-8) // last 8 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `${systemContext}

CONVERSATION HISTORY:
${historyText}

User: ${userMessage}
Assistant:`;

    const result = await callGemini(prompt, 300, 0.8);
    await logUsage(clientId, 'chat', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'chat', 0, 0, Date.now() - start, false, e.message);
    throw e;
  }
}

// ── USE CASE 2: AI Product Recommendations ────────────────────
async function getProductRecommendations(clientId, userProfile, catalog, limit = 5) {
  const start = Date.now();
  try {
    const catalogSample = catalog.slice(0, 50).map(p =>
      `ID:${p.id} | ${p.name} | ${p.category} | ₹${p.price}`
    ).join('\n');

    const prompt = `You are a product recommendation engine for a quick commerce platform.

USER PROFILE:
${userProfile}

AVAILABLE PRODUCTS (catalog):
${catalogSample}

Return exactly ${limit} product IDs most relevant to this user. 
Respond ONLY as JSON: {"recommendations":[{"id":"p1","reason":"brief why"},...]}
No markdown, no extra text.`;

    const result = await callGemini(prompt, 200, 0.3);
    await logUsage(clientId, 'recommendations', result.inputTokens, result.outputTokens, Date.now() - start, true);

    const cleaned = result.text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    await logUsage(clientId, 'recommendations', 0, 0, Date.now() - start, false, e.message);
    return { recommendations: [] };
  }
}

// ── USE CASE 3: Cart Analysis & Upsell ───────────────────────
async function analyzeCart(clientId, userName, cartItems, userProfile) {
  const start = Date.now();
  try {
    const itemList = cartItems.map(i => `${i.name} ₹${i.price}`).join(', ');
    const prompt = `You are a smart cart assistant for a quick commerce app. 
User: ${userName}
Profile: ${userProfile}
Cart items: ${itemList}

Give a personalized 2-sentence cart insight for ${userName}. Include ONE specific upsell suggestion from their profile. Be warm and specific. Max 60 words.`;

    const result = await callGemini(prompt, 100, 0.7);
    await logUsage(clientId, 'cart_analysis', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'cart_analysis', 0, 0, Date.now() - start, false, e.message);
    return `Great cart! Your total looks good.`;
  }
}

// ── USE CASE 4: User Behavior Summary ────────────────────────
async function analyzeBehavior(clientId, userId, memoryData) {
  const start = Date.now();
  try {
    const prompt = `Analyze this e-commerce user's behavior and write a 2-sentence persona insight for a commerce AI system.

Data:
- Searches: ${memoryData.searches?.slice(0,8).join(', ')}
- Top categories: ${JSON.stringify(memoryData.category_counts)}
- Sessions: ${memoryData.total_sessions}, Spent: ₹${memoryData.total_spent}
- Viewed products: ${memoryData.viewed_products?.length || 0}

Write: "This user is [persona description]. They tend to [behavior pattern]."
Max 40 words. Only output the 2 sentences.`;

    const result = await callGemini(prompt, 80, 0.5);
    await logUsage(clientId, 'behavior_analysis', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'behavior_analysis', 0, 0, Date.now() - start, false, e.message);
    return null;
  }
}

// ── USE CASE 5: Smart Search Intent ──────────────────────────
async function parseSearchIntent(clientId, query, catalog) {
  const start = Date.now();
  try {
    const categories = [...new Set(catalog.map(p => p.category))].join(', ');
    const prompt = `Quick commerce search intent parser.
Available categories: ${categories}
User searched: "${query}"

Extract intent. Reply ONLY as JSON:
{"refined_query":"clean search term","category":"best matching category or null","intent":"PRODUCT_SEARCH|CATEGORY_BROWSE|DEAL_HUNT|REORDER"}
No markdown.`;

    const result = await callGemini(prompt, 60, 0.2);
    await logUsage(clientId, 'search_intent', result.inputTokens, result.outputTokens, Date.now() - start, true);
    const cleaned = result.text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    await logUsage(clientId, 'search_intent', 0, 0, Date.now() - start, false, e.message);
    return { refined_query: query, category: null, intent: 'PRODUCT_SEARCH' };
  }
}

module.exports = {
  personalizedChat,
  getProductRecommendations,
  analyzeCart,
  analyzeBehavior,
  parseSearchIntent,
};
