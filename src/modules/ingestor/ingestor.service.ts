import WebSocket from 'ws';
import { query } from '../../shared/db';

export const IngestorService = {
    startIngestion: () => {
        
        // WEAPON UPDATE: Switching to CoinCap (Global Aggregator)
        // This bypasses Binance Geo-Blocks and 451 Errors.
        const wsUrl = 'wss://ws.coincap.io/trades/binance';

        console.log(`[Ingestor] 🟢 Connecting to Universal Stream: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('[Ingestor] ✅ CONNECTION ESTABLISHED! Siphoning global market data...');
        });

        let tradeCount = 0;

        ws.on('message', async (data: string) => {
            try {
                const trade = JSON.parse(data);
                
                // CoinCap sends EVERYTHING. We need to filter for our targets.
                // Format: { base: 'bitcoin', quote: 'tether', price: 90000, volume: 0.1 ... }
                
                // 1. Only look for USDT pairs (tether)
                if (trade.quote !== 'tether') return;

                // 2. Map names to Tickers
                let ticker = '';
                if (trade.base === 'bitcoin') ticker = 'BTCUSDT';
                else if (trade.base === 'ethereum') ticker = 'ETHUSDT';
                else if (trade.base === 'solana') ticker = 'SOLUSDT';
                else if (trade.base === 'dogecoin') ticker = 'DOGEUSDT';
                else if (trade.base === 'pepe') ticker = 'PEPEUSDT';

                // If it's not on our list, ignore it
                if (!ticker) return;

                const price = parseFloat(trade.price);
                const volume = parseFloat(trade.volume);

                // DEBUG: Prove it works
                tradeCount++;
                if (tradeCount % 10 === 0) {
                    console.log(`[Ingestor] 💓 Pulse: ${ticker} @ $${price}`);
                }

                const sql = `
                    INSERT INTO sentiment_metrics (ticker, sentiment_score, volume, time) 
                    VALUES ($1, $2, $3, NOW())
                `;
                
                await query(sql, [ticker, price, volume]);

            } catch (err) {
                // Ignore parse errors from "ping" messages
            }
        });

        ws.on('error', (err) => {
            console.error('[Ingestor] 💀 CONNECTION ERROR:', err.message);
        });

        ws.on('close', () => {
            console.log('[Ingestor] ⚠️ Disconnected. Restarting in 5s...');
            setTimeout(() => IngestorService.startIngestion(), 5000);
        });
    }
};