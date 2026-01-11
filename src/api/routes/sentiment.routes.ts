import { FastifyInstance } from 'fastify';
import { getSentimentAnalysis, getLeaderboard, getMarketHeatmap, getPaperTrades, getPaperStats, getPnLHistory, getHijackArchive } from '../controllers/sentiment.controller';

export default async function sentimentRoutes(fastify: FastifyInstance) {
    fastify.get('/leaderboard', getLeaderboard);
    fastify.get('/heatmap', getMarketHeatmap);
    fastify.get('/trades', getPaperTrades);      // Sniper: Trade history
    fastify.get('/stats', getPaperStats);        // Sniper: Performance stats
    fastify.get('/pnl-history', getPnLHistory);  // P&L chart data
    fastify.get('/archive', getHijackArchive);   // Historical hijacks
    fastify.get('/:ticker', getSentimentAnalysis);
}