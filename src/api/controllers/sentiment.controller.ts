import { FastifyRequest, FastifyReply } from 'fastify';
import { SentimentService } from '../../modules/sentiment/sentiment.service';
import { PaperService } from '../../modules/execution/paper.service';

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

// 3. Market Heatmap (Volume Distribution)
export const getMarketHeatmap = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // We aggregate volume for all coins over the last hour
        const sql = `
            SELECT ticker, SUM(volume) as total_vol 
            FROM sentiment_metrics 
            WHERE time >= NOW() - INTERVAL '60 minutes'
            GROUP BY ticker 
            ORDER BY total_vol DESC 
            LIMIT 10;
        `;
        const result = await require('../../shared/db').query(sql);
        return reply.send({ success: true, data: result.rows });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate heatmap.' });
    }
};

// 4. SNIPER: Paper Trade History
export const getPaperTrades = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const sql = `SELECT * FROM paper_trades ORDER BY opened_at DESC LIMIT 20`;
        const result = await require('../../shared/db').query(sql);
        return reply.send({ success: true, data: result.rows });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch trades.' });
    }
};

// 5. SNIPER: Trading Stats
export const getPaperStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const stats = await PaperService.getStats();
        return reply.send({ success: true, data: stats });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch stats.' });
    }
};