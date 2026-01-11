import { TelegramService } from '../notifications/telegram.service';

// WHALE ALERT SERVICE
// Monitors large crypto transfers (simulated via public API)
// Note: Real whale-alert.io requires paid API key

interface WhaleTransaction {
    timestamp: number;
    symbol: string;
    amount: number;
    amountUsd: number;
    from: string;
    to: string;
    hash: string;
    blockchain: string;
}

// In-memory cache for whale transactions
const recentWhales: WhaleTransaction[] = [];
const MAX_CACHE_SIZE = 100;

// Whale threshold (minimum USD value to track)
const WHALE_THRESHOLD_USD = 1_000_000; // $1M+

// Watched assets (map crypto symbols to alert)
const WATCHED_SYMBOLS = new Set([
    'BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 
    'AVAX', 'LINK', 'DOT', 'MATIC', 'UNI', 'SHIB'
]);

export const WhaleService = {
    // Start whale monitoring (simulated)
    startMonitoring: () => {
        console.log('[WHALE] 🐋 Whale monitoring started');
        
        // Poll every 2 minutes (simulated whale data)
        setInterval(async () => {
            try {
                await WhaleService.fetchWhaleAlerts();
            } catch (err) {
                console.error('[WHALE] Fetch error:', err);
            }
        }, 120_000); // 2 minutes
    },

    // Fetch whale alerts (using blockchain.info for BTC as example)
    fetchWhaleAlerts: async () => {
        try {
            // Note: This is a simulation. Real whale tracking requires:
            // 1. whale-alert.io API (paid)
            // 2. On-chain analysis
            // 3. Exchange wallet monitoring
            
            // For now, we'll simulate by generating test data
            // In production, replace with actual API calls
            
            const simulated = WhaleService.simulateWhaleActivity();
            if (simulated) {
                recentWhales.unshift(simulated);
                if (recentWhales.length > MAX_CACHE_SIZE) {
                    recentWhales.pop();
                }
                
                // Alert if significant
                if (simulated.amountUsd >= WHALE_THRESHOLD_USD) {
                    console.log(`[WHALE] 🐋 ${simulated.symbol}: $${(simulated.amountUsd / 1e6).toFixed(1)}M moved`);
                    
                    // Send Telegram alert for major whales
                    if (simulated.amountUsd >= 10_000_000) {
                        TelegramService.sendMessage(
                            `🐋 *WHALE ALERT*\n` +
                            `${simulated.symbol}: $${(simulated.amountUsd / 1e6).toFixed(1)}M\n` +
                            `From: ${simulated.from.substring(0, 10)}...\n` +
                            `To: ${simulated.to.substring(0, 10)}...\n` +
                            `Chain: ${simulated.blockchain}`
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[WHALE] Error:', err);
        }
    },

    // Simulate whale activity (replace with real API in production)
    simulateWhaleActivity: (): WhaleTransaction | null => {
        // 10% chance of whale activity per check (for demo)
        if (Math.random() > 0.1) return null;

        const symbols = Array.from(WATCHED_SYMBOLS);
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        
        // Random whale amount between $1M and $100M
        const amountUsd = Math.floor(Math.random() * 99_000_000) + 1_000_000;
        
        const blockchains: Record<string, string> = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'DOGE': 'dogecoin',
            'XRP': 'ripple',
            'ADA': 'cardano',
            'AVAX': 'avalanche',
            'LINK': 'ethereum',
            'DOT': 'polkadot',
            'MATIC': 'polygon',
            'UNI': 'ethereum',
            'SHIB': 'ethereum'
        };

        const fromTypes = ['unknown', 'exchange', 'whale'];
        const toTypes = ['unknown', 'exchange', 'whale'];

        return {
            timestamp: Date.now(),
            symbol,
            amount: amountUsd / 50000, // Approximate token amount
            amountUsd,
            from: `${fromTypes[Math.floor(Math.random() * 3)]}_${Math.random().toString(36).substring(7)}`,
            to: `${toTypes[Math.floor(Math.random() * 3)]}_${Math.random().toString(36).substring(7)}`,
            hash: `0x${Math.random().toString(36).substring(2, 34)}${Math.random().toString(36).substring(2, 34)}`,
            blockchain: blockchains[symbol] || 'unknown'
        };
    },

    // Get recent whale transactions
    getRecentWhales: (limit: number = 20): WhaleTransaction[] => {
        return recentWhales.slice(0, limit);
    },

    // Get whale activity for specific symbol
    getWhalesBySymbol: (symbol: string): WhaleTransaction[] => {
        return recentWhales.filter(w => w.symbol === symbol.toUpperCase().replace('-USD', ''));
    },

    // Get whale summary (aggregate)
    getWhaleSummary: () => {
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        const recent = recentWhales.filter(w => w.timestamp >= last24h);
        
        const bySymbol: Record<string, { count: number; totalUsd: number }> = {};
        
        recent.forEach(w => {
            if (!bySymbol[w.symbol]) {
                bySymbol[w.symbol] = { count: 0, totalUsd: 0 };
            }
            bySymbol[w.symbol].count++;
            bySymbol[w.symbol].totalUsd += w.amountUsd;
        });

        return {
            total24h: recent.length,
            totalVolumeUsd: recent.reduce((sum, w) => sum + w.amountUsd, 0),
            bySymbol
        };
    },

    // Check if whale activity suggests bullish/bearish
    getWhaleSignal: (symbol: string): { signal: 'bullish' | 'bearish' | 'neutral'; reason: string } => {
        const whales = WhaleService.getWhalesBySymbol(symbol);
        const last1h = Date.now() - 60 * 60 * 1000;
        const recentWhales = whales.filter(w => w.timestamp >= last1h);

        if (recentWhales.length === 0) {
            return { signal: 'neutral', reason: 'No whale activity' };
        }

        // Count exchange inflows vs outflows
        let exchangeInflows = 0;
        let exchangeOutflows = 0;

        recentWhales.forEach(w => {
            if (w.to.includes('exchange')) exchangeInflows += w.amountUsd;
            if (w.from.includes('exchange')) exchangeOutflows += w.amountUsd;
        });

        // More inflows = likely selling = bearish
        // More outflows = likely holding = bullish
        if (exchangeInflows > exchangeOutflows * 1.5) {
            return { signal: 'bearish', reason: `$${(exchangeInflows / 1e6).toFixed(1)}M moved TO exchanges` };
        } else if (exchangeOutflows > exchangeInflows * 1.5) {
            return { signal: 'bullish', reason: `$${(exchangeOutflows / 1e6).toFixed(1)}M moved FROM exchanges` };
        }

        return { signal: 'neutral', reason: 'Mixed whale activity' };
    }
};
