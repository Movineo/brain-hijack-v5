import { FastifyInstance } from 'fastify';
import { getSentimentAnalysis, getLeaderboard, getMarketHeatmap, getPaperTrades, getPaperStats } from '../controllers/sentiment.controller';

export default async function sentimentRoutes(fastify: FastifyInstance) {
    fastify.get('/leaderboard', getLeaderboard);
    fastify.get('/heatmap', getMarketHeatmap);
    fastify.get('/trades', getPaperTrades);      // Sniper: Trade history
    fastify.get('/stats', getPaperStats);        // Sniper: Performance stats
    fastify.get('/:ticker', getSentimentAnalysis);
}