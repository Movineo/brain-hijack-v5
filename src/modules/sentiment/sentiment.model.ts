import { query } from '../../shared/db';

export const SentimentModel = {
    // 1. ORIGINAL: Single Asset Fetch (Keep this for deep dives)
    getRecentSignals: async (ticker: string, limit: number = 100) => {
        const sql = `
            SELECT sentiment_score, volume 
            FROM sentiment_metrics 
            WHERE ticker = $1 
            ORDER BY time DESC 
            LIMIT $2;
        `;
        
        const result = await query(sql, [ticker, limit]);
        
        return result.rows.map(row => ({
            score: Number(row.sentiment_score),
            volume: Number(row.volume)
        })).reverse();
    },

    // 2. NEW: Multi-Asset "Panopticon" Fetch
    // Fetches ALL trades from the last 3 minutes for every coin in the DB.
    getMarketWindow: async () => {
        const sql = `
            SELECT ticker, sentiment_score, volume, time
            FROM sentiment_metrics
            WHERE time >= NOW() - INTERVAL '3 minutes'
            ORDER BY time ASC;
        `;
        
        const result = await query(sql);
        return result.rows; 
    }
};