import WebSocket from 'ws';
import { query } from '../../shared/db';

export const IngestorService = {
    startIngestion: (tickers: string[] = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt']) => {
        
        // Format for Binance Combined Stream:
        // streamName = <symbol>@aggTrade
        // URL = wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/...
        
        const streams = tickers.map(t => `${t.toLowerCase()}@aggTrade`).join('/');
        const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

        console.log(`[Ingestor] Connecting to Panopticon Stream: ${tickers.join(', ')}`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('[Ingestor] Connected! Hunting for anomalies...');
        });

        ws.on('message', async (data: string) => {
            const message = JSON.parse(data);
            
            // Combined stream format: { stream: 'btcusdt@aggTrade', data: { ...trade... } }
            const trade = message.data;
            const ticker = trade.s; // e.g., 'BTCUSDT'
            const price = parseFloat(trade.p);
            const volume = parseFloat(trade.q);
            
            try {
                const sql = `
                    INSERT INTO sentiment_metrics (ticker, sentiment_score, volume, time) 
                    VALUES ($1, $2, $3, NOW())
                `;
                
                // We use the ticker symbol from the stream (e.g., BTCUSDT)
                await query(sql, [ticker, price, volume]);
                
                // No dots this time, it's too much data
            } catch (err) {
                console.error("DB Error", err);
            }
        });

        ws.on('error', (err) => {
            console.error('[Ingestor] Connection Error:', err);
        });
    }
};