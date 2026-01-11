// OPTIONS FLOW SERVICE
// Tracks unusual options activity for sentiment signals
// Note: Real options data requires paid APIs (e.g., Deribit API for crypto options)

interface OptionsFlow {
    ticker: string;
    type: 'CALL' | 'PUT';
    strike: number;
    expiry: string;
    premium: number;
    contracts: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    unusualActivity: boolean;
    timestamp: Date;
}

interface OptionsMetrics {
    ticker: string;
    putCallRatio: number;       // < 1 = bullish, > 1 = bearish
    totalCallVolume: number;
    totalPutVolume: number;
    maxPainPrice: number;       // Price where most options expire worthless
    impliedVolatility: number;  // IV percentage
    openInterest: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    lastUpdate: Date;
}

// Cache for options data
const optionsCache: Map<string, OptionsMetrics> = new Map();
const recentFlows: OptionsFlow[] = [];
const MAX_FLOWS = 100;

// Tracked crypto options assets (with active options markets)
const TRACKED_ASSETS = ['BTC', 'ETH', 'SOL'];

export const OptionsFlowService = {
    // Start options flow monitoring
    startMonitoring: () => {
        console.log('[OPTIONS] 📊 Options flow monitoring started');
        
        // Initial data
        OptionsFlowService.updateAllMetrics();
        
        // Update every 5 minutes
        setInterval(() => {
            OptionsFlowService.updateAllMetrics();
        }, 5 * 60 * 1000);
        
        // Simulate unusual flows every 15 minutes
        setInterval(() => {
            OptionsFlowService.simulateUnusualFlow();
        }, 15 * 60 * 1000);
    },

    // Update metrics for all tracked assets
    updateAllMetrics: () => {
        TRACKED_ASSETS.forEach(ticker => {
            const metrics = OptionsFlowService.simulateMetrics(ticker);
            optionsCache.set(ticker, metrics);
        });
        
        console.log(`[OPTIONS] Updated metrics for ${TRACKED_ASSETS.length} assets`);
    },

    // Simulate options metrics (replace with real Deribit API in production)
    simulateMetrics: (ticker: string): OptionsMetrics => {
        // Base values vary by asset
        const baseMetrics: Record<string, { pcr: number; iv: number; oi: number }> = {
            'BTC': { pcr: 0.7, iv: 55, oi: 500000 },
            'ETH': { pcr: 0.8, iv: 65, oi: 300000 },
            'SOL': { pcr: 0.9, iv: 90, oi: 50000 }
        };
        
        const base = baseMetrics[ticker] || { pcr: 0.75, iv: 60, oi: 100000 };
        const variation = () => 0.9 + Math.random() * 0.2;
        
        const putCallRatio = base.pcr * variation();
        const totalCallVolume = Math.floor(base.oi * 0.3 * variation());
        const totalPutVolume = Math.floor(totalCallVolume * putCallRatio);
        
        // Determine sentiment from put/call ratio
        let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (putCallRatio < 0.7) sentiment = 'BULLISH';
        else if (putCallRatio > 1.0) sentiment = 'BEARISH';
        
        // Simulate max pain (typically near current price)
        const basePrices: Record<string, number> = {
            'BTC': 45000,
            'ETH': 2500,
            'SOL': 120
        };
        const basePrice = basePrices[ticker] || 100;
        const maxPainPrice = basePrice * (0.95 + Math.random() * 0.1);
        
        return {
            ticker,
            putCallRatio: Math.round(putCallRatio * 100) / 100,
            totalCallVolume,
            totalPutVolume,
            maxPainPrice: Math.round(maxPainPrice),
            impliedVolatility: Math.round(base.iv * variation()),
            openInterest: Math.floor(base.oi * variation()),
            sentiment,
            lastUpdate: new Date()
        };
    },

    // Simulate unusual options flow
    simulateUnusualFlow: () => {
        // 30% chance of unusual activity
        if (Math.random() > 0.3) return;
        
        const ticker = TRACKED_ASSETS[Math.floor(Math.random() * TRACKED_ASSETS.length)];
        const type: 'CALL' | 'PUT' = Math.random() > 0.5 ? 'CALL' : 'PUT';
        
        const basePrices: Record<string, number> = {
            'BTC': 45000,
            'ETH': 2500,
            'SOL': 120
        };
        const basePrice = basePrices[ticker] || 100;
        
        // Unusual = far OTM with high volume
        const isOTM = Math.random() > 0.5;
        const strike = isOTM 
            ? basePrice * (type === 'CALL' ? 1.2 : 0.8) 
            : basePrice * (type === 'CALL' ? 1.05 : 0.95);
        
        const flow: OptionsFlow = {
            ticker,
            type,
            strike: Math.round(strike),
            expiry: OptionsFlowService.getNextExpiry(),
            premium: Math.floor(Math.random() * 5000000) + 1000000, // $1M-$6M
            contracts: Math.floor(Math.random() * 5000) + 1000,
            sentiment: type === 'CALL' ? 'BULLISH' : 'BEARISH',
            unusualActivity: true,
            timestamp: new Date()
        };
        
        recentFlows.unshift(flow);
        if (recentFlows.length > MAX_FLOWS) {
            recentFlows.pop();
        }
        
        console.log(`[OPTIONS] 🚨 Unusual ${type} flow: ${ticker} ${strike} ($${(flow.premium / 1000000).toFixed(1)}M)`);
    },

    // Get next expiry date (typically Friday)
    getNextExpiry: (): string => {
        const now = new Date();
        const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
        const nextFriday = new Date(now.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
        return nextFriday.toISOString().split('T')[0];
    },

    // Get metrics for a specific asset
    getMetrics: (ticker: string): OptionsMetrics | null => {
        return optionsCache.get(ticker) || null;
    },

    // Get all options metrics
    getAllMetrics: (): OptionsMetrics[] => {
        return Array.from(optionsCache.values());
    },

    // Get recent unusual flows
    getUnusualFlows: (limit: number = 20): OptionsFlow[] => {
        return recentFlows.filter(f => f.unusualActivity).slice(0, limit);
    },

    // Get all recent flows
    getRecentFlows: (limit: number = 50): OptionsFlow[] => {
        return recentFlows.slice(0, limit);
    },

    // Get overall market sentiment from options
    getMarketSentiment: (): { sentiment: string; confidence: number; signals: string[] } => {
        const metrics = Array.from(optionsCache.values());
        const signals: string[] = [];
        
        // Calculate aggregate put/call ratio
        const totalCalls = metrics.reduce((sum, m) => sum + m.totalCallVolume, 0);
        const totalPuts = metrics.reduce((sum, m) => sum + m.totalPutVolume, 0);
        const aggregatePCR = totalPuts / totalCalls;
        
        // Count bullish vs bearish flows
        const recentBullish = recentFlows.filter(f => f.sentiment === 'BULLISH' && f.unusualActivity).length;
        const recentBearish = recentFlows.filter(f => f.sentiment === 'BEARISH' && f.unusualActivity).length;
        
        // Determine sentiment
        let sentiment = 'NEUTRAL';
        let confidence = 50;
        
        if (aggregatePCR < 0.7) {
            sentiment = 'BULLISH';
            confidence = 70;
            signals.push(`Low P/C ratio: ${aggregatePCR.toFixed(2)}`);
        } else if (aggregatePCR > 1.0) {
            sentiment = 'BEARISH';
            confidence = 65;
            signals.push(`High P/C ratio: ${aggregatePCR.toFixed(2)}`);
        }
        
        if (recentBullish > recentBearish * 2) {
            signals.push(`Bullish flow dominance: ${recentBullish} vs ${recentBearish}`);
            confidence += 10;
        } else if (recentBearish > recentBullish * 2) {
            signals.push(`Bearish flow dominance: ${recentBearish} vs ${recentBullish}`);
            confidence += 10;
        }
        
        // Check for high IV (uncertainty)
        const avgIV = metrics.reduce((sum, m) => sum + m.impliedVolatility, 0) / metrics.length;
        if (avgIV > 80) {
            signals.push(`High implied volatility: ${avgIV.toFixed(0)}%`);
            confidence -= 10; // Less certain in high IV environment
        }
        
        return {
            sentiment,
            confidence: Math.min(100, Math.max(0, confidence)),
            signals
        };
    }
};
