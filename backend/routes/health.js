const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  try {
    await supabase.from('owner_settings').select('key').limit(1);
  } catch (e) {
    dbStatus = 'error';
  }

  res.json({
    status   : 'ok',
    db       : dbStatus,
    gemini   : !!process.env.GEMINI_API_KEY,
    groq     : !!process.env.GROQ_API_KEY,
    latencyMs: Date.now() - start,
    ts       : new Date().toISOString(),
  });
});

module.exports = router;
