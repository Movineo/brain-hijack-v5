import { query } from '../../shared/db';

// ML PREDICTOR SERVICE
// Pattern recognition for hijack force prediction
// Uses simple statistical methods (no external ML libraries needed)

interface PredictionResult {
    ticker: string;
    predictedForce: number;
    confidence: number;         // 0-100%
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    signals: string[];
    timestamp: Date;
}

interface PatternMatch {
    pattern: string;
    confidence: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
}

// Historical pattern signatures (learned from past hijacks)
const PATTERNS = {
    // Rapid volume spike + price acceleration = HIGH probability hijack
    VOLUME_SPIKE: { minVolMultiplier: 3, weight: 0.3 },
    // Consecutive positive accelerations = Momentum building
    MOMENTUM_BUILD: { consecutivePositive: 3, weight: 0.25 },
    // Price breakout from range = Potential hijack
    RANGE_BREAKOUT: { percentFromMean: 5, weight: 0.2 },
    // High force with low volume = Weak signal (potential reversal)
    WEAK_SIGNAL: { forceThreshold: 0.05, volThreshold: 0.5, weight: -0.15 },
    // News sentiment alignment = Confirmation
    NEWS_CONFIRM: { weight: 0.2 }
};

export const MLPredictorService = {
    // Generate prediction for a single asset
    predictAsset: async (ticker: string): Promise<PredictionResult> => {
        try {
            // Fetch recent data (last 2 hours)
            const data = await query(`
                SELECT sentiment_score as price, volume, time
                FROM sentiment_metrics
                WHERE ticker = $1 AND time >= NOW() - INTERVAL '2 hours'
                ORDER BY time DESC
                LIMIT 60
            `, [ticker]);

            if (data.rows.length < 10) {
                return {
                    ticker,
                    predictedForce: 0,
                    confidence: 0,
                    direction: 'NEUTRAL',
                    signals: ['Insufficient data'],
                    timestamp: new Date()
                };
            }

            const prices = data.rows.map((r: any) => parseFloat(r.price)).reverse();
            const volumes = data.rows.map((r: any) => parseFloat(r.volume)).reverse();

            // Calculate features
            const patterns = MLPredictorService.detectPatterns(prices, volumes);
            const prediction = MLPredictorService.calculatePrediction(patterns);

            return {
                ticker,
                predictedForce: prediction.force,
                confidence: prediction.confidence,
                direction: prediction.direction,
                signals: patterns.map(p => p.pattern),
                timestamp: new Date()
            };
        } catch (err) {
            console.error(`[ML] Prediction error for ${ticker}:`, err);
            return {
                ticker,
                predictedForce: 0,
                confidence: 0,
                direction: 'NEUTRAL',
                signals: ['Error'],
                timestamp: new Date()
            };
        }
    },

    // Detect patterns in price/volume data
    detectPatterns: (prices: number[], volumes: number[]): PatternMatch[] => {
        const patterns: PatternMatch[] = [];

        // 1. Volume Spike Detection
        const avgVolume = volumes.slice(0, -5).reduce((a, b) => a + b, 0) / (volumes.length - 5);
        const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        if (recentVolume > avgVolume * PATTERNS.VOLUME_SPIKE.minVolMultiplier) {
            patterns.push({
                pattern: `VOLUME_SPIKE (${(recentVolume / avgVolume).toFixed(1)}x)`,
                confidence: 70,
                direction: 'UP'
            });
        }

        // 2. Momentum Build (consecutive positive changes)
        const recentChanges = [];
        for (let i = prices.length - 5; i < prices.length; i++) {
            if (i > 0) recentChanges.push(prices[i] - prices[i - 1]);
        }
        const positiveCount = recentChanges.filter(c => c > 0).length;
        if (positiveCount >= PATTERNS.MOMENTUM_BUILD.consecutivePositive) {
            patterns.push({
                pattern: `MOMENTUM_BUILD (${positiveCount}/5 positive)`,
                confidence: 65,
                direction: 'UP'
            });
        } else if (recentChanges.filter(c => c < 0).length >= 3) {
            patterns.push({
                pattern: `MOMENTUM_DECLINE (${5 - positiveCount}/5 negative)`,
                confidence: 60,
                direction: 'DOWN'
            });
        }

        // 3. Range Breakout
        const mean = prices.slice(0, -5).reduce((a, b) => a + b, 0) / (prices.length - 5);
        const currentPrice = prices[prices.length - 1];
        const percentFromMean = ((currentPrice - mean) / mean) * 100;
        if (Math.abs(percentFromMean) > PATTERNS.RANGE_BREAKOUT.percentFromMean) {
            patterns.push({
                pattern: `RANGE_BREAKOUT (${percentFromMean.toFixed(2)}% from mean)`,
                confidence: 55,
                direction: percentFromMean > 0 ? 'UP' : 'DOWN'
            });
        }

        // 4. Acceleration Analysis (2nd derivative)
        const accelerations: number[] = [];
        for (let i = 1; i < prices.length - 1; i++) {
            const accel = prices[i + 1] - 2 * prices[i] + prices[i - 1];
            accelerations.push(accel);
        }
        const recentAccel = accelerations.slice(-3);
        const avgAccel = recentAccel.reduce((a, b) => a + b, 0) / recentAccel.length;
        if (Math.abs(avgAccel) > 0.001) {
            patterns.push({
                pattern: `ACCELERATION (${avgAccel > 0 ? '+' : ''}${avgAccel.toFixed(5)})`,
                confidence: 50,
                direction: avgAccel > 0 ? 'UP' : 'DOWN'
            });
        }

        // 5. RSI-like momentum (simple version)
        const gains = recentChanges.filter(c => c > 0);
        const losses = recentChanges.filter(c => c < 0).map(Math.abs);
        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0.0001;
        const rsi = 100 - (100 / (1 + avgGain / avgLoss));
        
        if (rsi > 70) {
            patterns.push({
                pattern: `OVERBOUGHT (RSI: ${rsi.toFixed(0)})`,
                confidence: 45,
                direction: 'DOWN'
            });
        } else if (rsi < 30) {
            patterns.push({
                pattern: `OVERSOLD (RSI: ${rsi.toFixed(0)})`,
                confidence: 45,
                direction: 'UP'
            });
        }

        return patterns;
    },

    // Calculate final prediction from patterns
    calculatePrediction: (patterns: PatternMatch[]): { force: number; confidence: number; direction: 'UP' | 'DOWN' | 'NEUTRAL' } => {
        if (patterns.length === 0) {
            return { force: 0, confidence: 0, direction: 'NEUTRAL' };
        }

        let upScore = 0;
        let downScore = 0;
        let totalConfidence = 0;

        patterns.forEach(p => {
            totalConfidence += p.confidence;
            if (p.direction === 'UP') upScore += p.confidence;
            if (p.direction === 'DOWN') downScore += p.confidence;
        });

        const avgConfidence = totalConfidence / patterns.length;
        const netScore = upScore - downScore;
        const direction = netScore > 10 ? 'UP' : netScore < -10 ? 'DOWN' : 'NEUTRAL';
        
        // Estimate force based on pattern strength
        const predictedForce = Math.abs(netScore / 100) * 0.1;

        return {
            force: Math.round(predictedForce * 10000) / 10000,
            confidence: Math.round(avgConfidence),
            direction
        };
    },

    // Batch predict all tracked assets
    predictAll: async (): Promise<PredictionResult[]> => {
        try {
            // Get list of active tickers
            const tickers = await query(`
                SELECT DISTINCT ticker FROM sentiment_metrics
                WHERE time >= NOW() - INTERVAL '30 minutes'
            `);

            const predictions: PredictionResult[] = [];
            for (const row of tickers.rows) {
                const prediction = await MLPredictorService.predictAsset(row.ticker);
                if (prediction.confidence > 0) {
                    predictions.push(prediction);
                }
            }

            // Sort by confidence
            predictions.sort((a, b) => b.confidence - a.confidence);
            return predictions;
        } catch (err) {
            console.error('[ML] Batch prediction error:', err);
            return [];
        }
    },

    // Get high-confidence predictions only
    getHighConfidencePredictions: async (minConfidence: number = 50): Promise<PredictionResult[]> => {
        const all = await MLPredictorService.predictAll();
        return all.filter(p => p.confidence >= minConfidence);
    }
};
