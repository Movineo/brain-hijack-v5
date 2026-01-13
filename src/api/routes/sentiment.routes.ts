import { FastifyInstance } from 'fastify';
import { 
    getSentimentAnalysis, getLeaderboard, getMarketHeatmap, 
    getPaperTrades, getPaperStats, getPnLHistory, getHijackArchive, 
    exportTradesCSV, exportArchiveCSV, exportMetricsCSV,
    getConfig, updateConfig, activateKillSwitch, deactivateKillSwitch, resetConfig,
    getVapidPublicKey, subscribePush, unsubscribePush, testPushNotification,
    getWhaleAlerts, getWhaleSummary, getWhaleSignal,
    getCorrelationMatrix, getTopCorrelations, getAssetCorrelations, getAntiCorrelations,
    runQuickBacktest, runCustomBacktest,
    getTwitterSentiment, getTwitterAssetSentiment, getTwitterTrending,
    getMLPredictions, getMLAssetPrediction, getMLHighConfidence,
    getOnChainMetrics, getOnChainAssetMetrics, getNetworkSummary,
    getFearGreedIndex, getFearGreedHistory, getMarketMood,
    getOptionsMetrics, getOptionsAssetMetrics, getUnusualOptionsFlows, getOptionsMarketSentiment,
    createPriceAlert, getActiveAlerts, getAlertsByTicker, deletePriceAlert, getAlertStats, getTriggeredAlerts,
    startAutoTrader, stopAutoTrader, getAutoTraderStatus, updateAutoTraderConfig, analyzeAssetSignal, getLastSignal
} from '../controllers/sentiment.controller';

export default async function sentimentRoutes(fastify: FastifyInstance) {
    fastify.get('/leaderboard', getLeaderboard);
    fastify.get('/heatmap', getMarketHeatmap);
    fastify.get('/trades', getPaperTrades);      // Sniper: Trade history
    fastify.get('/stats', getPaperStats);        // Sniper: Performance stats
    fastify.get('/pnl-history', getPnLHistory);  // P&L chart data
    fastify.get('/archive', getHijackArchive);   // Historical hijacks
    
    // CSV EXPORTS
    fastify.get('/export/trades', exportTradesCSV);
    fastify.get('/export/archive', exportArchiveCSV);
    fastify.get('/export/metrics', exportMetricsCSV);
    
    // CONFIG & KILL SWITCH
    fastify.get('/config', getConfig);
    fastify.post('/config', updateConfig);
    fastify.post('/killswitch/activate', activateKillSwitch);
    fastify.post('/killswitch/deactivate', deactivateKillSwitch);
    fastify.post('/config/reset', resetConfig);
    
    // PUSH NOTIFICATIONS
    fastify.get('/push/key', getVapidPublicKey);
    fastify.post('/push/subscribe', subscribePush);
    fastify.post('/push/unsubscribe', unsubscribePush);
    fastify.post('/push/test', testPushNotification);
    
    // WHALE ALERTS
    fastify.get('/whales', getWhaleAlerts);
    fastify.get('/whales/summary', getWhaleSummary);
    fastify.get('/whales/:ticker', getWhaleSignal);
    
    // CORRELATION ANALYSIS
    fastify.get('/correlation/matrix', getCorrelationMatrix);
    fastify.get('/correlation/top', getTopCorrelations);
    fastify.get('/correlation/anti', getAntiCorrelations);
    fastify.get('/correlation/:ticker', getAssetCorrelations);
    
    // BACKTESTING
    fastify.get('/backtest/quick', runQuickBacktest);
    fastify.post('/backtest/custom', runCustomBacktest);
    
    // TWITTER SENTIMENT
    fastify.get('/twitter', getTwitterSentiment);
    fastify.get('/twitter/trending', getTwitterTrending);
    fastify.get('/twitter/:ticker', getTwitterAssetSentiment);
    
    // ML PREDICTIONS
    fastify.get('/ml/predictions', getMLPredictions);
    fastify.get('/ml/high-confidence', getMLHighConfidence);
    fastify.get('/ml/:ticker', getMLAssetPrediction);
    
    // ON-CHAIN ANALYTICS
    fastify.get('/onchain', getOnChainMetrics);
    fastify.get('/onchain/summary', getNetworkSummary);
    fastify.get('/onchain/:ticker', getOnChainAssetMetrics);
    
    // FEAR & GREED INDEX
    fastify.get('/fear-greed', getFearGreedIndex);
    fastify.get('/fear-greed/history', getFearGreedHistory);
    fastify.get('/fear-greed/mood', getMarketMood);
    
    // OPTIONS FLOW
    fastify.get('/options', getOptionsMetrics);
    fastify.get('/options/unusual', getUnusualOptionsFlows);
    fastify.get('/options/sentiment', getOptionsMarketSentiment);
    fastify.get('/options/:ticker', getOptionsAssetMetrics);
    
    // PRICE ALERTS
    fastify.post('/alerts', createPriceAlert);
    fastify.get('/alerts', getActiveAlerts);
    fastify.get('/alerts/stats', getAlertStats);
    fastify.get('/alerts/history', getTriggeredAlerts);
    fastify.get('/alerts/:ticker', getAlertsByTicker);
    fastify.delete('/alerts/:id', deletePriceAlert);
    
    // AUTOTRADER BOT
    fastify.post('/autotrader/start', startAutoTrader);
    fastify.post('/autotrader/stop', stopAutoTrader);
    fastify.get('/autotrader/status', getAutoTraderStatus);
    fastify.post('/autotrader/config', updateAutoTraderConfig);
    fastify.get('/autotrader/signal/:ticker', analyzeAssetSignal);
    fastify.get('/autotrader/signal', getLastSignal);
    
    fastify.get('/:ticker', getSentimentAnalysis);
}