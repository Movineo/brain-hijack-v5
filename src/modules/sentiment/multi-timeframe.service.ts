import { query } from '../../shared/db';

// Timeframes in minutes
const TIMEFRAMES = ['1m', '5m', '15m'];

// Standard Finite Difference for Acceleration
function calculateAcceleration(data: number[]): number {
    if (data.length < 3) return 0;
    const i = data.length - 2;
    return (data[i + 1] - (2 * data[i]) + data[i - 1]);
}

export const MultiTimeframeService = {
    // Calculate force for multiple timeframes
    calculateMultiForce: async (ticker: string) => {
        const results: Record<string, { force: number; trend: string }> = {};

        for (const tf of TIMEFRAMES) {
            const minutes = parseInt(tf);
            
            const sql = `
                SELECT sentiment_score, volume 
                FROM sentiment_metrics 
                WHERE ticker = $1 AND time >= NOW() - INTERVAL '${minutes * 3} minutes'
                ORDER BY time ASC
            `;
            
            const res = await query(sql, [ticker]);
            
            if (res.rows.length < 3) {
                results[tf] = { force: 0, trend: 'FLAT' };
                continue;
            }

            const prices = res.rows.map((r: any) => Number(r.sentiment_score));
            const volumes = res.rows.map((r: any) => Number(r.volume));
            
            const accel = calculateAcceleration(prices);
            const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
            const safeVolume = avgVolume > 1 ? Math.log10(avgVolume) : 0;
            const force = Math.abs(accel) * safeVolume;

            // Determine trend
            let trend = 'FLAT';
            if (accel > 0.001) trend = 'UP';
            else if (accel < -0.001) trend = 'DOWN';

            results[tf] = { force, trend };
        }

        return results;
    },

    // Get aggregated view for dashboard
    getMultiTimeframeSummary: async () => {
        // Get unique tickers from recent data
        const tickersRes = await query(`
            SELECT DISTINCT ticker FROM sentiment_metrics 
            WHERE time >= NOW() - INTERVAL '15 minutes'
        `);

        const summary: any[] = [];

        for (const row of tickersRes.rows) {
            const ticker = row.ticker;
            const forces = await MultiTimeframeService.calculateMultiForce(ticker);
            
            summary.push({
                ticker,
                force_1m: forces['1m']?.force || 0,
                force_5m: forces['5m']?.force || 0,
                force_15m: forces['15m']?.force || 0,
                trend_1m: forces['1m']?.trend || 'FLAT',
                trend_5m: forces['5m']?.trend || 'FLAT',
                trend_15m: forces['15m']?.trend || 'FLAT',
                // Confluence: All timeframes agree
                confluence: (
                    forces['1m']?.trend === forces['5m']?.trend &&
                    forces['5m']?.trend === forces['15m']?.trend &&
                    forces['1m']?.trend !== 'FLAT'
                )
            });
        }

        // Sort by 1m force (most active)
        summary.sort((a, b) => b.force_1m - a.force_1m);

        return summary;
    }
};
