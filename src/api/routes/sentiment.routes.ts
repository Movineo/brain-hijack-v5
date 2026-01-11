import { FastifyInstance } from 'fastify';
import { getSentimentAnalysis, getLeaderboard } from '../controllers/sentiment.controller';

export default async function sentimentRoutes(fastify: FastifyInstance) {
    // 1. Specific Ticker (e.g., /api/v1/sentiment/BTC)
    fastify.get('/:ticker', getSentimentAnalysis);
    
    // 2. Full Leaderboard (e.g., /api/v1/sentiment/leaderboard)
    fastify.get('/leaderboard', getLeaderboard);
}