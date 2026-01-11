/**
 * LIVE TRADING SERVICE
 * 
 * ⚠️ WARNING: This service executes REAL trades with REAL money.
 * Only enable this after extensive paper trading proves profitability.
 * 
 * Requirements:
 * 1. Coinbase Pro API key with trading permissions
 * 2. Funded account
 * 3. Proven paper trading track record (>60% win rate over 100+ trades)
 * 
 * Set LIVE_TRADING_ENABLED=true in .env to activate (DANGEROUS)
 */

import { query } from '../../shared/db';
import { TelegramService } from '../notifications/telegram.service';

// SAFETY: Default to OFF
const LIVE_ENABLED = process.env.LIVE_TRADING_ENABLED === 'true';
const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const API_PASSPHRASE = process.env.COINBASE_API_PASSPHRASE;

// Risk Management
const MAX_POSITION_SIZE_USD = 100;  // Start small
const MAX_OPEN_POSITIONS = 3;
const DAILY_LOSS_LIMIT_USD = -50;

interface TradeOrder {
    ticker: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
}

export const LiveTradingService = {
    isEnabled: () => LIVE_ENABLED && API_KEY && API_SECRET,

    // Pre-flight checks before any live trade
    canTrade: async (): Promise<{ allowed: boolean; reason: string }> => {
        if (!LIVE_ENABLED) {
            return { allowed: false, reason: 'Live trading disabled' };
        }

        if (!API_KEY || !API_SECRET) {
            return { allowed: false, reason: 'API credentials missing' };
        }

        // Check daily loss limit
        const dailyPnL = await LiveTradingService.getDailyPnL();
        if (dailyPnL <= DAILY_LOSS_LIMIT_USD) {
            return { allowed: false, reason: `Daily loss limit hit: $${dailyPnL}` };
        }

        // Check open positions
        const openPositions = await LiveTradingService.getOpenPositions();
        if (openPositions >= MAX_OPEN_POSITIONS) {
            return { allowed: false, reason: `Max positions reached: ${openPositions}` };
        }

        return { allowed: true, reason: 'OK' };
    },

    getDailyPnL: async (): Promise<number> => {
        const result = await query(`
            SELECT COALESCE(SUM(profit), 0) as daily_pnl
            FROM live_trades
            WHERE closed_at >= CURRENT_DATE
        `);
        return parseFloat(result.rows[0]?.daily_pnl || 0);
    },

    getOpenPositions: async (): Promise<number> => {
        const result = await query(`
            SELECT COUNT(*) as count FROM live_trades WHERE status = 'OPEN'
        `);
        return parseInt(result.rows[0]?.count || 0);
    },

    // Execute a live trade (PLACEHOLDER - implement with actual Coinbase API)
    executeTrade: async (order: TradeOrder): Promise<boolean> => {
        const check = await LiveTradingService.canTrade();
        if (!check.allowed) {
            console.log(`[LIVE] Trade blocked: ${check.reason}`);
            return false;
        }

        console.log(`[LIVE] ⚠️ Would execute: ${order.side.toUpperCase()} ${order.ticker} @ $${order.price}`);
        
        // TODO: Implement actual Coinbase Pro API call
        // const client = new CoinbasePro.AuthenticatedClient(API_KEY, API_SECRET, API_PASSPHRASE);
        // await client.placeOrder({ ... });

        // For now, just log and notify
        await TelegramService.sendHijackAlert(
            `[LIVE] ${order.side.toUpperCase()} ${order.ticker}`,
            order.price,
            0
        );

        return true;
    },

    // Get status for dashboard
    getStatus: () => ({
        enabled: LIVE_ENABLED,
        hasCredentials: !!(API_KEY && API_SECRET),
        maxPositionSize: MAX_POSITION_SIZE_USD,
        maxOpenPositions: MAX_OPEN_POSITIONS,
        dailyLossLimit: DAILY_LOSS_LIMIT_USD
    })
};
