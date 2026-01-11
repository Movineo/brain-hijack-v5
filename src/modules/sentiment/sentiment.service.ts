import { Worker } from 'worker_threads';
import path from 'path';
import { SentimentModel } from './sentiment.model';

export const SentimentService = {
    // 1. SINGLE ASSET ANALYSIS (For the Modal Chart)
    analyzeMarketBrain: async (ticker: string) => {
        // Fetch last 50 data points for this specific ticker
        const scores = await SentimentModel.getRecentSignals(ticker, 50);
        
        // Return the raw history so the frontend can plot the line chart
        return { 
            ticker, 
            history: scores // <--- FIXED: Now sending real data
        }; 
    },

    // 2. THE PANOPTICON (Multi-Asset Leaderboard)
    getMarketLeaderboard: async () => {
        // Get raw mixed data from DB (Last 3 minutes of ALL coins)
        const rawData = await SentimentModel.getMarketWindow();

        if (rawData.length === 0) return [];

        // Offload Grouping & Math to Worker
        return new Promise((resolve, reject) => {
            const workerPath = path.resolve(__dirname, './sentiment.worker.ts');
            
            const worker = new Worker(workerPath, {
                execArgv: ['-r', 'ts-node/register'] 
            });

            worker.postMessage({ type: 'MULTI_ASSET', rawData });

            worker.on('message', (result) => {
                if (result.status === 'success') {
                    resolve(result.data); // Returns the sorted Leaderboard
                } else {
                    reject(result.error);
                }
                worker.terminate();
            });

            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
            });
        });
    }
};