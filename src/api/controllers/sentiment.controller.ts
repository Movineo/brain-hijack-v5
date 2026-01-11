import { FastifyRequest, FastifyReply } from 'fastify';
import { SentimentService } from '../../modules/sentiment/sentiment.service';

// ORIGINAL: Single Coin Analysis (Keep for specific queries)
export const getSentimentAnalysis = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const analysis = await SentimentService.analyzeMarketBrain(ticker);
        return reply.send({ success: true, data: analysis });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to analyze sentiment.' });
    }
};

// NEW: Multi-Asset Leaderboard
export const getLeaderboard = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const leaderboard = await SentimentService.getMarketLeaderboard();
        return reply.send({ success: true, data: leaderboard });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate leaderboard.' });
    }
};