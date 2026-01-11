// ON-CHAIN ANALYTICS SERVICE
// Tracks blockchain metrics for fundamental analysis
// Uses free public APIs for basic on-chain data

interface OnChainMetrics {
    ticker: string;
    activeAddresses24h: number;
    txCount24h: number;
    avgTxValue: number;
    hashRate?: number;           // BTC only
    networkDifficulty?: number;  // BTC only
    stakingAPY?: number;         // POS coins
    tvl?: number;                // DeFi TVL
    lastUpdate: number;
}

// Cache for on-chain metrics
const metricsCache: Map<string, OnChainMetrics> = new Map();

// Public blockchain API endpoints (free tier)
const BLOCKCHAIN_APIS = {
    // Bitcoin
    BTC: {
        stats: 'https://blockchain.info/stats?format=json',
        difficulty: 'https://blockchain.info/q/getdifficulty'
    },
    // Ethereum (using public RPC is complex, so we simulate)
    ETH: {
        gasTracker: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle'
    }
};

// Simulated TVL data for major DeFi assets (in real production, use DefiLlama API)
const DEFI_TVL: Record<string, number> = {
    'ETH': 50_000_000_000,   // $50B
    'SOL': 5_000_000_000,    // $5B
    'AVAX': 2_000_000_000,   // $2B
    'MATIC': 1_500_000_000,  // $1.5B
    'LINK': 500_000_000,     // $500M
};

export const OnChainService = {
    // Start periodic on-chain data fetching
    startMonitoring: () => {
        console.log('[ONCHAIN] 🔗 On-chain analytics started');
        
        // Initial fetch
        OnChainService.fetchAllMetrics();
        
        // Refresh every 10 minutes (to avoid rate limits)
        setInterval(() => {
            OnChainService.fetchAllMetrics();
        }, 10 * 60 * 1000);
    },

    // Fetch metrics for all tracked assets
    fetchAllMetrics: async () => {
        // Bitcoin metrics
        await OnChainService.fetchBTCMetrics();
        
        // Simulate other assets (in production, use actual APIs)
        OnChainService.simulateMetrics('ETH');
        OnChainService.simulateMetrics('SOL');
        OnChainService.simulateMetrics('AVAX');
        OnChainService.simulateMetrics('LINK');
        OnChainService.simulateMetrics('DOT');
        
        console.log(`[ONCHAIN] Updated metrics for ${metricsCache.size} assets`);
    },

    // Fetch real BTC metrics from blockchain.info
    fetchBTCMetrics: async () => {
        try {
            const response = await fetch(BLOCKCHAIN_APIS.BTC.stats);
            if (!response.ok) throw new Error('Failed to fetch BTC stats');
            
            const data = await response.json();
            
            metricsCache.set('BTC', {
                ticker: 'BTC',
                activeAddresses24h: data.n_unique_addresses || 0,
                txCount24h: data.n_tx || 0,
                avgTxValue: data.total_btc_sent / data.n_tx / 100000000 || 0, // Convert satoshis
                hashRate: data.hash_rate || 0,
                networkDifficulty: data.difficulty || 0,
                lastUpdate: Date.now()
            });
        } catch (err) {
            // Use simulated data on error
            OnChainService.simulateMetrics('BTC');
        }
    },

    // Simulate metrics for assets without free APIs
    simulateMetrics: (ticker: string) => {
        const existing = metricsCache.get(ticker);
        
        // Add some variation to simulate real data
        const variation = () => 0.95 + Math.random() * 0.1; // ±5% variation
        
        const baseMetrics: Record<string, Partial<OnChainMetrics>> = {
            'BTC': { activeAddresses24h: 900000, txCount24h: 300000, avgTxValue: 0.5 },
            'ETH': { activeAddresses24h: 500000, txCount24h: 1200000, avgTxValue: 0.3, tvl: DEFI_TVL['ETH'] },
            'SOL': { activeAddresses24h: 800000, txCount24h: 50000000, avgTxValue: 0.01, stakingAPY: 7.5, tvl: DEFI_TVL['SOL'] },
            'AVAX': { activeAddresses24h: 100000, txCount24h: 200000, avgTxValue: 0.05, stakingAPY: 9.0, tvl: DEFI_TVL['AVAX'] },
            'DOT': { activeAddresses24h: 50000, txCount24h: 50000, avgTxValue: 0.2, stakingAPY: 14.0 },
            'LINK': { activeAddresses24h: 30000, txCount24h: 20000, avgTxValue: 0.15, tvl: DEFI_TVL['LINK'] },
            'MATIC': { activeAddresses24h: 200000, txCount24h: 3000000, avgTxValue: 0.005, stakingAPY: 5.0, tvl: DEFI_TVL['MATIC'] },
        };

        const base = baseMetrics[ticker] || { activeAddresses24h: 10000, txCount24h: 5000, avgTxValue: 0.1 };
        
        metricsCache.set(ticker, {
            ticker,
            activeAddresses24h: Math.floor((base.activeAddresses24h || 10000) * variation()),
            txCount24h: Math.floor((base.txCount24h || 5000) * variation()),
            avgTxValue: (base.avgTxValue || 0.1) * variation(),
            hashRate: ticker === 'BTC' ? 500_000_000 * variation() : undefined,
            stakingAPY: base.stakingAPY,
            tvl: base.tvl,
            lastUpdate: Date.now()
        });
    },

    // Get metrics for a specific asset
    getMetrics: (ticker: string): OnChainMetrics | null => {
        const base = ticker.replace('-USD', '').replace('-USDT', '');
        return metricsCache.get(base) || null;
    },

    // Get all metrics
    getAllMetrics: (): OnChainMetrics[] => {
        return Array.from(metricsCache.values());
    },

    // Calculate on-chain health score (0-100)
    getHealthScore: (ticker: string): { score: number; factors: string[] } => {
        const metrics = OnChainService.getMetrics(ticker);
        if (!metrics) return { score: 50, factors: ['No data available'] };

        const factors: string[] = [];
        let score = 50; // Baseline

        // Active addresses (higher = healthier)
        if (metrics.activeAddresses24h > 100000) {
            score += 15;
            factors.push(`High activity: ${(metrics.activeAddresses24h / 1000).toFixed(0)}k addresses`);
        } else if (metrics.activeAddresses24h < 10000) {
            score -= 10;
            factors.push(`Low activity: ${metrics.activeAddresses24h} addresses`);
        }

        // Transaction count
        if (metrics.txCount24h > 500000) {
            score += 10;
            factors.push(`High tx volume: ${(metrics.txCount24h / 1000000).toFixed(1)}M txs`);
        }

        // Staking APY (positive indicator for POS)
        if (metrics.stakingAPY && metrics.stakingAPY > 5) {
            score += 5;
            factors.push(`Staking yield: ${metrics.stakingAPY}%`);
        }

        // TVL for DeFi assets
        if (metrics.tvl && metrics.tvl > 1_000_000_000) {
            score += 10;
            factors.push(`Strong TVL: $${(metrics.tvl / 1_000_000_000).toFixed(1)}B`);
        }

        // Hash rate for BTC
        if (metrics.hashRate && metrics.hashRate > 400_000_000) {
            score += 15;
            factors.push('Strong hash rate');
        }

        return {
            score: Math.min(100, Math.max(0, score)),
            factors
        };
    },

    // Get network activity summary
    getNetworkSummary: (): { totalAddresses: number; totalTxs: number; avgHealth: number } => {
        const metrics = Array.from(metricsCache.values());
        
        const totalAddresses = metrics.reduce((sum, m) => sum + m.activeAddresses24h, 0);
        const totalTxs = metrics.reduce((sum, m) => sum + m.txCount24h, 0);
        
        const healthScores = metrics.map(m => OnChainService.getHealthScore(m.ticker).score);
        const avgHealth = healthScores.reduce((sum, s) => sum + s, 0) / healthScores.length;

        return {
            totalAddresses,
            totalTxs,
            avgHealth: Math.round(avgHealth)
        };
    }
};
