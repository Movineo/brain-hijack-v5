import WebSocket from 'ws';
import { query } from '../../shared/db';

export const IngestorService = {
    startIngestion: () => {
        const wsUrl = 'wss://ws-feed.exchange.coinbase.com';
        
        // THE DRAGNET: Expanded Asset List (Top 20 Volatile Assets on Coinbase)
        const assets = [
            'BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', // The Majors
            'SHIB-USD', 'AVAX-USD', 'LINK-USD', 'UNI-USD', 'MATIC-USD', // The Alts
            'LTC-USD', 'XRP-USD', 'ADA-USD', 'DOT-USD', 'BCH-USD', // The Classics
            'PEPE-USD', 'SUI-USD', 'APT-USD', 'ARB-USD', 'OP-USD' // The New Guard
        ];

        console.log(`[Ingestor] 🟢 Connecting to Coinbase Stream for ${assets.length} assets...`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('[Ingestor] ✅ CONNECTED! Subscribing to market feed...');
            const msg = {
                type: "subscribe",
                product_ids: assets,
                channels: ["ticker"]
            };
            ws.send(JSON.stringify(msg));
        });

        ws.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data);
                if (message.type !== 'ticker') return;

                // Normalize Ticker: BTC-USD -> BTCUSD
                const ticker = message.product_id.replace('-', ''); 
                const price = parseFloat(message.price);
                const volume = parseFloat(message.last_size || '1.0');

                // SILENCE: We removed the console.log pulse check to save CPU/Logs.

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