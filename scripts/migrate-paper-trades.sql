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
