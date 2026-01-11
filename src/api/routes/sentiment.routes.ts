import { FastifyInstance } from 'fastify';
import { getSentimentAnalysis, getLeaderboard, getMarketHeatmap } from '../controllers/sentiment.controller';

export default async function sentimentRoutes(fastify: FastifyInstance) {
    fastify.get('/leaderboard', getLeaderboard);
    fastify.get('/heatmap', getMarketHeatmap); // <--- NEW ROUTE
    fastify.get('/:ticker', getSentimentAnalysis);
}