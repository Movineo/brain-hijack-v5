import { query } from '../../shared/db';

// BACKTESTING ENGINE
// Test the hijack force strategy on historical data

interface BacktestConfig {
    startDate: Date;
    endDate: Date;
    entryThreshold: number;
    exitThreshold: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    tradeSizeUsd: number;
    tickers?: string[];  // Optional: specific tickers to test
}

interface BacktestTrade {
    ticker: string;
    entryPrice: number;
    exitPrice: number;
    entryTime: Date;
    exitTime: Date;
    forceAtEntry: number;
    pnlPercent: number;
    pnlUsd: number;
    exitReason: string;
}

interface BacktestResult {
    config: BacktestConfig;
    trades: BacktestTrade[];
    summary: {
        totalTrades: number;
        wins: number;
        losses: number;
        winRate: number;
        totalPnL: number;
        averagePnL: number;
        maxWin: number;
        maxLoss: number;
        profitFactor: number;
        sharpeRatio: number;
        maxDrawdown: number;
    };
    equity: { date: string; value: number }[];
}

// Standard Finite Difference for Acceleration (same as sentiment service)
function calculateAcceleration(data: number[], h: number = 1): number[] {
    const acceleration: number[] = [];
    if (data.length < 3) return [];
    
    for (let i = 1; i < data.length - 1; i++) {
        const s_prev = data[i - 1];
        const s_curr = data[i];
        const s_next = data[i + 1];
        const secondDerivative = (s_next - (2 * s_curr) + s_prev) / (h ** 2);
        acceleration.push(secondDerivative);
    }
    return acceleration;
}

export const BacktestService = {
    // Run backtest with given configuration
    runBacktest: async (config: BacktestConfig): Promise<BacktestResult> => {
        const trades: BacktestTrade[] = [];
        const openPositions: Map<string, { 
            entryPrice: number; 
            entryTime: Date; 
            force: number;
            highWaterMark: number;
        }> = new Map();

        // Fetch historical data
        const historicalData = await BacktestService.fetchHistoricalData(
            config.startDate,
            config.endDate,
            config.tickers
        );

        // Process data chronologically
        const sortedData = historicalData.sort((a, b) => 
            new Date(a.time).getTime() - new Date(b.time).getTime()
        );

        // Group by ticker for force calculation
        const priceHistory: Map<string, { price: number; volume: number; time: Date }[]> = new Map();

        for (const dataPoint of sortedData) {
            const ticker = dataPoint.ticker;
            const price = parseFloat(dataPoint.price);
            const volume = parseFloat(dataPoint.volume);
            const time = new Date(dataPoint.time);

            // Build price history
            if (!priceHistory.has(ticker)) {
                priceHistory.set(ticker, []);
            }
            priceHistory.get(ticker)!.push({ price, volume, time });

            // Keep only last 50 data points for calculation
            const history = priceHistory.get(ticker)!;
            if (history.length > 50) history.shift();

            // Calculate hijack force
            if (history.length >= 3) {
                const prices = history.map(h => h.price);
                const accelerations = calculateAcceleration(prices);
                const currentAccel = accelerations[accelerations.length - 1] || 0;
                const safeVolume = volume > 1 ? Math.log10(volume) : 0;
                const hijackForce = Math.abs(currentAccel) * safeVolume;

                // Check for exits first
                if (openPositions.has(ticker)) {
                    const position = openPositions.get(ticker)!;
                    const pnlPercent = ((price - position.entryPrice) / position.entryPrice) * 100;
                    
                    // Update high water mark
                    if (price > position.highWaterMark) {
                        position.highWaterMark = price;
                    }

                    let shouldExit = false;
                    let exitReason = '';

                    // Exit conditions
                    if (pnlPercent >= config.takeProfitPercent) {
                        shouldExit = true;
                        exitReason = 'TAKE_PROFIT';
                    } else if (pnlPercent <= config.stopLossPercent) {
                        shouldExit = true;
                        exitReason = 'STOP_LOSS';
                    } else if (hijackForce < config.exitThreshold) {
                        shouldExit = true;
                        exitReason = 'MOMENTUM_DIED';
                    }

                    if (shouldExit) {
                        const pnlUsd = (price - position.entryPrice) * (config.tradeSizeUsd / position.entryPrice);
                        
                        trades.push({
                            ticker,
                            entryPrice: position.entryPrice,
                            exitPrice: price,
                            entryTime: position.entryTime,
                            exitTime: time,
                            forceAtEntry: position.force,
                            pnlPercent,
                            pnlUsd,
                            exitReason
                        });

                        openPositions.delete(ticker);
                    }
                }

                // Check for entry
                if (!openPositions.has(ticker) && hijackForce > config.entryThreshold) {
                    openPositions.set(ticker, {
                        entryPrice: price,
                        entryTime: time,
                        force: hijackForce,
                        highWaterMark: price
                    });
                }
            }
        }

        // Calculate summary
        const summary = BacktestService.calculateSummary(trades, config.tradeSizeUsd);
        const equity = BacktestService.calculateEquityCurve(trades, config.tradeSizeUsd);

        return { config, trades, summary, equity };
    },

    // Fetch historical data from database
    fetchHistoricalData: async (startDate: Date, endDate: Date, tickers?: string[]) => {
        let sql = `
            SELECT ticker, sentiment_score as price, volume, time
            FROM sentiment_metrics
            WHERE time >= $1 AND time <= $2
        `;
        const params: any[] = [startDate.toISOString(), endDate.toISOString()];

        if (tickers && tickers.length > 0) {
            sql += ` AND ticker = ANY($3)`;
            params.push(tickers);
        }

        sql += ` ORDER BY time ASC`;

        const result = await query(sql, params);
        return result.rows;
    },

    // Calculate performance summary
    calculateSummary: (trades: BacktestTrade[], tradeSizeUsd: number) => {
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                totalPnL: 0,
                averagePnL: 0,
                maxWin: 0,
                maxLoss: 0,
                profitFactor: 0,
                sharpeRatio: 0,
                maxDrawdown: 0
            };
        }

        const wins = trades.filter(t => t.pnlUsd > 0);
        const losses = trades.filter(t => t.pnlUsd <= 0);

        const totalPnL = trades.reduce((sum, t) => sum + t.pnlUsd, 0);
        const grossProfit = wins.reduce((sum, t) => sum + t.pnlUsd, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlUsd, 0));

        // Calculate Sharpe Ratio (simplified)
        const returns = trades.map(t => t.pnlPercent);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

        // Calculate Max Drawdown
        let peak = tradeSizeUsd;
        let maxDrawdown = 0;
        let cumulative = tradeSizeUsd;

        trades.forEach(t => {
            cumulative += t.pnlUsd;
            if (cumulative > peak) peak = cumulative;
            const drawdown = ((peak - cumulative) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        return {
            totalTrades: trades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: Math.round((wins.length / trades.length) * 100 * 10) / 10,
            totalPnL: Math.round(totalPnL * 100) / 100,
            averagePnL: Math.round((totalPnL / trades.length) * 100) / 100,
            maxWin: Math.round(Math.max(...trades.map(t => t.pnlUsd)) * 100) / 100,
            maxLoss: Math.round(Math.min(...trades.map(t => t.pnlUsd)) * 100) / 100,
            profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? Infinity : 0,
            sharpeRatio: Math.round(sharpeRatio * 100) / 100,
            maxDrawdown: Math.round(maxDrawdown * 100) / 100
        };
    },

    // Calculate equity curve for charting
    calculateEquityCurve: (trades: BacktestTrade[], startingCapital: number) => {
        const equity: { date: string; value: number }[] = [];
        let cumulative = startingCapital;

        trades.forEach(trade => {
            cumulative += trade.pnlUsd;
            equity.push({
                date: trade.exitTime.toISOString().split('T')[0],
                value: Math.round(cumulative * 100) / 100
            });
        });

        return equity;
    },

    // Quick backtest with default params
    quickBacktest: async (hours: number = 24): Promise<BacktestResult> => {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

        return BacktestService.runBacktest({
            startDate,
            endDate,
            entryThreshold: 0.08,
            exitThreshold: 0.01,
            stopLossPercent: -2.0,
            takeProfitPercent: 3.0,
            tradeSizeUsd: 1000
        });
    }
};
