import { SentimentModel } from './sentiment.model';
import { TelegramService } from '../notifications/telegram.service';
import { PaperService } from '../execution/paper.service';

// Standard Finite Difference for Acceleration (S''(t))
function calculateAcceleration(data: number[], h: number = 1): number[] {
    const acceleration: number[] = [];
    if (data.length < 3) return [];
    
    for (let i = 1; i < data.length - 1; i++) {
        const s_prev = data[i - 1];
        const s_curr = data[i];
        const s_next = data[i + 1];
        
        // Central Difference Formula
        const secondDerivative = (s_next - (2 * s_curr) + s_prev) / (h ** 2);
        acceleration.push(secondDerivative);
    }
    return acceleration;
}

export const SentimentService = {
    // 1. SINGLE ASSET ANALYSIS (For the Modal Chart)
    analyzeMarketBrain: async (ticker: string) => {
        try {
            const scores = await SentimentModel.getRecentSignals(ticker, 50);
            return { ticker, history: scores }; 
        } catch (error) {
            console.error(`[SentimentService] Error analyzing ${ticker}:`, error);
            return { ticker, history: [] };
        }
    },

    // 2. THE PANOPTICON (Multi-Asset Leaderboard) - WORKER-FREE VERSION
    getMarketLeaderboard: async () => {
        try {
            const rawData = await SentimentModel.getMarketWindow();

            if (rawData.length === 0) return [];

            const leaderboard: any[] = [];

            // 1. GROUPING LOGIC (moved from worker)
            const groups: Record<string, { score: number, volume: number }[]> = {};

            rawData.forEach((row: any) => {
                const t = row.ticker;
                if (!groups[t]) groups[t] = [];
                groups[t].push({
                    score: Number(row.sentiment_score),
                    volume: Number(row.volume)
                });
            });

            // 2. MATH LOGIC (moved from worker)
            for (const ticker in groups) {
                const history = groups[ticker];

                if (history.length < 3) continue;

                const priceData = history.map(h => h.score);
                const accelerations = calculateAcceleration(priceData);

                const currentAccel = accelerations[accelerations.length - 1] || 0;
                const latestVolume = history[history.length - 1].volume;
                const latestPrice = history[history.length - 1].score;

                // FORCE FORMULA: |Accel| * Log10(Volume)
                const safeVolume = latestVolume > 1 ? Math.log10(latestVolume) : 0;
                const hijackForce = Math.abs(currentAccel) * safeVolume;

                // THRESHOLD: > 0.05 is a significant move
                const isHijacking = hijackForce > 0.05; 

                // 3. TRIGGER TELEGRAM (now in main thread - reliable!)
                if (isHijacking) {
                    TelegramService.sendHijackAlert(ticker, latestPrice, hijackForce);
                }

                leaderboard.push({
                    ticker,
                    hijackForce,
                    latestPrice,
                    isHijacking
                });
            }

            // 3. RANKING
            leaderboard.sort((a, b) => b.hijackForce - a.hijackForce);

            // 4. SNIPER: Evaluate for paper trades (Fire & Forget)
            PaperService.evaluateMarketState(leaderboard).catch(err => 
                console.error('[SNIPER] Evaluation error:', err)
            );

            return leaderboard;
        } catch (error) {
            console.error('[SentimentService] Leaderboard error:', error);
            return []; // Return empty array instead of crashing
        }
    }
};