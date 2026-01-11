import WebSocket from 'ws';
import { query } from '../../shared/db';

export const IngestorService = {
    startIngestion: (tickers: string[] = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt']) => {
        
        // Format for Binance Combined Stream:
        // streamName = <symbol>@aggTrade
        // URL = wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/...
        
        const streams = tickers.map(t => `${t.toLowerCase()}@aggTrade`).join('/');
        const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

        console.log(`[Ingestor] 🟢 Attempting connection to Panopticon Stream: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('[Ingestor] ✅ CONNECTION SUCCESSFUL! Hunting for anomalies...');
        });

        // DEBUG: Counter to log pulse check every 10 trades
        let tradeCount = 0;

        ws.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data);
                
                // Validate data shape to prevent crashes on non-trade messages
                if (!message.data) return;

                // Combined stream format: { stream: 'btcusdt@aggTrade', data: { ...trade... } }
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
                    
                    // We use the ticker symbol from the stream (e.g., BTCUSDT)
                    await query(sql, [ticker, price, volume]);
                    
                } catch (dbErr) {
                    console.error("[Ingestor] 🔴 DB SAVE ERROR:", dbErr);
                }
            } catch (parseErr) {
                console.error("[Ingestor] ⚠️ Data Parse Error:", parseErr);
            }
        });

        ws.on('error', (err) => {
            console.error('[Ingestor] 💀 CONNECTION ERROR:', err);
        });

        ws.on('close', () => {
            console.log('[Ingestor] ⚠️ Connection Closed. Reconnecting in 5s...');
            setTimeout(() => IngestorService.startIngestion(tickers), 5000);
        });
    }
};