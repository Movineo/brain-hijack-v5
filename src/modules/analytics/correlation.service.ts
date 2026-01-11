import { query } from '../../shared/db';

// CORRELATION SERVICE
// Detects correlations between crypto assets
// When BTC moves, what else moves with it?

interface CorrelationPair {
    asset1: string;
    asset2: string;
    correlation: number;  // -1 to +1
    sampleSize: number;
}

interface CorrelationMatrix {
    assets: string[];
    matrix: number[][];
    generated: string;
}

export const CorrelationService = {
    // Calculate Pearson correlation coefficient
    pearsonCorrelation: (x: number[], y: number[]): number => {
        const n = Math.min(x.length, y.length);
        if (n < 3) return 0;

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }

        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt(
            ((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY))
        );

        if (denominator === 0) return 0;
        return numerator / denominator;
    },

    // Get price returns (percentage changes) for an asset
    getPriceReturns: async (ticker: string, hours: number = 24): Promise<number[]> => {
        try {
            const result = await query(`
                SELECT sentiment_score as price
                FROM sentiment_metrics
                WHERE ticker = $1 AND time >= NOW() - INTERVAL '${hours} hours'
                ORDER BY time ASC
            `, [ticker]);

            const prices = result.rows.map((r: any) => parseFloat(r.price));
            
            // Calculate returns (percentage change)
            const returns: number[] = [];
            for (let i = 1; i < prices.length; i++) {
                if (prices[i - 1] !== 0) {
                    returns.push((prices[i] - prices[i - 1]) / prices[i - 1] * 100);
                }
            }
            
            return returns;
        } catch (err) {
            console.error(`[CORRELATION] Error getting returns for ${ticker}:`, err);
            return [];
        }
    },

    // Calculate correlation between two assets
    getCorrelation: async (ticker1: string, ticker2: string, hours: number = 24): Promise<CorrelationPair> => {
        const returns1 = await CorrelationService.getPriceReturns(ticker1, hours);
        const returns2 = await CorrelationService.getPriceReturns(ticker2, hours);

        const minLength = Math.min(returns1.length, returns2.length);
        const correlation = CorrelationService.pearsonCorrelation(
            returns1.slice(-minLength),
            returns2.slice(-minLength)
        );

        return {
            asset1: ticker1,
            asset2: ticker2,
            correlation: Math.round(correlation * 1000) / 1000,
            sampleSize: minLength
        };
    },

    // Generate full correlation matrix for top assets
    generateMatrix: async (hours: number = 24): Promise<CorrelationMatrix> => {
        // Get top traded assets
        const topAssets = await query(`
            SELECT ticker, COUNT(*) as cnt
            FROM sentiment_metrics
            WHERE time >= NOW() - INTERVAL '${hours} hours'
            GROUP BY ticker
            ORDER BY cnt DESC
            LIMIT 10
        `);

        const assets = topAssets.rows.map((r: any) => r.ticker);
        const n = assets.length;
        
        // Initialize matrix
        const matrix: number[][] = [];
        for (let i = 0; i < n; i++) {
            matrix[i] = new Array(n).fill(0);
            matrix[i][i] = 1; // Self-correlation is 1
        }

        // Pre-fetch all returns
        const returnsMap: Map<string, number[]> = new Map();
        for (const asset of assets) {
            const returns = await CorrelationService.getPriceReturns(asset, hours);
            returnsMap.set(asset, returns);
        }

        // Calculate correlations
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const returns1 = returnsMap.get(assets[i]) || [];
                const returns2 = returnsMap.get(assets[j]) || [];
                const minLen = Math.min(returns1.length, returns2.length);
                
                const corr = CorrelationService.pearsonCorrelation(
                    returns1.slice(-minLen),
                    returns2.slice(-minLen)
                );
                
                matrix[i][j] = Math.round(corr * 1000) / 1000;
                matrix[j][i] = matrix[i][j]; // Symmetric
            }
        }

        return {
            assets,
            matrix,
            generated: new Date().toISOString()
        };
    },

    // Find highest correlated pairs
    getTopCorrelations: async (hours: number = 24, limit: number = 10): Promise<CorrelationPair[]> => {
        const { assets, matrix } = await CorrelationService.generateMatrix(hours);
        const pairs: CorrelationPair[] = [];

        const n = assets.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                pairs.push({
                    asset1: assets[i],
                    asset2: assets[j],
                    correlation: matrix[i][j],
                    sampleSize: 0 // Could be calculated if needed
                });
            }
        }

        // Sort by absolute correlation (strongest relationships)
        pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
        
        return pairs.slice(0, limit);
    },

    // Find anti-correlated pairs (potential hedges)
    getAntiCorrelations: async (hours: number = 24): Promise<CorrelationPair[]> => {
        const { assets, matrix } = await CorrelationService.generateMatrix(hours);
        const pairs: CorrelationPair[] = [];

        const n = assets.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (matrix[i][j] < -0.3) { // Significantly negative correlation
                    pairs.push({
                        asset1: assets[i],
                        asset2: assets[j],
                        correlation: matrix[i][j],
                        sampleSize: 0
                    });
                }
            }
        }

        pairs.sort((a, b) => a.correlation - b.correlation);
        return pairs;
    },

    // Get correlation of specific asset to all others
    getAssetCorrelations: async (ticker: string, hours: number = 24): Promise<CorrelationPair[]> => {
        const { assets, matrix } = await CorrelationService.generateMatrix(hours);
        const idx = assets.indexOf(ticker);
        
        if (idx === -1) return [];

        const correlations: CorrelationPair[] = [];
        for (let i = 0; i < assets.length; i++) {
            if (i !== idx) {
                correlations.push({
                    asset1: ticker,
                    asset2: assets[i],
                    correlation: matrix[idx][i],
                    sampleSize: 0
                });
            }
        }

        correlations.sort((a, b) => b.correlation - a.correlation);
        return correlations;
    }
};
