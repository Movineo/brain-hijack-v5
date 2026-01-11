import { parentPort } from 'worker_threads';
// 1. IMPORT TELEGRAM SERVICE
import { TelegramService } from '../notifications/telegram.service'; 

// Standard Finite Difference for Acceleration (S''(t))
function calculateAcceleration(data: number[], h: number = 1) {
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

if (parentPort) {
    parentPort.on('message', async (taskData: { type: string, rawData: any[] }) => {
        try {
            if (taskData.type === 'MULTI_ASSET') {
                const { rawData } = taskData;
                const leaderboard: any[] = [];

                // 1. GROUPING LOGIC
                const groups: Record<string, { score: number, volume: number }[]> = {};

                rawData.forEach((row: any) => {
                    const t = row.ticker;
                    if (!groups[t]) groups[t] = [];
                    groups[t].push({
                        score: Number(row.sentiment_score),
                        volume: Number(row.volume)
                    });
                });

                // 2. MATH LOGIC
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

                    // THRESHOLD: > 0.05 is a significant move. 
                    // (0.0001 is too sensitive for Telegram)
                    const isHijacking = hijackForce > 0.05; 

                    // 3. TRIGGER TELEGRAM
                    if (isHijacking) {
                         // Fire and forget
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

                parentPort?.postMessage({
                    status: 'success',
                    data: leaderboard
                });
            }

        } catch (error) {
            parentPort?.postMessage({ status: 'error', error });
        }
    });
}