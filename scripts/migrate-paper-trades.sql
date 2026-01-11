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
