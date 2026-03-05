const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { requireClient, requireOwner } = require('../middleware/auth');
const { invalidateBrainCache }        = require('../services/promptBuilder');
const supabase = require('../lib/supabase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } }); // 1MB max brain

// ── POST /api/brain/master ─ Owner uploads master brain ──────
router.post('/master', requireOwner, upload.single('brain'), async (req, res) => {
  try {
    const content  = req.file
      ? req.file.buffer.toString('utf-8')
      : req.body.content;

    if (!content?.trim()) return res.status(400).json({ error: 'Brain content is empty' });

    // Deactivate old master brain
    await supabase
      .from('brain_files')
      .update({ is_active: false })
      .is('client_id', null);

    // Get current version
    const { count } = await supabase
      .from('brain_files')
      .select('*', { count: 'exact' })
      .is('client_id', null);

    const { data } = await supabase
      .from('brain_files')
      .insert({
        client_id  : null,
        content    : content.trim(),
        filename   : req.file?.originalname || 'master-brain.txt',
        version    : (count || 0) + 1,
        uploaded_by: 'owner',
        is_active  : true,
      })
      .select('id, filename, version, created_at')
      .single();

    invalidateBrainCache(null); // Clear cache

    res.json({
      success : true,
      brainId : data.id,
      version : data.version,
      filename: data.filename,
      chars   : content.length,
      message : `✓ Master brain v${data.version} uploaded. All clients will use this immediately.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/brain/master ─ Owner reads master brain ─────────
router.get('/master', requireOwner, async (req, res) => {
  try {
    const { data } = await supabase
      .from('brain_files')
      .select('id, content, filename, version, created_at, uploaded_by')
      .is('client_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return res.json({ brain: null });
    res.json({ brain: data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load master brain' });
  }
});

// ── GET /api/brain/master/history ─ Version history ──────────
router.get('/master/history', requireOwner, async (req, res) => {
  try {
    const { data } = await supabase
      .from('brain_files')
      .select('id, filename, version, created_at, is_active, uploaded_by')
      .is('client_id', null)
      .order('version', { ascending: false })
      .limit(10);

    res.json({ versions: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load brain history' });
  }
});

// ── POST /api/brain/client ─ Enterprise client uploads their brain ──
router.post('/client', requireClient, upload.single('brain'), async (req, res) => {
  try {
    const content = req.file
      ? req.file.buffer.toString('utf-8')
      : req.body.content;

    if (!content?.trim()) return res.status(400).json({ error: 'Brain content is empty' });

    // Deactivate old client brain
    await supabase
      .from('brain_files')
      .update({ is_active: false })
      .eq('client_id', req.client.id);

    const { count } = await supabase
      .from('brain_files')
      .select('*', { count: 'exact' })
      .eq('client_id', req.client.id);

    const { data } = await supabase
      .from('brain_files')
      .insert({
        client_id  : req.client.id,
        content    : content.trim(),
        filename   : req.file?.originalname || 'client-brain.txt',
        version    : (count || 0) + 1,
        uploaded_by: req.client.email,
        is_active  : true,
      })
      .select('id, filename, version, created_at')
      .single();

    invalidateBrainCache(req.client.id);

    res.json({
      success : true,
      brainId : data.id,
      version : data.version,
      message : `✓ Brain v${data.version} uploaded. Your AI will use this immediately.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/brain/client ─ Client reads their brain ─────────
router.get('/client', requireClient, async (req, res) => {
  try {
    const { data } = await supabase
      .from('brain_files')
      .select('id, content, filename, version, created_at')
      .eq('client_id', req.client.id)
      .eq('is_active', true)
      .single();

    res.json({ brain: data || null });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load brain' });
  }
});

module.exports = router;
