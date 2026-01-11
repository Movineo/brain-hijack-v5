import WebSocket from 'ws';
import { query } from '../../shared/db';

export const IngestorService = {
    // UPDATED: Removed 'pepeusdt' & 'xrpusdt' as they may not be on Binance.US
    // Kept the majors: BTC, ETH, SOL, DOGE, BNB
    startIngestion: (tickers: string[] = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'dogeusdt']) => {
        
        // Format for Binance Stream
        const streams = tickers.map(t => `${t.toLowerCase()}@aggTrade`).join('/');
        
        // CRITICAL FIX: Changed domain to 'stream.binance.us' to bypass US Geo-Block (Error 451)
        const wsUrl = `wss://stream.binance.us:9443/stream?streams=${streams}`;

        console.log(`[Ingestor] 🟢 Attempting connection to US Stream: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('[Ingestor] ✅ CONNECTION SUCCESSFUL! Listening to US market...');
        });

        // DEBUG: Counter to log pulse check every 10 trades
        let tradeCount = 0;

        ws.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data);
                
                // Validate data shape
                if (!message.data) return;

                const trade = message.data;
                const ticker = trade.s; // e.g., 'BTCUSDT'
                const price = parseFloat(trade.p);
                const volume = parseFloat(trade.q);
                
                // DEBUG LOG: Print every 10th trade to console to confirm life
                tradeCount++;
                if (tradeCount % 10 === 0) {
                    console.log(`[Ingestor] 💓 Pulse Check: Received ${ticker} at $${price}`);
                }

                try {
                    const sql = `
                        INSERT INTO sentiment_metrics (ticker, sentiment_score, volume, time) 
                        VALUES ($1, $2, $3, NOW())
                    `;
                    
                    await query(sql, [ticker, price, volume]);
                    
                } catch (dbErr) {
                    console.error("[Ingestor] 🔴 DB SAVE ERROR:", dbErr);
                }
            } catch (parseErr) {
                console.error("[Ingestor] ⚠️ Data Parse Error:", parseErr);
            }
        });

        ws.on('error', (err) => {
            // Log the error message clearly
            console.error('[Ingestor] 💀 CONNECTION ERROR:', err.message);
        });

        ws.on('close', () => {
            console.log('[Ingestor] ⚠️ Connection Closed. Reconnecting in 5s...');
            setTimeout(() => IngestorService.startIngestion(tickers), 5000);
        });
    }
};