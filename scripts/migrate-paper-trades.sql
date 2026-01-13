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

-- ============================================
-- Phase 13: Brain Hijack Detection System
-- "Trade the herd's psychology, not the asset"
-- ============================================

-- Brain state snapshots for pattern learning
CREATE TABLE IF NOT EXISTS brain_states (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    brain_state VARCHAR(20) NOT NULL, -- FOMO, EUPHORIA, PANIC, CAPITULATION, etc.
    hijack_strength INTEGER NOT NULL, -- 0-100
    trigger_type VARCHAR(20), -- FOMO, FUD, MOMENTUM, CONTRARIAN, SMART_MONEY
    is_contrarian BOOLEAN DEFAULT FALSE,
    herd_direction VARCHAR(10), -- LONG or SHORT
    optimal_direction VARCHAR(10), -- What we should do (opposite if contrarian)
    
    -- Sentiment components at time of detection
    fear_greed_index INTEGER,
    social_sentiment DECIMAL(5, 4), -- -1 to +1
    news_sentiment DECIMAL(5, 4),
    whale_activity DECIMAL(10, 2),
    options_pcr DECIMAL(5, 4), -- Put/Call ratio
    funding_rate DECIMAL(10, 6),
    
    -- Velocity metrics (rate of change)
    sentiment_velocity DECIMAL(10, 4), -- Change per hour
    price_velocity DECIMAL(10, 4),
    volume_spike DECIMAL(10, 2), -- Multiple of average
    
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_states_ticker ON brain_states(ticker);
CREATE INDEX IF NOT EXISTS idx_brain_states_state ON brain_states(brain_state);
CREATE INDEX IF NOT EXISTS idx_brain_states_strength ON brain_states(hijack_strength DESC);
CREATE INDEX IF NOT EXISTS idx_brain_states_recorded ON brain_states(recorded_at DESC);

-- Track hijack outcomes for ML training
CREATE TABLE IF NOT EXISTS hijack_outcomes (
    id SERIAL PRIMARY KEY,
    brain_state_id INTEGER REFERENCES brain_states(id),
    ticker VARCHAR(20) NOT NULL,
    entry_price DECIMAL(20, 8),
    exit_price DECIMAL(20, 8),
    direction VARCHAR(10), -- LONG or SHORT
    profit_pct DECIMAL(10, 4),
    was_successful BOOLEAN, -- Did contrarian play work?
    hold_duration_minutes INTEGER,
    max_drawdown_pct DECIMAL(10, 4),
    max_profit_pct DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hijack_outcomes_ticker ON hijack_outcomes(ticker);
CREATE INDEX IF NOT EXISTS idx_hijack_outcomes_success ON hijack_outcomes(was_successful);
CREATE INDEX IF NOT EXISTS idx_hijack_outcomes_state ON hijack_outcomes(brain_state_id);

-- Herd behavior patterns (for pattern matching)
CREATE TABLE IF NOT EXISTS herd_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(50) NOT NULL, -- 'FOMO_TOP', 'CAPITULATION_BOTTOM', 'BULL_TRAP', etc.
    description TEXT,
    
    -- Pattern signature (what to look for)
    fear_greed_min INTEGER,
    fear_greed_max INTEGER,
    sentiment_velocity_min DECIMAL(10, 4),
    sentiment_velocity_max DECIMAL(10, 4),
    volume_spike_min DECIMAL(10, 2),
    social_sentiment_min DECIMAL(5, 4),
    social_sentiment_max DECIMAL(5, 4),
    
    -- Action when pattern detected
    recommended_action VARCHAR(10), -- LONG, SHORT, or WAIT
    confidence_boost INTEGER DEFAULT 0, -- Add to base confidence
    
    -- Pattern stats
    times_detected INTEGER DEFAULT 0,
    times_profitable INTEGER DEFAULT 0,
    avg_profit_pct DECIMAL(10, 4),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert known herd patterns
INSERT INTO herd_patterns (pattern_name, description, fear_greed_min, fear_greed_max, sentiment_velocity_min, social_sentiment_min, social_sentiment_max, recommended_action, confidence_boost) VALUES
('FOMO_TOP', 'Extreme greed + rapid sentiment rise = likely top', 80, 100, 0.5, 0.7, 1.0, 'SHORT', 15),
('CAPITULATION_BOTTOM', 'Extreme fear + sentiment capitulation = likely bottom', 0, 20, -0.5, -1.0, -0.5, 'LONG', 20),
('BULL_TRAP', 'Quick recovery from fear into greed = trap', 45, 65, 0.8, 0.3, 0.6, 'SHORT', 10),
('BEAR_TRAP', 'Quick drop from greed into fear = trap', 35, 55, -0.8, -0.6, -0.3, 'LONG', 10),
('EUPHORIA_PEAK', 'Maximum greed sustained = distribution phase', 85, 100, -0.1, 0.8, 1.0, 'SHORT', 25),
('DEPRESSION_BOTTOM', 'Maximum fear sustained = accumulation phase', 0, 15, 0.1, -1.0, -0.7, 'LONG', 25),
('FOMO_ACCELERATION', 'Sentiment accelerating upward rapidly', 60, 80, 1.0, 0.5, 0.8, 'SHORT', 5),
('PANIC_ACCELERATION', 'Sentiment accelerating downward rapidly', 20, 40, -1.0, -0.8, -0.5, 'LONG', 5)
ON CONFLICT DO NOTHING;