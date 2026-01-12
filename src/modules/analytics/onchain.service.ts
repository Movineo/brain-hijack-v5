// ON-CHAIN ANALYTICS SERVICE
// Real data from DefiLlama API (free, no auth required)
// DefiLlama API Docs: https://defillama.com/docs/api

interface OnChainMetrics {
    ticker: string;
    tvl: number;                 // Total Value Locked in USD
    tvlChange24h: number;        // 24h TVL change %
    tvlChange7d: number;         // 7d TVL change %
    mcapTvl?: number;            // Market Cap / TVL ratio
    dominance: number;           // Chain dominance %
    protocols: number;           // Number of protocols
    healthScore: number;         // 0-100 calculated health
    lastUpdate: number;
}

// Cache for on-chain metrics
const metricsCache: Map<string, OnChainMetrics> = new Map();

// DefiLlama API endpoints
const DEFILLAMA_API = 'https://api.llama.fi';

// Chain name mappings (ticker -> DefiLlama chain name)
const CHAIN_MAPPINGS: Record<string, string> = {
    'ETH': 'Ethereum',
    'SOL': 'Solana',
    'AVAX': 'Avalanche',
    'MATIC': 'Polygon',
    'ARB': 'Arbitrum',
    'OP': 'Optimism',
    'BNB': 'BSC',
    'FTM': 'Fantom',
    'NEAR': 'Near',
    'ATOM': 'Cosmos'
};

// For non-chain assets like BTC, LINK, DOT - we use protocol TVL
const PROTOCOL_MAPPINGS: Record<string, string> = {
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'MKR': 'makerdao'
};

export const OnChainService = {
    // Start periodic on-chain data fetching
    startMonitoring: () => {
        console.log('[ONCHAIN] 🔗 Connecting to DefiLlama API for real TVL data...');
        
        // Initial fetch
        OnChainService.fetchAllMetrics();
        
        // Refresh every 5 minutes
        setInterval(() => {
            OnChainService.fetchAllMetrics();
        }, 5 * 60 * 1000);
    },

    // Fetch all chain TVLs
    fetchAllMetrics: async () => {
        try {
            // Fetch all chains TVL in one call
            const chainsRes = await fetch(`${DEFILLAMA_API}/v2/chains`);
            const chainsData = await chainsRes.json();

            if (!Array.isArray(chainsData)) {
                console.error('[ONCHAIN] Invalid chains response');
                return;
            }

            // Calculate total TVL for dominance
            const totalTVL = chainsData.reduce((sum: number, chain: any) => sum + (chain.tvl || 0), 0);

            // Process each tracked chain
            for (const [ticker, chainName] of Object.entries(CHAIN_MAPPINGS)) {
                const chainData = chainsData.find((c: any) => 
                    c.name?.toLowerCase() === chainName.toLowerCase() ||
                    c.gecko_id?.toLowerCase() === chainName.toLowerCase()
                );

                if (chainData) {
                    const tvl = chainData.tvl || 0;
                    const metrics: OnChainMetrics = {
                        ticker,
                        tvl,
                        tvlChange24h: 0, // Will fetch separately if needed
                        tvlChange7d: 0,
                        dominance: totalTVL > 0 ? (tvl / totalTVL) * 100 : 0,
                        protocols: chainData.protocols || 0,
                        healthScore: OnChainService.calculateHealthScore(tvl, chainData.protocols || 0),
                        lastUpdate: Date.now()
                    };
                    metricsCache.set(ticker, metrics);
                }
            }

            // Fetch historical data for top chains to get change %
            await OnChainService.fetchChainHistory('ETH', 'ethereum');
            await OnChainService.fetchChainHistory('SOL', 'solana');
            await OnChainService.fetchChainHistory('AVAX', 'avalanche');

            // Add BTC metrics (special case - no DeFi TVL but network data)
            await OnChainService.fetchBTCMetrics();

            console.log(`[ONCHAIN] Updated metrics for ${metricsCache.size} chains`);

        } catch (err) {
            console.error('[ONCHAIN] DefiLlama API error:', err);
        }
    },

    // Fetch chain historical TVL for change calculation
    fetchChainHistory: async (ticker: string, chainSlug: string) => {
        try {
            const res = await fetch(`${DEFILLAMA_API}/v2/historicalChainTvl/${chainSlug}`);
            const data = await res.json();

            if (!Array.isArray(data) || data.length < 2) return;

            const current = data[data.length - 1]?.tvl || 0;
            const yesterday = data[data.length - 2]?.tvl || current;
            const weekAgo = data[Math.max(0, data.length - 8)]?.tvl || current;

            const existing = metricsCache.get(ticker);
            if (existing) {
                existing.tvlChange24h = yesterday > 0 ? ((current - yesterday) / yesterday) * 100 : 0;
                existing.tvlChange7d = weekAgo > 0 ? ((current - weekAgo) / weekAgo) * 100 : 0;
                metricsCache.set(ticker, existing);
            }
        } catch (err) {
            // Silently fail - historical data is optional
        }
    },

    // Fetch BTC network metrics (from blockchain.info)
    fetchBTCMetrics: async () => {
        try {
            const res = await fetch('https://blockchain.info/stats?format=json');
            const data = await res.json();

            // BTC doesn't have traditional DeFi TVL, but we can use market metrics
            // Use "wrapped BTC" TVL as a proxy for BTC in DeFi
            const wbtcRes = await fetch(`${DEFILLAMA_API}/protocol/wbtc`);
            const wbtcData = await wbtcRes.json();
            const btcInDefi = wbtcData.tvl || 0;

            const metrics: OnChainMetrics = {
                ticker: 'BTC',
                tvl: btcInDefi,
                tvlChange24h: wbtcData.change_1d || 0,
                tvlChange7d: wbtcData.change_7d || 0,
                dominance: 0, // BTC dominance is different metric
                protocols: 0,
                healthScore: OnChainService.calculateBTCHealth(data),
                lastUpdate: Date.now()
            };

            metricsCache.set('BTC', metrics);
        } catch (err) {
            // BTC metrics are optional
        }
    },

    // Calculate health score based on TVL and activity
    calculateHealthScore: (tvl: number, protocols: number): number => {
        let score = 50;

        // TVL scoring (higher = healthier)
        if (tvl > 50_000_000_000) score += 25;      // >$50B
        else if (tvl > 10_000_000_000) score += 20; // >$10B
        else if (tvl > 1_000_000_000) score += 15;  // >$1B
        else if (tvl > 100_000_000) score += 10;    // >$100M
        else if (tvl < 10_000_000) score -= 10;     // <$10M (risky)

        // Protocol diversity (more = healthier ecosystem)
        if (protocols > 500) score += 15;
        else if (protocols > 200) score += 10;
        else if (protocols > 50) score += 5;
        else if (protocols < 10) score -= 5;

        return Math.min(100, Math.max(0, score));
    },

    // Calculate BTC health from blockchain stats
    calculateBTCHealth: (data: any): number => {
        let score = 70; // BTC baseline is strong

        // Hash rate (network security)
        const hashRate = data.hash_rate || 0;
        if (hashRate > 500_000_000_000_000_000) score += 15; // >500 EH/s
        else if (hashRate > 300_000_000_000_000_000) score += 10;

        // Transaction count
        const txCount = data.n_tx || 0;
        if (txCount > 400000) score += 5;

        return Math.min(100, Math.max(0, score));
    },

    // Get metrics for specific ticker
    getMetrics: (ticker: string): OnChainMetrics | null => {
        return metricsCache.get(ticker.toUpperCase()) || null;
    },

    // Get all metrics
    getAllMetrics: (): OnChainMetrics[] => {
        return Array.from(metricsCache.values());
    },

    // Get health score with factors
    getHealthScore: (ticker: string): { score: number; factors: string[] } => {
        const metrics = metricsCache.get(ticker.toUpperCase());
        if (!metrics) {
            return { score: 50, factors: ['No data available'] };
        }

        const factors: string[] = [];
        
        if (metrics.tvl > 10_000_000_000) {
            factors.push(`Strong TVL: $${(metrics.tvl / 1_000_000_000).toFixed(1)}B`);
        } else if (metrics.tvl > 1_000_000_000) {
            factors.push(`Moderate TVL: $${(metrics.tvl / 1_000_000_000).toFixed(2)}B`);
        } else {
            factors.push(`TVL: $${(metrics.tvl / 1_000_000).toFixed(0)}M`);
        }

        if (metrics.tvlChange24h > 5) {
            factors.push(`TVL up ${metrics.tvlChange24h.toFixed(1)}% (24h)`);
        } else if (metrics.tvlChange24h < -5) {
            factors.push(`TVL down ${Math.abs(metrics.tvlChange24h).toFixed(1)}% (24h)`);
        }

        if (metrics.protocols > 100) {
            factors.push(`${metrics.protocols} active protocols`);
        }

        if (metrics.dominance > 1) {
            factors.push(`${metrics.dominance.toFixed(1)}% DeFi dominance`);
        }

        return {
            score: metrics.healthScore,
            factors
        };
    },

    // Get network summary (array format for frontend)
    getNetworkSummary: (): { ticker: string; healthScore: number; tvl: number; change24h: number }[] => {
        return Array.from(metricsCache.values())
            .map(m => ({
                ticker: m.ticker,
                healthScore: m.healthScore,
                tvl: m.tvl,
                change24h: m.tvlChange24h
            }))
            .sort((a, b) => b.healthScore - a.healthScore);
    }
};
