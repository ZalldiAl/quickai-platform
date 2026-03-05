/**
 * QuickAI Orchestration Brain
 * ─────────────────────────────────────────────────────────────
 * This is the core intelligence layer. It receives every user
 * message and decides:
 *   1. What is the intent?
 *   2. Which AI model handles it (Gemini vs Groq)?
 *   3. What context to inject?
 *   4. How to format the response?
 *
 * Routing Logic:
 *   GROQ  → Fast, cheap: intent detection, FAQ, order status,
 *            greetings, price queries
 *   GEMINI → Smart, contextual: main chat, recommendations,
 *             behavior analysis, search intent, cart analysis
 */

const geminiService = require('./gemini');
const groqService   = require('./groq');
const promptBuilder = require('./promptBuilder');
const memoryService = require('./memory');
const supabase      = require('../lib/supabase');

// Intent → Model routing map
const GROQ_INTENTS = new Set([
  'ORDER_STATUS',
  'FAQ',
  'COMPLAINT',
  'PRICE_QUERY',
]);

const GEMINI_INTENTS = new Set([
  'CHAT',
  'PRODUCT_SEARCH',
  'ORDER_PLACE',
  'RECOMMENDATION',
]);

/**
 * Main orchestration function
 * @param {object} params
 * @param {string} params.clientId       - Enterprise client UUID
 * @param {string} params.userId         - End user UUID
 * @param {string} params.userMessage    - Raw user message
 * @param {array}  params.chatHistory    - Previous messages [{role, content}]
 * @param {object} params.catalog        - Client's active product catalog
 * @param {object} params.clientContext  - Client info (name, plan, etc.)
 * @returns {object} { response, model, intent, products, latencyMs }
 */
async function orchestrate({
  clientId,
  userId,
  userMessage,
  chatHistory = [],
  catalog     = [],
  clientContext,
}) {
  const startTime = Date.now();

  // ── Step 1: Detect intent (Groq — ultra-fast) ──────────────
  let intent = 'CHAT';
  try {
    intent = await groqService.detectIntent(clientId, userMessage);
  } catch (e) {
    console.error('[Orchestrator] Intent detection failed:', e.message);
  }

  // ── Step 2: Load user memory ───────────────────────────────
  const memory = await memoryService.getMemory(userId, clientId);

  // ── Step 3: Build system context ──────────────────────────
  const systemContext = await promptBuilder.buildSystemPrompt({
    clientId,
    userId,
    memory,
    catalog,
    clientContext,
    intent,
  });

  // ── Step 4: Route to correct model ────────────────────────
  let responseText = '';
  let modelUsed    = 'gemini';

  try {
    if (GROQ_INTENTS.has(intent)) {
      // Route to Groq for fast intents
      if (intent === 'ORDER_STATUS') {
        const lastOrder = memory.purchased_products?.length
          ? { status: 'out_for_delivery', items: [{ name: 'your recent items' }] }
          : null;
        responseText = await groqService.getOrderStatus(clientId, memory.display_name || 'there', null, lastOrder);
        modelUsed = 'groq';
      } else if (intent === 'FAQ' || intent === 'COMPLAINT') {
        const faqResponse = await groqService.answerFAQ(clientId, userMessage, clientContext);
        responseText = faqResponse || await geminiService.personalizedChat(clientId, systemContext, chatHistory, userMessage);
        modelUsed = faqResponse ? 'groq' : 'gemini';
      } else if (intent === 'PRICE_QUERY') {
        // Extract product from message and get price advice
        responseText = await geminiService.personalizedChat(clientId, systemContext, chatHistory, userMessage);
        modelUsed = 'gemini';
      }
    } else {
      // Default to Gemini for smart contextual responses
      responseText = await geminiService.personalizedChat(
        clientId,
        systemContext,
        chatHistory,
        userMessage
      );
      modelUsed = 'gemini';
    }
  } catch (e) {
    console.error('[Orchestrator] AI call failed:', e.message);
    // Fallback
    responseText = `I'm having trouble connecting right now. Please try again in a moment.`;
  }

  // ── Step 5: Extract product mentions from response ─────────
  const mentionedProducts = extractProductMentions(responseText, catalog);

  // ── Step 6: Update user memory ────────────────────────────
  await memoryService.trackMessage(userId, clientId, userMessage, intent);

  const latencyMs = Date.now() - startTime;

  return {
    response : responseText,
    model    : modelUsed,
    intent,
    products : mentionedProducts,
    latencyMs,
  };
}

/**
 * Generate personalized session greeting
 */
async function generateSessionGreeting(clientId, userId, clientContext) {
  const memory  = await memoryService.getMemory(userId, clientId);
  const topCat  = getTopCategory(memory.category_counts);
  const persona = memory.inferred_persona || 'valued customer';
  const isReturning = (memory.total_sessions || 0) > 1;

  try {
    return await groqService.generateGreeting(
      clientId,
      memory.display_name || 'there',
      persona,
      topCat || 'groceries',
      isReturning
    );
  } catch (e) {
    return `Welcome${isReturning ? ' back' : ''}${memory.display_name ? `, ${memory.display_name}` : ''}! How can I help you today?`;
  }
}

// ── Helpers ───────────────────────────────────────────────────
function extractProductMentions(text, catalog) {
  if (!catalog?.length || !text) return [];
  const lower = text.toLowerCase();
  return catalog
    .filter(p => lower.includes(p.name?.toLowerCase()))
    .slice(0, 4)
    .map(p => ({ id: p.id, name: p.name, price: p.price, emoji: p.emoji }));
}

function getTopCategory(categoryCounts = {}) {
  const entries = Object.entries(categoryCounts);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

module.exports = { orchestrate, generateSessionGreeting };
