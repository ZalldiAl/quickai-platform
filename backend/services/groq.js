const Groq     = require('groq-sdk');
const supabase = require('../lib/supabase');

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

async function logUsage(clientId, useCase, inputTokens, outputTokens, latencyMs, success, errorMsg) {
  const costPer1k = parseFloat(process.env.COST_PER_GROQ_1K_TOKENS || '0.000005');
  await supabase.from('api_usage_logs').insert({
    client_id    : clientId,
    model        : 'groq-llama-3.1',
    use_case     : useCase,
    tokens_input : inputTokens,
    tokens_output: outputTokens,
    cost_usd     : ((inputTokens + outputTokens) / 1000) * costPer1k,
    latency_ms   : latencyMs,
    success,
    error_msg    : errorMsg || null,
  }).catch(console.error);
}

async function callGroq(systemMsg, userMsg, maxTokens = 150, temperature = 0.7) {
  const completion = await groq.chat.completions.create({
    model   : MODEL,
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user',   content: userMsg },
    ],
    max_tokens : maxTokens,
    temperature,
  });
  return {
    text        : completion.choices[0]?.message?.content || '',
    inputTokens : completion.usage?.prompt_tokens     || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  };
}

// ── USE CASE 1: Intent Detection (ultra-fast routing) ─────────
async function detectIntent(clientId, message) {
  const start = Date.now();
  try {
    const result = await callGroq(
      'Classify the user message intent on a quick commerce/grocery platform. Reply with ONLY one word from: CHAT, PRODUCT_SEARCH, ORDER_PLACE, ORDER_STATUS, COMPLAINT, RECOMMENDATION, FAQ, PRICE_QUERY',
      message,
      10, 0.1
    );
    await logUsage(clientId, 'intent_detection', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text.trim().toUpperCase().split(/\s/)[0];
  } catch (e) {
    await logUsage(clientId, 'intent_detection', 0, 0, Date.now() - start, false, e.message);
    return 'CHAT';
  }
}

// ── USE CASE 2: Order Status Response ────────────────────────
async function getOrderStatus(clientId, userName, orderId, orderData) {
  const start = Date.now();
  try {
    const result = await callGroq(
      'You are a quick commerce order tracker. Give friendly, specific order status updates. Be brief (2 sentences max).',
      `User: ${userName}, Order ID: ${orderId || 'latest'}, Status: ${orderData?.status || 'confirmed'}, Items: ${orderData?.items?.map(i=>i.name).join(', ') || 'your items'}. Give a status update.`,
      80, 0.6
    );
    await logUsage(clientId, 'order_status', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'order_status', 0, 0, Date.now() - start, false, e.message);
    return `Your order is confirmed and on its way, ${userName}!`;
  }
}

// ── USE CASE 3: Price Advice ──────────────────────────────────
async function getPriceAdvice(clientId, productName, price, marketContext) {
  const start = Date.now();
  try {
    const result = await callGroq(
      'You are a smart price advisor for a quick commerce app in India. Give a 1-sentence price opinion. Be direct.',
      `Is ₹${price} a good price for ${productName}? Context: ${marketContext || 'quick commerce platform'}`,
      50, 0.5
    );
    await logUsage(clientId, 'price_advice', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'price_advice', 0, 0, Date.now() - start, false, e.message);
    return null;
  }
}

// ── USE CASE 4: FAQ Instant Answer ───────────────────────────
async function answerFAQ(clientId, question, clientContext) {
  const start = Date.now();
  try {
    const result = await callGroq(
      `You are a customer support AI for ${clientContext?.name || 'a quick commerce platform'}. Answer FAQs about delivery, returns, payments, accounts in 1-2 sentences. Be helpful and specific.`,
      question,
      100, 0.6
    );
    await logUsage(clientId, 'faq', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'faq', 0, 0, Date.now() - start, false, e.message);
    return null;
  }
}

// ── USE CASE 5: Personalized Greeting ────────────────────────
async function generateGreeting(clientId, userName, userPersona, topCategory, returningUser) {
  const start = Date.now();
  try {
    const result = await callGroq(
      'Generate a warm, personalized one-sentence greeting for a quick commerce app. Be specific to the user profile. Max 25 words. No emojis in the sentence itself.',
      `Name: ${userName}, Profile: ${userPersona}, Favorite: ${topCategory}, Returning: ${returningUser}`,
      50, 0.8
    );
    await logUsage(clientId, 'greeting', result.inputTokens, result.outputTokens, Date.now() - start, true);
    return result.text;
  } catch (e) {
    await logUsage(clientId, 'greeting', 0, 0, Date.now() - start, false, e.message);
    return `Welcome back, ${userName}!`;
  }
}

module.exports = {
  detectIntent,
  getOrderStatus,
  getPriceAdvice,
  answerFAQ,
  generateGreeting,
};
