import { FastifyRequest, FastifyReply } from 'fastify';
import { SentimentService } from '../../modules/sentiment/sentiment.service';
import { PaperService } from '../../modules/execution/paper.service';
import { NewsService } from '../../modules/news/news.service';
import { ConfigService } from '../../shared/config.service';
import { PushNotificationService } from '../../modules/notifications/push.service';
import { WhaleService } from '../../modules/whale/whale.service';
import { CorrelationService } from '../../modules/analytics/correlation.service';
import { BacktestService } from '../../modules/analytics/backtest.service';
import { TwitterService } from '../../modules/sentiment/twitter.service';
import { MLPredictorService } from '../../modules/analytics/ml-predictor.service';
import { OnChainService } from '../../modules/analytics/onchain.service';
import { FearGreedService } from '../../modules/sentiment/fear-greed.service';
import { OptionsFlowService } from '../../modules/analytics/options-flow.service';
import { AlertsService } from '../../modules/notifications/alerts.service';

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

// NEW: Multi-Asset Leaderboard (with Narrative Fusion)
export const getLeaderboard = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const leaderboard = await SentimentService.getMarketLeaderboard();
        
        // ENRICHMENT: Add Narrative Data to each asset
        const enrichedBoard = leaderboard.map((asset: any) => {
            const news = NewsService.getNarrative(asset.ticker);
            return {
                ...asset,
                narrativeScore: news.score,
                latestHeadline: news.headline
            };
        });
        
        return reply.send({ success: true, data: enrichedBoard });
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

// 6. P&L History for Charts
export const getPnLHistory = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const history = await PaperService.getPnLHistory();
        return reply.send({ success: true, data: history });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch P&L history.' });
    }
};

// 7. Hijack Archive
export const getHijackArchive = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const sql = `SELECT * FROM hijack_archive ORDER BY recorded_at DESC LIMIT 50`;
        const result = await require('../../shared/db').query(sql);
        return reply.send({ success: true, data: result.rows });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch archive.' });
    }
};

// 8. CSV EXPORT: Trade History
export const exportTradesCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const sql = `SELECT * FROM paper_trades ORDER BY opened_at DESC`;
        const result = await require('../../shared/db').query(sql);
        
        const headers = ['id', 'ticker', 'entry_price', 'exit_price', 'quantity', 'profit', 'status', 'hijack_force_at_entry', 'opened_at', 'closed_at'];
        const csv = [
            headers.join(','),
            ...result.rows.map((row: any) => 
                headers.map(h => {
                    const val = row[h];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
                    return val;
                }).join(',')
            )
        ].join('\n');
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=paper_trades.csv');
        return reply.send(csv);
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to export trades.' });
    }
};

// 9. CSV EXPORT: Hijack Archive
export const exportArchiveCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const sql = `SELECT * FROM hijack_archive ORDER BY recorded_at DESC`;
        const result = await require('../../shared/db').query(sql);
        
        const headers = ['id', 'ticker', 'price', 'hijack_force', 'narrative_score', 'event_type', 'recorded_at'];
        const csv = [
            headers.join(','),
            ...result.rows.map((row: any) => 
                headers.map(h => {
                    const val = row[h];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
                    return val;
                }).join(',')
            )
        ].join('\n');
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=hijack_archive.csv');
        return reply.send(csv);
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to export archive.' });
    }
};

// 10. CSV EXPORT: Metrics Data
export const exportMetricsCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { hours = 24 } = request.query as { hours?: number };
        const sql = `
            SELECT ticker, sentiment_score, volume, time 
            FROM sentiment_metrics 
            WHERE time >= NOW() - INTERVAL '${Math.min(hours, 168)} hours'
            ORDER BY time DESC
        `;
        const result = await require('../../shared/db').query(sql);
        
        const headers = ['ticker', 'price', 'volume', 'timestamp'];
        const csv = [
            headers.join(','),
            ...result.rows.map((row: any) => 
                [row.ticker, row.sentiment_score, row.volume, row.time].join(',')
            )
        ].join('\n');
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename=metrics_${hours}h.csv`);
        return reply.send(csv);
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to export metrics.' });
    }
};

// ============= CONFIG & KILL SWITCH =============

// 11. GET CONFIG: Current trading configuration
export const getConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const config = ConfigService.getConfig();
        return reply.send({ success: true, data: config });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get config.' });
    }
};

// 12. UPDATE CONFIG: Partial update of config
export const updateConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const updates = request.body as any;
        const config = ConfigService.updateConfig(updates);
        return reply.send({ success: true, data: config, message: 'Config updated' });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to update config.' });
    }
};

// 13. KILL SWITCH: Emergency stop
export const activateKillSwitch = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        ConfigService.activateKillSwitch();
        return reply.send({ 
            success: true, 
            message: '⛔ KILL SWITCH ACTIVATED - All trading stopped',
            data: ConfigService.getConfig()
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to activate kill switch.' });
    }
};

// 14. DEACTIVATE KILL SWITCH
export const deactivateKillSwitch = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        ConfigService.deactivateKillSwitch();
        return reply.send({ 
            success: true, 
            message: '✅ Kill switch deactivated - Paper trading resumed',
            data: ConfigService.getConfig()
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to deactivate kill switch.' });
    }
};

// 15. RESET CONFIG: Restore defaults
export const resetConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const config = ConfigService.resetToDefaults();
        return reply.send({ success: true, data: config, message: 'Config reset to defaults' });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to reset config.' });
    }
};

// ============= PUSH NOTIFICATIONS =============

// 16. GET VAPID PUBLIC KEY
export const getVapidPublicKey = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const publicKey = PushNotificationService.getPublicKey();
        return reply.send({ success: true, publicKey });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get public key.' });
    }
};

// 17. SUBSCRIBE TO PUSH NOTIFICATIONS
export const subscribePush = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const subscription = request.body as any;
        const result = PushNotificationService.subscribe(subscription);
        return reply.send(result);
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to subscribe.' });
    }
};

// 18. UNSUBSCRIBE FROM PUSH NOTIFICATIONS
export const unsubscribePush = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { endpoint } = request.body as { endpoint: string };
        const result = PushNotificationService.unsubscribe(endpoint);
        return reply.send(result);
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to unsubscribe.' });
    }
};

// 19. TEST PUSH NOTIFICATION (Admin only)
export const testPushNotification = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const result = await PushNotificationService.sendToAll(
            'Test Notification',
            'This is a test push notification from Brain Hijack',
            { type: 'test' }
        );
        return reply.send({ 
            success: true, 
            message: `Notification sent to ${result.sent} subscribers`,
            sent: result.sent,
            failed: result.failed
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to send test notification.' });
    }
};

// ============= WHALE ALERTS =============

// 20. GET WHALE ALERTS: Recent large transfers
export const getWhaleAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const whales = WhaleService.getRecentWhales(20);
        return reply.send({ success: true, data: whales });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get whale alerts.' });
    }
};

// 17. GET WHALE SUMMARY: Aggregate whale activity
export const getWhaleSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const summary = WhaleService.getWhaleSummary();
        return reply.send({ success: true, data: summary });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get whale summary.' });
    }
};

// 18. GET WHALE SIGNAL: Bullish/Bearish indicator for asset
export const getWhaleSignal = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const signal = WhaleService.getWhaleSignal(ticker);
        return reply.send({ success: true, data: signal });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get whale signal.' });
    }
};

// ============= CORRELATION ANALYSIS =============

// 19. CORRELATION MATRIX: Full asset correlation
export const getCorrelationMatrix = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { hours = 24 } = request.query as { hours?: number };
        const matrix = await CorrelationService.generateMatrix(Math.min(hours, 168));
        return reply.send({ success: true, data: matrix });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate correlation matrix.' });
    }
};

// 20. TOP CORRELATIONS: Strongest relationships
export const getTopCorrelations = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { hours = 24, limit = 10 } = request.query as { hours?: number; limit?: number };
        const correlations = await CorrelationService.getTopCorrelations(hours, limit);
        return reply.send({ success: true, data: correlations });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get top correlations.' });
    }
};

// 21. ASSET CORRELATIONS: How one asset correlates to others
export const getAssetCorrelations = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const correlations = await CorrelationService.getAssetCorrelations(ticker);
        return reply.send({ success: true, data: correlations });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get asset correlations.' });
    }
};

// 22. ANTI-CORRELATIONS: Potential hedges
export const getAntiCorrelations = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const correlations = await CorrelationService.getAntiCorrelations();
        return reply.send({ success: true, data: correlations });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get anti-correlations.' });
    }
};

// ============= BACKTESTING =============

// 23. QUICK BACKTEST: Test strategy on recent data
export const runQuickBacktest = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { hours = 24 } = request.query as { hours?: number };
        const result = await BacktestService.quickBacktest(Math.min(hours, 168));
        return reply.send({ success: true, data: result });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to run backtest.' });
    }
};

// 24. CUSTOM BACKTEST: Full configuration
export const runCustomBacktest = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const config = request.body as {
            startDate: string;
            endDate: string;
            entryThreshold?: number;
            exitThreshold?: number;
            stopLossPercent?: number;
            takeProfitPercent?: number;
            tradeSizeUsd?: number;
            tickers?: string[];
        };

        const result = await BacktestService.runBacktest({
            startDate: new Date(config.startDate),
            endDate: new Date(config.endDate),
            entryThreshold: config.entryThreshold || 0.08,
            exitThreshold: config.exitThreshold || 0.01,
            stopLossPercent: config.stopLossPercent || -2.0,
            takeProfitPercent: config.takeProfitPercent || 3.0,
            tradeSizeUsd: config.tradeSizeUsd || 1000,
            tickers: config.tickers
        });

        return reply.send({ success: true, data: result });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to run custom backtest.' });
    }
};

// ============= TWITTER SENTIMENT =============

// 25. GET ALL TWITTER SENTIMENT
export const getTwitterSentiment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const sentiment = TwitterService.getAllSentiment();
        return reply.send({ success: true, data: sentiment });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get Twitter sentiment.' });
    }
};

// 26. GET SOCIAL SENTIMENT FOR SPECIFIC ASSET
export const getTwitterAssetSentiment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const sentiment = TwitterService.getSentiment(ticker);
        return reply.send({ success: true, data: sentiment });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get asset social sentiment.' });
    }
};

// 27. GET TRENDING ON TWITTER
export const getTwitterTrending = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { limit = 5 } = request.query as { limit?: number };
        const trending = TwitterService.getTrending(Math.min(limit, 20));
        return reply.send({ success: true, data: trending });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get trending.' });
    }
};

// ============= ML PREDICTIONS =============

// 28. GET ALL PREDICTIONS
export const getMLPredictions = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const predictions = await MLPredictorService.predictAll();
        return reply.send({ success: true, data: predictions });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get predictions.' });
    }
};

// 29. GET PREDICTION FOR SPECIFIC ASSET
export const getMLAssetPrediction = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const prediction = await MLPredictorService.predictAsset(ticker);
        return reply.send({ success: true, data: prediction });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get asset prediction.' });
    }
};

// 30. GET HIGH CONFIDENCE PREDICTIONS
export const getMLHighConfidence = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { minConfidence = 50 } = request.query as { minConfidence?: number };
        const predictions = await MLPredictorService.getHighConfidencePredictions(minConfidence);
        return reply.send({ success: true, data: predictions });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get high confidence predictions.' });
    }
};

// ============= ON-CHAIN ANALYTICS =============

// 31. GET ALL ON-CHAIN METRICS
export const getOnChainMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const metrics = OnChainService.getAllMetrics();
        return reply.send({ success: true, data: metrics });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get on-chain metrics.' });
    }
};

// 32. GET ON-CHAIN METRICS FOR SPECIFIC ASSET
export const getOnChainAssetMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const metrics = OnChainService.getMetrics(ticker);
        const health = OnChainService.getHealthScore(ticker);
        return reply.send({ success: true, data: { metrics, health } });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get asset on-chain metrics.' });
    }
};

// 33. GET NETWORK SUMMARY
export const getNetworkSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const summary = OnChainService.getNetworkSummary();
        return reply.send({ success: true, data: summary });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get network summary.' });
    }
};

// ============= FEAR & GREED INDEX =============

// 34. GET FEAR & GREED INDEX
export const getFearGreedIndex = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const index = FearGreedService.getIndex();
        return reply.send({ success: true, data: index });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get Fear & Greed index.' });
    }
};

// 35. GET FEAR & GREED HISTORY
export const getFearGreedHistory = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { hours = 24 } = request.query as { hours?: number };
        const history = FearGreedService.getHistory(Math.min(hours, 168));
        return reply.send({ success: true, data: history });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get Fear & Greed history.' });
    }
};

// 36. GET MARKET MOOD SUMMARY
export const getMarketMood = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const index = FearGreedService.getIndex();
        const mood = FearGreedService.getMoodSummary();
        return reply.send({ success: true, data: { index, mood } });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get market mood.' });
    }
};

// ============= OPTIONS FLOW =============

// 37. GET ALL OPTIONS METRICS
export const getOptionsMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const metrics = OptionsFlowService.getAllMetrics();
        return reply.send({ success: true, data: metrics });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get options metrics.' });
    }
};

// 38. GET OPTIONS METRICS FOR SPECIFIC ASSET
export const getOptionsAssetMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const metrics = OptionsFlowService.getMetrics(ticker);
        return reply.send({ success: true, data: metrics });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get asset options metrics.' });
    }
};

// 39. GET UNUSUAL OPTIONS FLOWS
export const getUnusualOptionsFlows = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { limit = 20 } = request.query as { limit?: number };
        const flows = OptionsFlowService.getUnusualFlows(Math.min(limit, 50));
        return reply.send({ success: true, data: flows });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get unusual flows.' });
    }
};

// 40. GET OPTIONS MARKET SENTIMENT
export const getOptionsMarketSentiment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const sentiment = OptionsFlowService.getMarketSentiment();
        return reply.send({ success: true, data: sentiment });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get options sentiment.' });
    }
};

// ============= PRICE ALERTS =============

// 41. CREATE PRICE ALERT
export const createPriceAlert = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker, target_price, condition } = request.body as {
        ticker: string;
        target_price: number;
        condition: 'above' | 'below';
    };
    try {
        if (!ticker || !target_price || !condition) {
            return reply.status(400).send({ error: 'Missing required fields: ticker, target_price, condition' });
        }
        const alert = await AlertsService.getInstance().createAlert({ ticker, target_price, condition });
        return reply.send({ success: true, data: alert });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to create alert.' });
    }
};

// 42. GET ACTIVE ALERTS
export const getActiveAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const alerts = await AlertsService.getInstance().getActiveAlerts();
        return reply.send({ success: true, data: alerts });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get alerts.' });
    }
};

// 43. GET ALERTS BY TICKER
export const getAlertsByTicker = async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticker } = request.params as { ticker: string };
    try {
        const alerts = await AlertsService.getInstance().getAlertsByTicker(ticker);
        return reply.send({ success: true, data: alerts });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get ticker alerts.' });
    }
};

// 44. DELETE ALERT
export const deletePriceAlert = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
        const deleted = await AlertsService.getInstance().deleteAlert(parseInt(id));
        if (deleted) {
            return reply.send({ success: true, message: 'Alert deleted' });
        }
        return reply.status(404).send({ error: 'Alert not found' });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to delete alert.' });
    }
};

// 45. GET ALERT STATS
export const getAlertStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const stats = await AlertsService.getInstance().getStats();
        return reply.send({ success: true, data: stats });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get alert stats.' });
    }
};

// 46. GET TRIGGERED ALERT HISTORY
export const getTriggeredAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { limit = 20 } = request.query as { limit?: number };
        const history = await AlertsService.getInstance().getTriggeredHistory(Math.min(limit, 100));
        return reply.send({ success: true, data: history });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to get triggered alerts.' });
    }
}