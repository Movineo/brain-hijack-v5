import { query } from '../../shared/db';
import { TelegramService } from '../notifications/telegram.service';
import { NewsService } from '../news/news.service';
import { ConfigService } from '../../shared/config.service';

// In-memory high water marks for trailing stops
const highWaterMarks: Map<string, number> = new Map();

export const PaperService = {
    // 1. MAIN LOOP: Evaluate entire market state (now with narrative fusion)
    evaluateMarketState: async (leaderboard: any[]) => {
        // CHECK KILL SWITCH
        if (!ConfigService.isPaperTradingAllowed()) {
            return; // Trading disabled
        }

        for (const asset of leaderboard) {
            try {
                // Get narrative score for this asset
                const narrative = NewsService.getNarrative(asset.ticker);
                const narrativeScore = narrative.score;
                
                // Get thresholds from config
                const ENTRY_THRESHOLD = ConfigService.getEntryThreshold();
                const REQUIRE_NARRATIVE = ConfigService.getRequireNarrative();
                
                // SMART ENTRY: Force HIGH + Narrative confirms direction
                const forceHigh = asset.hijackForce > ENTRY_THRESHOLD;
                const narrativeConfirms = !REQUIRE_NARRATIVE || narrativeScore >= 0; // Bullish or neutral news
                
                if (forceHigh && narrativeConfirms) {
                    await PaperService.openPosition(
                        asset.ticker, 
                        asset.latestPrice, 
                        asset.hijackForce,
                        narrativeScore
                    );
                } 
                
                // Always check exits
                await PaperService.managePositions(asset.ticker, asset.latestPrice, asset.hijackForce);
            } catch (err) {
                console.error(`[SNIPER] Error processing ${asset.ticker}:`, err);
            }
        }
    },

    // 2. ENTRY: Open a new position (now logs narrative)
    openPosition: async (ticker: string, price: number, force: number, narrativeScore: number = 0) => {
        // Check kill switch
        if (!ConfigService.isPaperTradingAllowed()) return;

        // Check if we already have an OPEN trade for this ticker
        const existing = await query(
            `SELECT id FROM paper_trades WHERE ticker = $1 AND status = 'OPEN'`, 
            [ticker]
        );
        
        if (existing.rows.length > 0) return; // Don't double buy

        // Check max open positions
        const openCount = await query(`SELECT COUNT(*) as cnt FROM paper_trades WHERE status = 'OPEN'`);
        if (parseInt(openCount.rows[0].cnt) >= ConfigService.getMaxOpenPositions()) return;

        const TRADE_SIZE_USD = ConfigService.getTradeSizeUsd();
        const quantity = TRADE_SIZE_USD / price;

        await query(
            `INSERT INTO paper_trades (ticker, entry_price, quantity, hijack_force_at_entry, status) 
             VALUES ($1, $2, $3, $4, 'OPEN')`,
            [ticker, price, quantity, force]
        );
        
        console.log(`[SNIPER] 🔫 BANG! Bought ${ticker} at $${price.toFixed(4)} (Force: ${force.toFixed(4)}, News: ${narrativeScore})`);
        
        // Archive the hijack event
        await PaperService.archiveHijack(ticker, price, force, narrativeScore, 'ENTRY');
        
        // Alert on Telegram
        await TelegramService.sendHijackAlert(ticker, price, force);
    },

    // 3. EXIT MANAGEMENT: Now with trailing stop
    managePositions: async (ticker: string, currentPrice: number, currentForce: number) => {
        const res = await query(
            `SELECT * FROM paper_trades WHERE ticker = $1 AND status = 'OPEN'`, 
            [ticker]
        );
        
        if (res.rows.length === 0) return;

        const trade = res.rows[0];
        const entryPrice = parseFloat(trade.entry_price);
        const quantity = parseFloat(trade.quantity);
        const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Get config values
        const TAKE_PROFIT_PERCENT = ConfigService.getTakeProfitPercent();
        const STOP_LOSS_PERCENT = ConfigService.getStopLossPercent();
        const EXIT_THRESHOLD = ConfigService.getExitThreshold();
        const TRAILING_STOP_ENABLED = ConfigService.getTrailingStopEnabled();
        const TRAILING_STOP_PERCENT = ConfigService.getTrailingStopPercent();
        const TRAILING_ACTIVATION = ConfigService.getTrailingActivation();

        // Update high water mark for trailing stop
        const currentHigh = highWaterMarks.get(ticker) || entryPrice;
        if (currentPrice > currentHigh) {
            highWaterMarks.set(ticker, currentPrice);
        }
        const highWaterMark = highWaterMarks.get(ticker) || entryPrice;
        const dropFromHigh = ((highWaterMark - currentPrice) / highWaterMark) * 100;

        let shouldClose = false;
        let reason = "";

        // EXIT RULES (Priority order):
        // 1. Take Profit - Lock in gains
        if (pnlPercent >= TAKE_PROFIT_PERCENT) {
            shouldClose = true;
            reason = "TAKE_PROFIT";
        }
        // 2. Trailing Stop - Only if in profit and enabled
        else if (TRAILING_STOP_ENABLED && pnlPercent >= TRAILING_ACTIVATION && dropFromHigh >= TRAILING_STOP_PERCENT) {
            shouldClose = true;
            reason = `TRAILING_STOP (High: $${highWaterMark.toFixed(2)})`;
        }
        // 3. Stop Loss - Cut losses
        else if (pnlPercent <= STOP_LOSS_PERCENT) {
            shouldClose = true;
            reason = "STOP_LOSS";
        }
        // 4. Momentum died - Exit regardless of P&L
        else if (currentForce < EXIT_THRESHOLD) {
            shouldClose = true;
            reason = "MOMENTUM_DIED";
        }

        if (shouldClose) {
            const profitUsd = (currentPrice - entryPrice) * quantity;
            
            await query(
                `UPDATE paper_trades 
                 SET status = 'CLOSED', exit_price = $1, closed_at = NOW(), profit = $2 
                 WHERE id = $3`,
                [currentPrice, profitUsd, trade.id]
            );

            // Clear high water mark
            highWaterMarks.delete(ticker);

            const emoji = profitUsd >= 0 ? '💰' : '💸';
            console.log(`[SNIPER] ${emoji} CLOSED ${ticker}. P&L: $${profitUsd.toFixed(2)} (${reason})`);
            
            // Archive the exit event
            await PaperService.archiveHijack(ticker, currentPrice, currentForce, 0, reason);
        }
    },

    // 4. ARCHIVE: Store hijack events for historical analysis
    archiveHijack: async (ticker: string, price: number, force: number, narrativeScore: number, eventType: string) => {
        try {
            await query(
                `INSERT INTO hijack_archive (ticker, price, hijack_force, narrative_score, event_type, recorded_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [ticker, price, force, narrativeScore, eventType]
            );
        } catch (err) {
            // Table might not exist yet - silently fail
            console.error('[ARCHIVE] Failed to log event:', err);
        }
    },

    // 5. STATS: Get trading performance
    getStats: async () => {
        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'CLOSED') as total_trades,
                COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit > 0) as wins,
                COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit <= 0) as losses,
                COALESCE(SUM(profit) FILTER (WHERE status = 'CLOSED'), 0) as total_pnl,
                COUNT(*) FILTER (WHERE status = 'OPEN') as open_positions
            FROM paper_trades
        `);
        
        const stats = result.rows[0];
        const winRate = stats.total_trades > 0 
            ? ((stats.wins / stats.total_trades) * 100).toFixed(1) 
            : '0.0';
            
        return {
            totalTrades: parseInt(stats.total_trades),
            wins: parseInt(stats.wins),
            losses: parseInt(stats.losses),
            winRate: `${winRate}%`,
            totalPnL: parseFloat(stats.total_pnl).toFixed(2),
            openPositions: parseInt(stats.open_positions)
        };
    },

    // 6. P&L HISTORY: Get daily P&L for charting
    getPnLHistory: async () => {
        const result = await query(`
            SELECT 
                DATE(closed_at) as date,
                SUM(profit) as daily_pnl,
                COUNT(*) as trades
            FROM paper_trades 
            WHERE status = 'CLOSED' AND closed_at IS NOT NULL
            GROUP BY DATE(closed_at)
            ORDER BY date DESC
            LIMIT 30
        `);
        return result.rows.reverse(); // Oldest first for charts
    }
};