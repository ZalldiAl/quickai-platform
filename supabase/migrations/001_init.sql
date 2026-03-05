-- ============================================================
-- QuickAI Platform — Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENTERPRISE CLIENTS ────────────────────────────────────────
CREATE TABLE enterprise_clients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','growth','enterprise')),
  is_active     BOOLEAN DEFAULT true,
  website_url   TEXT,
  industry      TEXT DEFAULT 'ecommerce',
  monthly_limit INTEGER DEFAULT 10000,  -- AI calls per month
  calls_used    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── BRAIN FILES ───────────────────────────────────────────────
CREATE TABLE brain_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  -- client_id NULL = master brain (platform owner)
  content       TEXT NOT NULL,
  filename      TEXT NOT NULL,
  version       INTEGER DEFAULT 1,
  is_active     BOOLEAN DEFAULT true,
  uploaded_by   TEXT NOT NULL,  -- 'owner' or client email
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brain_client ON brain_files(client_id, is_active);

-- ── PRODUCT CATALOGS ──────────────────────────────────────────
CREATE TABLE product_catalogs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  catalog_data  JSONB NOT NULL,   -- full JSON array of products
  filename      TEXT NOT NULL,
  product_count INTEGER DEFAULT 0,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT true
);

CREATE INDEX idx_catalog_client ON product_catalogs(client_id, is_active, uploaded_at DESC);

-- ── END USERS ─────────────────────────────────────────────────
CREATE TABLE end_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,   -- browser fingerprint (anonymous)
  display_name  TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, fingerprint)
);

CREATE INDEX idx_endusers_client ON end_users(client_id);

-- ── USER MEMORY / BEHAVIOR ────────────────────────────────────
CREATE TABLE user_memory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  -- behavior tracking
  searches            TEXT[] DEFAULT '{}',
  viewed_products     TEXT[] DEFAULT '{}',
  added_to_cart       TEXT[] DEFAULT '{}',
  purchased_products  TEXT[] DEFAULT '{}',
  category_counts     JSONB DEFAULT '{}',   -- { "Dairy": 5, "Fruits": 3 }
  brand_counts        JSONB DEFAULT '{}',
  -- session stats
  total_sessions      INTEGER DEFAULT 1,
  total_messages      INTEGER DEFAULT 0,
  total_spent         NUMERIC(10,2) DEFAULT 0,
  avg_order_value     NUMERIC(10,2) DEFAULT 0,
  -- derived profile (updated by AI)
  behavior_summary    TEXT,
  inferred_persona    TEXT,
  dietary_notes       TEXT,
  preferred_time      TEXT,
  -- timestamps
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_memory_user ON user_memory(user_id, client_id);

-- ── CHAT SESSIONS ─────────────────────────────────────────────
CREATE TABLE chat_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_user ON chat_sessions(user_id, client_id);

-- ── CHAT MESSAGES ─────────────────────────────────────────────
CREATE TABLE chat_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content       TEXT NOT NULL,
  ai_model      TEXT,        -- 'gemini-1.5-flash' or 'groq-llama'
  intent        TEXT,        -- detected intent
  products_mentioned TEXT[], -- product IDs referenced in response
  tokens_used   INTEGER DEFAULT 0,
  latency_ms    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX idx_messages_client  ON chat_messages(client_id, created_at DESC);

-- ── API USAGE LOGS ────────────────────────────────────────────
CREATE TABLE api_usage_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  model         TEXT NOT NULL,       -- 'gemini' or 'groq'
  use_case      TEXT NOT NULL,       -- 'chat', 'recommend', 'search_intent', etc.
  tokens_input  INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd      NUMERIC(10,6) DEFAULT 0,
  latency_ms    INTEGER DEFAULT 0,
  success       BOOLEAN DEFAULT true,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_client ON api_usage_logs(client_id, created_at DESC);
CREATE INDEX idx_usage_date   ON api_usage_logs(created_at DESC);

-- ── SYSTEM HEALTH LOGS ────────────────────────────────────────
CREATE TABLE system_health (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint        TEXT NOT NULL,
  status_code     INTEGER,
  latency_ms      INTEGER,
  error           TEXT,
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_time ON system_health(recorded_at DESC);

-- ── ORDERS ────────────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES enterprise_clients(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES chat_sessions(id),
  items           JSONB NOT NULL,    -- [{product_id, name, price, qty}]
  subtotal        NUMERIC(10,2) NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','dispatched','delivered','cancelled')),
  placed_via      TEXT DEFAULT 'chat',  -- 'chat' or 'catalog'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_client ON orders(client_id, created_at DESC);
CREATE INDEX idx_orders_user   ON orders(user_id, created_at DESC);

-- ── OWNER SETTINGS ────────────────────────────────────────────
CREATE TABLE owner_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key           TEXT UNIQUE NOT NULL,
  value         TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO owner_settings (key, value) VALUES
  ('platform_name', 'QuickAI'),
  ('gemini_model',  'gemini-1.5-flash'),
  ('groq_model',    'llama-3.1-8b-instant'),
  ('cost_per_gemini_1k_tokens', '0.000075'),
  ('cost_per_groq_1k_tokens',   '0.000005');

-- ── FUNCTIONS ────────────────────────────────────────────────
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON enterprise_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE enterprise_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalogs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE end_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend uses service role key)
-- All policies are enforced by backend JWT validation
