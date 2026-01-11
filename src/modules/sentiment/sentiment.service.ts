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
            history: scores 
        }; 
    },

    // 2. THE PANOPTICON (Multi-Asset Leaderboard)
    getMarketLeaderboard: async () => {
        // Get raw mixed data from DB (Last 3 minutes of ALL coins)
        const rawData = await SentimentModel.getMarketWindow();

        if (rawData.length === 0) return [];

        // Offload Grouping & Math to Worker
        return new Promise((resolve, reject) => {
            
            // --- FIX: SMART WORKER PATHING ---
            // 1. Check if we are running as a .ts file (Dev) or .js file (Prod)
            const isTs = __filename.endsWith('.ts');
            
            // 2. Select the correct worker file extension
            const workerFileName = isTs ? './sentiment.worker.ts' : './sentiment.worker.js';
            const workerPath = path.resolve(__dirname, workerFileName);
            
            // 3. Only use 'ts-node' logic if we are in Development
            const workerOptions = isTs ? { execArgv: ['-r', 'ts-node/register'] } : {};

            // Initialize Worker with dynamic path and options
            const worker = new Worker(workerPath, workerOptions);

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