const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { requireClient, requireOwner, requireAuth } = require('../middleware/auth');
const supabase = require('../lib/supabase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── POST /api/catalog/upload ─ Enterprise client uploads daily JSON ──
router.post('/upload', requireClient, upload.single('catalog'), async (req, res) => {
  try {
    let catalogData;

    // Accept JSON file upload OR raw JSON body
    if (req.file) {
      const fileContent = req.file.buffer.toString('utf-8');
      catalogData = JSON.parse(fileContent);
    } else if (req.body.catalog) {
      catalogData = typeof req.body.catalog === 'string'
        ? JSON.parse(req.body.catalog)
        : req.body.catalog;
    } else {
      return res.status(400).json({ error: 'Upload a JSON file or send catalog in request body' });
    }

    // Validate structure
    if (!Array.isArray(catalogData)) {
      return res.status(400).json({ error: 'Catalog must be a JSON array of products' });
    }

    // Validate required fields
    const required = ['id', 'name', 'price'];
    const invalid  = catalogData.filter(p => !required.every(f => p[f] !== undefined));
    if (invalid.length) {
      return res.status(400).json({
        error  : `${invalid.length} products missing required fields (id, name, price)`,
        sample : invalid[0],
      });
    }

    // Deactivate old catalogs
    await supabase
      .from('product_catalogs')
      .update({ is_active: false })
      .eq('client_id', req.client.id);

    // Insert new catalog
    const { data, error } = await supabase
      .from('product_catalogs')
      .insert({
        client_id    : req.client.id,
        catalog_data : catalogData,
        filename     : req.file?.originalname || 'catalog.json',
        product_count: catalogData.length,
        is_active    : true,
      })
      .select('id, product_count, uploaded_at')
      .single();

    if (error) throw new Error(error.message);

    res.json({
      success      : true,
      catalogId    : data.id,
      productCount : data.product_count,
      uploadedAt   : data.uploaded_at,
      message      : `✓ ${data.product_count} products loaded successfully`,
    });
  } catch (e) {
    console.error('[Catalog/upload]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ── GET /api/catalog/active ─ Get active catalog (for chat widget) ──
router.get('/active', requireClient, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('product_catalogs')
      .select('id, catalog_data, product_count, uploaded_at')
      .eq('client_id', req.client.id)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ catalog: [], productCount: 0, message: 'No catalog uploaded yet' });
    }

    res.json({
      catalogId   : data.id,
      catalog     : data.catalog_data,
      productCount: data.product_count,
      uploadedAt  : data.uploaded_at,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

// ── GET /api/catalog/search ─ AI-powered product search ──────
router.get('/search', requireClient, async (req, res) => {
  try {
    const { q, category } = req.query;
    if (!q && !category) return res.status(400).json({ error: 'query (q) required' });

    const { data } = await supabase
      .from('product_catalogs')
      .select('catalog_data')
      .eq('client_id', req.client.id)
      .eq('is_active', true)
      .single();

    if (!data?.catalog_data) return res.json({ products: [] });

    let results = data.catalog_data;

    // Filter by category
    if (category) {
      results = results.filter(p =>
        p.category?.toLowerCase() === category.toLowerCase()
      );
    }

    // Simple text search
    if (q) {
      const lower = q.toLowerCase();
      results = results.filter(p =>
        p.name?.toLowerCase().includes(lower)  ||
        p.brand?.toLowerCase().includes(lower) ||
        p.category?.toLowerCase().includes(lower) ||
        p.tags?.some(t => t.toLowerCase().includes(lower))
      );
    }

    res.json({ products: results.slice(0, 20), total: results.length });
  } catch (e) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── GET /api/catalog/history ─ Past catalog uploads ──────────
router.get('/history', requireClient, async (req, res) => {
  try {
    const { data } = await supabase
      .from('product_catalogs')
      .select('id, filename, product_count, uploaded_at, is_active')
      .eq('client_id', req.client.id)
      .order('uploaded_at', { ascending: false })
      .limit(10);

    res.json({ catalogs: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ── POST /api/catalog/order ─ Place order from chat ──────────
router.post('/order', requireClient, async (req, res) => {
  try {
    const { userId, sessionId, items } = req.body;
    if (!userId || !items?.length) return res.status(400).json({ error: 'userId and items required' });

    const subtotal = items.reduce((s, i) => s + (i.price * (i.qty || 1)), 0);

    const { data: order } = await supabase
      .from('orders')
      .insert({
        client_id : req.client.id,
        user_id   : userId,
        session_id: sessionId,
        items,
        subtotal,
        status    : 'confirmed',
        placed_via: 'chat',
      })
      .select('id, status, subtotal, created_at')
      .single();

    // Track purchase in memory
    const memoryService = require('../services/memory');
    await memoryService.trackPurchase(userId, req.client.id, items, subtotal);

    res.json({
      success : true,
      orderId : order.id,
      status  : order.status,
      subtotal: order.subtotal,
      message : `Order #${order.id.slice(-6).toUpperCase()} confirmed!`,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

module.exports = router;
