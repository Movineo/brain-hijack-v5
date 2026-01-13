-- Phase 5: The Sniper - Paper Trading Table
-- Run this in your Neon console: https://console.neon.tech

CREATE TABLE IF NOT EXISTS paper_trades (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10),
    entry_price DECIMAL(20, 8),
    quantity DECIMAL(20, 8),
    status VARCHAR(10) DEFAULT 'OPEN', -- 'OPEN' or 'CLOSED'
    exit_price DECIMAL(20, 8),
    profit DECIMAL(20, 8),
    hijack_force_at_entry DECIMAL(10, 5),
    opened_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_paper_trades_ticker_status ON paper_trades(ticker, status);
CREATE INDEX IF NOT EXISTS idx_paper_trades_opened_at ON paper_trades(opened_at DESC);

-- ============================================
-- Phase 7: The Archive - Historical Hijack Events
-- ============================================

CREATE TABLE IF NOT EXISTS hijack_archive (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10),
    price DECIMAL(20, 8),
    hijack_force DECIMAL(10, 5),
    narrative_score INTEGER DEFAULT 0,
    event_type VARCHAR(20), -- 'ENTRY', 'TAKE_PROFIT', 'STOP_LOSS', 'MOMENTUM_DIED'
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hijack_archive_ticker ON hijack_archive(ticker);
CREATE INDEX IF NOT EXISTS idx_hijack_archive_recorded ON hijack_archive(recorded_at DESC);

-- ============================================
-- Phase 8: Multi-Timeframe Force Cache
-- ============================================

CREATE TABLE IF NOT EXISTS force_snapshots (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10),
    timeframe VARCHAR(5), -- '1m', '5m', '15m'
    hijack_force DECIMAL(10, 5),
    price DECIMAL(20, 8),
    volume DECIMAL(20, 8),
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_force_snapshots_ticker_tf ON force_snapshots(ticker, timeframe);
CREATE INDEX IF NOT EXISTS idx_force_snapshots_recorded ON force_snapshots(recorded_at DESC);
-- ============================================
-- Phase 11: Price Alerts System
-- ============================================

CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    target_price DECIMAL(20, 8) NOT NULL,
    condition VARCHAR(10) NOT NULL, -- 'above' or 'below'
    active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_alerts_ticker ON price_alerts(ticker);

-- ============================================
-- Phase 11: Push Notification Subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT UNIQUE NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active) WHERE active = TRUE;

-- ============================================
-- Phase 11: ML Prediction History
-- ============================================

CREATE TABLE IF NOT EXISTS ml_predictions (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    predicted_direction VARCHAR(4), -- 'up' or 'down'
    confidence DECIMAL(5, 4),
    actual_outcome VARCHAR(4), -- filled in after the fact for training
    features JSONB, -- snapshot of features used for prediction
    predicted_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_ticker ON ml_predictions(ticker);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_predicted ON ml_predictions(predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_confidence ON ml_predictions(confidence DESC);

-- ============================================
-- Phase 11: Twitter Sentiment Cache
-- ============================================

CREATE TABLE IF NOT EXISTS twitter_sentiment (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10),
    topic VARCHAR(100),
    sentiment_score DECIMAL(5, 4), -- -1 to +1
    mention_count INTEGER DEFAULT 0,
    sample_tweets TEXT[], -- array of tweet snippets
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twitter_sentiment_ticker ON twitter_sentiment(ticker);
CREATE INDEX IF NOT EXISTS idx_twitter_sentiment_fetched ON twitter_sentiment(fetched_at DESC);

-- ============================================
-- Phase 11: On-Chain Metrics Cache
-- ============================================

CREATE TABLE IF NOT EXISTS onchain_metrics (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    active_addresses INTEGER,
    transaction_count INTEGER,
    hash_rate DECIMAL(20, 2),
    exchange_inflow DECIMAL(20, 8),
    exchange_outflow DECIMAL(20, 8),
    tvl DECIMAL(20, 2),
    health_score INTEGER, -- 0-100
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onchain_metrics_ticker ON onchain_metrics(ticker);
CREATE INDEX IF NOT EXISTS idx_onchain_metrics_recorded ON onchain_metrics(recorded_at DESC);

-- ============================================
-- Phase 11: Fear & Greed Index History
-- ============================================

CREATE TABLE IF NOT EXISTS fear_greed_history (
    id SERIAL PRIMARY KEY,
    value INTEGER NOT NULL, -- 0-100
    classification VARCHAR(20), -- 'Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'
    components JSONB, -- breakdown: volatility, volume, sentiment, etc.
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fear_greed_recorded ON fear_greed_history(recorded_at DESC);

-- ============================================
-- Phase 11: Options Flow Cache
-- ============================================

CREATE TABLE IF NOT EXISTS options_flow (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    option_type VARCHAR(4), -- 'call' or 'put'
    strike DECIMAL(20, 2),
    expiry DATE,
    volume INTEGER,
    open_interest INTEGER,
    premium DECIMAL(20, 2),
    is_unusual BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_options_flow_ticker ON options_flow(ticker);
CREATE INDEX IF NOT EXISTS idx_options_flow_unusual ON options_flow(is_unusual) WHERE is_unusual = TRUE;
CREATE INDEX IF NOT EXISTS idx_options_flow_recorded ON options_flow(recorded_at DESC);

-- ============================================
-- Phase 11: Kill Switch Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS killswitch_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(20) NOT NULL, -- 'ACTIVATED', 'DEACTIVATED'
    reason TEXT,
    triggered_by VARCHAR(100), -- API key or 'SYSTEM'
    triggered_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Phase 11: API Rate Limit Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(64) NOT NULL,
    endpoint VARCHAR(100),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON api_rate_limits(api_key, window_start);

-- ============================================
-- Phase 12: AutoTrader Bot Signals
-- ============================================

CREATE TABLE IF NOT EXISTS autotrader_signals (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'LONG' or 'SHORT'
    confidence INTEGER NOT NULL, -- 0-100
    alignment_score INTEGER NOT NULL, -- 0-100
    signals JSONB, -- Array of signal sources
    price DECIMAL(20, 8),
    executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autotrader_ticker ON autotrader_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_autotrader_executed ON autotrader_signals(executed_at DESC);