import WebSocket from 'ws';
import { query } from '../../shared/db';

export const IngestorService = {
    startIngestion: () => {
        // COINBASE: The US-Friendly Giant.
        const wsUrl = 'wss://ws-feed.exchange.coinbase.com';
        
        // Coinbase uses hyphens: BTC-USD, not BTCUSDT
        const assets = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD'];

        console.log(`[Ingestor] 🟢 Connecting to Coinbase Stream...`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('[Ingestor] ✅ CONNECTED! Sending subscription...');
            
            // Coinbase requires a formal subscription packet
            const msg = {
                type: "subscribe",
                product_ids: assets,
                channels: ["ticker"]
            };
            
            ws.send(JSON.stringify(msg));
        });

        let tradeCount = 0;

        ws.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data);

                // We only care about 'ticker' updates
                if (message.type !== 'ticker') return;

                /* Coinbase Data Shape:
                   {
                       type: 'ticker',
                       product_id: 'BTC-USD',
                       price: '95000.00',
                       volume_24h: '10000',
                       ...
                   }
                */

                // 1. Normalize Ticker (Remove the hyphen to match our DB: BTC-USD -> BTCUSD)
                const rawTicker = message.product_id; // e.g. BTC-USD
                const ticker = rawTicker.replace('-', ''); // BTCUSD

                const price = parseFloat(message.price);
                // Coinbase sends 24h volume in ticker, or last_size for immediate trade size.
                // We'll use last_size (immediate volume) if available, else 1.0
                const volume = parseFloat(message.last_size || '1.0');

                // DEBUG LOG
                tradeCount++;
                if (tradeCount % 10 === 0) {
                    console.log(`[Ingestor] 💓 Pulse: ${ticker} @ $${price}`);
                }

                // 2. Save to DB
                const sql = `
                    INSERT INTO sentiment_metrics (ticker, sentiment_score, volume, time) 
                    VALUES ($1, $2, $3, NOW())
                `;
                
                await query(sql, [ticker, price, volume]);

            } catch (err) {
                // Ignore parsing errors
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