import { query } from '../../shared/db';
import { TelegramService } from '../notifications/telegram.service';

// CONFIG: Sniper Parameters
const TRADE_SIZE_USD = 1000;        // Simulated USD per trade
const ENTRY_THRESHOLD = 0.01;       // Hijack Force must be > this to BUY (lowered for testing)
const EXIT_THRESHOLD = 0.005;       // Force drops below this = TAKE PROFIT
const STOP_LOSS_PERCENT = -2.0;     // Max loss before we bail

export const PaperService = {
    // 1. MAIN LOOP: Evaluate entire market state
    evaluateMarketState: async (leaderboard: any[]) => {
        for (const asset of leaderboard) {
            try {
                // RULE: Only snipe if Force is VERY high (Strong Momentum)
                if (asset.hijackForce > ENTRY_THRESHOLD) {
                    await PaperService.openPosition(asset.ticker, asset.latestPrice, asset.hijackForce);
                } 
                // RULE: Check if we need to close existing positions
                await PaperService.managePositions(asset.ticker, asset.latestPrice, asset.hijackForce);
            } catch (err) {
                console.error(`[SNIPER] Error processing ${asset.ticker}:`, err);
            }
        }
    },

    // 2. ENTRY: Open a new position
    openPosition: async (ticker: string, price: number, force: number) => {
        // Check if we already have an OPEN trade for this ticker
        const existing = await query(
            `SELECT id FROM paper_trades WHERE ticker = $1 AND status = 'OPEN'`, 
            [ticker]
        );
        
        if (existing.rows.length > 0) return; // Don't double buy

        const quantity = TRADE_SIZE_USD / price;

        await query(
            `INSERT INTO paper_trades (ticker, entry_price, quantity, hijack_force_at_entry, status) 
             VALUES ($1, $2, $3, $4, 'OPEN')`,
            [ticker, price, quantity, force]
        );
        
        console.log(`[SNIPER] 🔫 BANG! Bought ${ticker} at $${price.toFixed(4)} (Force: ${force.toFixed(4)})`);
        
        // Optional: Alert on Telegram
        await TelegramService.sendHijackAlert(ticker, price, force);
    },

    // 3. EXIT MANAGEMENT: Check if we should close positions
    managePositions: async (ticker: string, currentPrice: number, currentForce: number) => {
        // Find open trade for this ticker
        const res = await query(
            `SELECT * FROM paper_trades WHERE ticker = $1 AND status = 'OPEN'`, 
            [ticker]
        );
        
        if (res.rows.length === 0) return;

        const trade = res.rows[0];
        const entryPrice = parseFloat(trade.entry_price);
        const quantity = parseFloat(trade.quantity);

        // Calculate PnL percentage
        const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

        // EXIT RULES:
        let shouldClose = false;
        let reason = "";

        // 1. Momentum died = Take profit (or small loss)
        if (currentForce < EXIT_THRESHOLD) {
            shouldClose = true;
            reason = "MOMENTUM_DIED";
        } 
        // 2. Stop Loss hit
        else if (pnlPercent <= STOP_LOSS_PERCENT) {
            shouldClose = true;
            reason = "STOP_LOSS";
        }

        if (shouldClose) {
            const profitUsd = (currentPrice - entryPrice) * quantity;
            
            await query(
                `UPDATE paper_trades 
                 SET status = 'CLOSED', exit_price = $1, closed_at = NOW(), profit = $2 
                 WHERE id = $3`,
                [currentPrice, profitUsd, trade.id]
            );

            const emoji = profitUsd >= 0 ? '💰' : '💸';
            console.log(`[SNIPER] ${emoji} CLOSED ${ticker}. P&L: $${profitUsd.toFixed(2)} (${reason})`);
        }
    },

    // 4. STATS: Get trading performance
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
    }
};
