require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const chatRoutes      = require('./routes/chat');
const catalogRoutes   = require('./routes/catalog');
const brainRoutes     = require('./routes/brain');
const clientRoutes    = require('./routes/clients');
const analyticsRoutes = require('./routes/analytics');
const healthRoutes    = require('./routes/health');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    // Allow embed widget from any origin (null = file://, cross-origin iframes)
    if (!origin || allowed.includes(origin) || origin === 'null') return cb(null, true);
    // Allow enterprise client websites (validated by API key, not origin)
    return cb(null, true);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Client-Key'],
}));

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs : parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max      : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 60,
  message  : { error: 'Too many requests. Please wait before retrying.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Stricter limit on chat (AI calls are costly)
const chatLimiter = rateLimit({
  windowMs : 60_000,
  max      : 20,
  message  : { error: 'Chat rate limit exceeded. Max 20 messages/minute.' },
});

app.use(limiter);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/chat',      chatLimiter, chatRoutes);
app.use('/api/catalog',   catalogRoutes);
app.use('/api/brain',     brainRoutes);
app.use('/api/clients',   clientRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/health',    healthRoutes);

// ── Root ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    platform : 'QuickAI Enterprise Platform',
    version  : '1.0.0',
    status   : 'online',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error  : err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ QuickAI Backend running on port ${PORT}`);
  console.log(`   Gemini  : ${process.env.GEMINI_API_KEY ? '✓ connected' : '✗ missing key'}`);
  console.log(`   Groq    : ${process.env.GROQ_API_KEY   ? '✓ connected' : '✗ missing key'}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL   ? '✓ connected' : '✗ missing URL'}`);
});

module.exports = app;
