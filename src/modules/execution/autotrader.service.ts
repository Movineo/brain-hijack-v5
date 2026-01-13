// AUTOTRADER BOT SERVICE
// Automated paper trading based on ML signals + multi-source sentiment alignment
// Combines: ML Predictions + Fear/Greed + Social Sentiment + Options Flow + On-Chain

import { query } from '../../shared/db';
import { TelegramService } from '../notifications/telegram.service';
import { MLPredictorService } from '../analytics/ml-predictor.service';
import { FearGreedService } from '../sentiment/fear-greed.service';
import { TwitterService } from '../sentiment/twitter.service';
import { OptionsFlowService } from '../analytics/options-flow.service';
import { OnChainService } from '../analytics/onchain.service';
import { ConfigService } from '../../shared/config.service';
import { SentimentService } from '../sentiment/sentiment.service';

// Bot Configuration
interface BotConfig {
    enabled: boolean;
    mode: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE';
    maxOpenPositions: number;
    positionSizeUsd: number;
    minMLConfidence: number;
    requireSentimentAlignment: boolean;
    minAlignmentScore: number;  // 0-100, how many signals must align
    cooldownMinutes: number;    // Min time between trades on same asset
    tradingHoursOnly: boolean;  // Only trade during high-volume hours
}

interface TradeSignal {
    ticker: string;
    direction: 'LONG' | 'SHORT';
    confidence: number;         // 0-100
    alignmentScore: number;     // 0-100
    signals: SignalSource[];
    price: number;
    timestamp: Date;
}

interface SignalSource {
    source: string;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    value: string;
    weight: number;
}

interface BotStats {
    isRunning: boolean;
    mode: string;
    tradesExecuted: number;
    signalsGenerated: number;
    lastSignal: TradeSignal | null;
    lastTrade: Date | null;
    uptime: number;
}

// In-memory state
let botConfig: BotConfig = {
    enabled: false,
    mode: 'BALANCED',
    maxOpenPositions: 3,
    positionSizeUsd: 100,
    minMLConfidence: 55,
    requireSentimentAlignment: true,
    minAlignmentScore: 60,
    cooldownMinutes: 30,
    tradingHoursOnly: false
};

let botStats: BotStats = {
    isRunning: false,
    mode: 'BALANCED',
    tradesExecuted: 0,
    signalsGenerated: 0,
    lastSignal: null,
    lastTrade: null,
    uptime: 0
};

const tradeCooldowns: Map<string, number> = new Map();
let startTime: number = 0;
let scanInterval: NodeJS.Timeout | null = null;

// Mode presets - adjusted for real market conditions
const MODE_PRESETS: Record<string, Partial<BotConfig>> = {
    AGGRESSIVE: {
        minMLConfidence: 35,      // Lowered - take more trades
        minAlignmentScore: 35,
        requireSentimentAlignment: false,
        cooldownMinutes: 10
    },
    BALANCED: {
        minMLConfidence: 45,      // Lowered from 55
        minAlignmentScore: 50,    // Lowered from 60
        requireSentimentAlignment: true,
        cooldownMinutes: 20
    },
    CONSERVATIVE: {
        minMLConfidence: 55,      // Lowered from 70
        minAlignmentScore: 60,    // Lowered from 75
        requireSentimentAlignment: true,
        cooldownMinutes: 45
    }
};

export const AutoTraderService = {
    // Start the auto-trading bot
    start: (mode: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE' = 'BALANCED') => {
        if (botStats.isRunning) {
            console.log('[AUTOTRADER] Bot already running');
            return { success: false, message: 'Bot already running' };
        }

        // Apply mode preset
        botConfig = { ...botConfig, ...MODE_PRESETS[mode], mode, enabled: true };
        botStats.isRunning = true;
        botStats.mode = mode;
        startTime = Date.now();

        console.log(`[AUTOTRADER] 🤖 Bot started in ${mode} mode`);
        console.log(`[AUTOTRADER] Config: ML≥${botConfig.minMLConfidence}%, Alignment≥${botConfig.minAlignmentScore}%`);

        // Start scanning every 30 seconds
        scanInterval = setInterval(() => {
            AutoTraderService.scan();
        }, 30 * 1000);

        // Initial scan
        AutoTraderService.scan();

        TelegramService.sendMessage(`🤖 AutoTrader started in ${mode} mode`);

        return { success: true, message: `Bot started in ${mode} mode` };
    },

    // Stop the bot
    stop: () => {
        if (!botStats.isRunning) {
            return { success: false, message: 'Bot not running' };
        }

        botConfig.enabled = false;
        botStats.isRunning = false;

        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }

        console.log('[AUTOTRADER] 🛑 Bot stopped');
        TelegramService.sendMessage(`🛑 AutoTrader stopped. Trades: ${botStats.tradesExecuted}`);

        return { success: true, message: 'Bot stopped' };
    },

    // Main scan loop - analyze all assets for trade opportunities
    scan: async () => {
        if (!botConfig.enabled || !ConfigService.isPaperTradingAllowed()) {
            return;
        }

        try {
            // Get ML predictions with lower threshold to see what's available
            const allPredictions = await MLPredictorService.getHighConfidencePredictions(30);
            const mlPredictions = allPredictions.filter(p => p.confidence >= botConfig.minMLConfidence);
            
            console.log(`[AUTOTRADER] Scan: ${allPredictions.length} predictions found, ${mlPredictions.length} meet ${botConfig.minMLConfidence}% threshold`);
            
            // Log top predictions for debugging
            if (allPredictions.length > 0 && mlPredictions.length === 0) {
                const top = allPredictions.slice(0, 3).map(p => `${p.ticker}:${p.confidence}%`).join(', ');
                console.log(`[AUTOTRADER] Top predictions (below threshold): ${top}`);
            }
            
            for (const prediction of mlPredictions) {
                // Skip if on cooldown
                if (AutoTraderService.isOnCooldown(prediction.ticker)) {
                    console.log(`[AUTOTRADER] ${prediction.ticker} on cooldown, skipping`);
                    continue;
                }

                // Generate full trade signal with alignment check
                const signal = await AutoTraderService.generateSignal(prediction);
                
                console.log(`[AUTOTRADER] ${prediction.ticker} signal: ML=${prediction.confidence}%, Align=${signal?.alignmentScore || 0}%, Required=${botConfig.minAlignmentScore}%`);
                
                if (signal && signal.alignmentScore >= botConfig.minAlignmentScore) {
                    botStats.signalsGenerated++;
                    botStats.lastSignal = signal;

                    // Check if we can execute
                    const canTrade = await AutoTraderService.canExecuteTrade(signal);
                    
                    if (canTrade) {
                        await AutoTraderService.executeTrade(signal);
                    }
                }
            }
            
            // FALLBACK: If no ML predictions meet threshold, scan using hijack force
            if (mlPredictions.length === 0) {
                console.log('[AUTOTRADER] No ML signals, scanning using Hijack Force fallback...');
                await AutoTraderService.scanWithHijackForce();
            }

            // Update uptime
            botStats.uptime = Math.floor((Date.now() - startTime) / 1000);

        } catch (err) {
            console.error('[AUTOTRADER] Scan error:', err);
        }
    },
    
    // Fallback: Scan using hijack force from leaderboard when ML data is sparse
    scanWithHijackForce: async () => {
        try {
            const leaderboard = await SentimentService.getMarketLeaderboard();
            
            // Find assets with notable hijack force
            const candidates = leaderboard
                .filter((a: any) => a.hijackForce > 0.001) // Any detectable force
                .slice(0, 5); // Top 5
                
            console.log(`[AUTOTRADER] Hijack Force candidates: ${candidates.length}`);
            
            for (const asset of candidates) {
                if (AutoTraderService.isOnCooldown(asset.ticker)) continue;
                
                // Generate signal using force + sentiment alignment
                const signal = await AutoTraderService.generateForceSignal(asset);
                
                if (signal && signal.alignmentScore >= botConfig.minAlignmentScore) {
                    botStats.signalsGenerated++;
                    botStats.lastSignal = signal;
                    
                    const canTrade = await AutoTraderService.canExecuteTrade(signal);
                    if (canTrade) {
                        await AutoTraderService.executeTrade(signal);
                    }
                }
            }
        } catch (err) {
            console.error('[AUTOTRADER] Hijack force scan error:', err);
        }
    },
    
    // Generate signal from hijack force data (fallback mode)
    generateForceSignal: async (asset: any): Promise<TradeSignal | null> => {
        const ticker = asset.ticker;
        const baseTicker = ticker.replace('USD', '').replace('-USD', '');
        
        const signals: SignalSource[] = [];
        let totalWeight = 0;
        let bullishWeight = 0;
        let bearishWeight = 0;
        
        // 1. Hijack Force (weight: 35%) - the main signal in fallback mode
        const forceWeight = 35;
        const forceSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
            asset.hijackForce > 0.005 ? 'BULLISH' : 
            asset.hijackForce > 0.002 ? 'BULLISH' : 'NEUTRAL';
        
        // Convert force to confidence (0.001 = 40%, 0.005 = 60%, 0.01 = 80%)
        const forceConfidence = Math.min(80, 40 + (asset.hijackForce * 4000));
        
        signals.push({
            source: 'Hijack Force',
            signal: forceSignal,
            value: `Force: ${asset.hijackForce.toFixed(5)}`,
            weight: forceWeight
        });
        totalWeight += forceWeight;
        if (forceSignal === 'BULLISH') bullishWeight += forceWeight;
        
        // 2. Fear & Greed (weight: 20%)
        try {
            const fg = await FearGreedService.getIndex();
            const fgWeight = 20;
            let fgSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            if (fg.value <= 30) fgSignal = 'BULLISH';
            else if (fg.value >= 70) fgSignal = 'BEARISH';
            
            signals.push({
                source: 'Fear & Greed',
                signal: fgSignal,
                value: `${fg.value} (${fg.label})`,
                weight: fgWeight
            });
            totalWeight += fgWeight;
            if (fgSignal === 'BULLISH') bullishWeight += fgWeight;
            if (fgSignal === 'BEARISH') bearishWeight += fgWeight;
        } catch (e) { /* Skip */ }
        
        // 3. Social Sentiment (weight: 25%)
        try {
            const social = TwitterService.getSentiment(baseTicker);
            const socialWeight = 25;
            let socialSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            if (social.score >= 1) socialSignal = 'BULLISH';
            else if (social.score <= -1) socialSignal = 'BEARISH';
            
            signals.push({
                source: 'Social Sentiment',
                signal: socialSignal,
                value: `Score: ${social.score.toFixed(1)}`,
                weight: socialWeight
            });
            totalWeight += socialWeight;
            if (socialSignal === 'BULLISH') bullishWeight += socialWeight;
            if (socialSignal === 'BEARISH') bearishWeight += socialWeight;
        } catch (e) { /* Skip */ }
        
        // 4. On-Chain (weight: 20%)
        try {
            const onchain = OnChainService.getHealthScore(baseTicker);
            const ocWeight = 20;
            let ocSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            if (onchain.score >= 65) ocSignal = 'BULLISH';
            else if (onchain.score <= 45) ocSignal = 'BEARISH';
            
            signals.push({
                source: 'On-Chain',
                signal: ocSignal,
                value: `Health: ${onchain.score}/100`,
                weight: ocWeight
            });
            totalWeight += ocWeight;
            if (ocSignal === 'BULLISH') bullishWeight += ocWeight;
            if (ocSignal === 'BEARISH') bearishWeight += ocWeight;
        } catch (e) { /* Skip */ }
        
        // Calculate alignment
        const direction = bullishWeight > bearishWeight ? 'LONG' : 'SHORT';
        const dominantWeight = Math.max(bullishWeight, bearishWeight);
        const alignmentScore = totalWeight > 0 ? Math.round((dominantWeight / totalWeight) * 100) : 0;
        
        // Need at least 3 signals
        if (signals.length < 3) return null;
        
        return {
            ticker,
            direction,
            confidence: Math.round(forceConfidence),
            alignmentScore,
            signals,
            price: asset.latestPrice,
            timestamp: new Date()
        };
    },

    // Generate a trade signal with multi-source alignment
    generateSignal: async (mlPrediction: any): Promise<TradeSignal | null> => {
        const ticker = mlPrediction.ticker;
        const baseTicker = ticker.replace('USD', '').replace('-USD', '');
        
        const signals: SignalSource[] = [];
        let totalWeight = 0;
        let bullishWeight = 0;
        let bearishWeight = 0;

        // 1. ML Prediction (weight: 30%)
        const mlWeight = 30;
        signals.push({
            source: 'ML Predictor',
            signal: mlPrediction.direction === 'UP' ? 'BULLISH' : mlPrediction.direction === 'DOWN' ? 'BEARISH' : 'NEUTRAL',
            value: `${mlPrediction.confidence}% conf, ${mlPrediction.direction}`,
            weight: mlWeight
        });
        totalWeight += mlWeight;
        if (mlPrediction.direction === 'UP') bullishWeight += mlWeight;
        if (mlPrediction.direction === 'DOWN') bearishWeight += mlWeight;

        // 2. Fear & Greed Index (weight: 20%)
        try {
            const fg = await FearGreedService.getIndex();
            const fgWeight = 20;
            let fgSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            
            // Extreme fear = contrarian bullish, extreme greed = contrarian bearish
            if (fg.value <= 25) fgSignal = 'BULLISH';  // Extreme fear = buy opportunity
            else if (fg.value >= 75) fgSignal = 'BEARISH'; // Extreme greed = sell signal
            
            signals.push({
                source: 'Fear & Greed',
                signal: fgSignal,
                value: `${fg.value} (${fg.label})`,
                weight: fgWeight
            });
            totalWeight += fgWeight;
            if (fgSignal === 'BULLISH') bullishWeight += fgWeight;
            if (fgSignal === 'BEARISH') bearishWeight += fgWeight;
        } catch (e) { /* Skip if unavailable */ }

        // 3. Social Sentiment (weight: 20%)
        try {
            const social = TwitterService.getSentiment(baseTicker);
            const socialWeight = 20;
            let socialSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            
            if (social.score >= 2) socialSignal = 'BULLISH';
            else if (social.score <= -2) socialSignal = 'BEARISH';
            
            signals.push({
                source: 'Social Sentiment',
                signal: socialSignal,
                value: `Score: ${social.score.toFixed(1)}, ${social.posts} posts`,
                weight: socialWeight
            });
            totalWeight += socialWeight;
            if (socialSignal === 'BULLISH') bullishWeight += socialWeight;
            if (socialSignal === 'BEARISH') bearishWeight += socialWeight;
        } catch (e) { /* Skip if unavailable */ }

        // 4. Options Flow (weight: 15%) - for BTC/ETH only
        if (['BTC', 'ETH', 'BTCUSD', 'ETHUSD'].includes(ticker) || ['BTC', 'ETH'].includes(baseTicker)) {
            try {
                const options = await OptionsFlowService.getMarketSentiment();
                const optWeight = 15;
                let optSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
                
                if (options.sentiment === 'BULLISH') optSignal = 'BULLISH';
                else if (options.sentiment === 'BEARISH') optSignal = 'BEARISH';
                
                signals.push({
                    source: 'Options Flow',
                    signal: optSignal,
                    value: `P/C: ${options.put_call_ratio.toFixed(2)}, ${options.sentiment}`,
                    weight: optWeight
                });
                totalWeight += optWeight;
                if (optSignal === 'BULLISH') bullishWeight += optWeight;
                if (optSignal === 'BEARISH') bearishWeight += optWeight;
            } catch (e) { /* Skip if unavailable */ }
        }

        // 5. On-Chain Health (weight: 15%)
        try {
            const onchain = OnChainService.getHealthScore(baseTicker);
            const ocWeight = 15;
            let ocSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            
            if (onchain.score >= 70) ocSignal = 'BULLISH';
            else if (onchain.score <= 40) ocSignal = 'BEARISH';
            
            signals.push({
                source: 'On-Chain',
                signal: ocSignal,
                value: `Health: ${onchain.score}/100`,
                weight: ocWeight
            });
            totalWeight += ocWeight;
            if (ocSignal === 'BULLISH') bullishWeight += ocWeight;
            if (ocSignal === 'BEARISH') bearishWeight += ocWeight;
        } catch (e) { /* Skip if unavailable */ }

        // Calculate alignment score
        const direction = bullishWeight > bearishWeight ? 'LONG' : 'SHORT';
        const dominantWeight = Math.max(bullishWeight, bearishWeight);
        const alignmentScore = totalWeight > 0 ? Math.round((dominantWeight / totalWeight) * 100) : 0;

        // Need at least 3 signals to be confident
        if (signals.length < 3) {
            return null;
        }

        // Get current price (from ingestor cache or default)
        let price = 0;
        try {
            const priceData = await query(
                `SELECT sentiment_score as price FROM sentiment_metrics 
                 WHERE ticker = $1 ORDER BY time DESC LIMIT 1`,
                [ticker]
            );
            price = priceData.rows[0]?.price || 0;
        } catch (e) { price = 0; }

        return {
            ticker,
            direction,
            confidence: mlPrediction.confidence,
            alignmentScore,
            signals,
            price,
            timestamp: new Date()
        };
    },

    // Check if we can execute a trade
    canExecuteTrade: async (signal: TradeSignal): Promise<boolean> => {
        // Check max positions
        const openCount = await query(`SELECT COUNT(*) as cnt FROM paper_trades WHERE status = 'OPEN'`);
        if (parseInt(openCount.rows[0].cnt) >= botConfig.maxOpenPositions) {
            return false;
        }

        // Check if already have position in this asset
        const existing = await query(
            `SELECT id FROM paper_trades WHERE ticker = $1 AND status = 'OPEN'`,
            [signal.ticker]
        );
        if (existing.rows.length > 0) {
            return false;
        }

        // For CONSERVATIVE mode, only take LONG positions (no shorts in paper trading)
        if (botConfig.mode === 'CONSERVATIVE' && signal.direction === 'SHORT') {
            return false;
        }

        return true;
    },

    // Execute a paper trade
    executeTrade: async (signal: TradeSignal) => {
        try {
            const quantity = botConfig.positionSizeUsd / signal.price;

            await query(
                `INSERT INTO paper_trades (ticker, entry_price, quantity, hijack_force_at_entry, status) 
                 VALUES ($1, $2, $3, $4, 'OPEN')`,
                [signal.ticker, signal.price, quantity, signal.confidence / 100]
            );

            // Set cooldown
            tradeCooldowns.set(signal.ticker, Date.now());

            botStats.tradesExecuted++;
            botStats.lastTrade = new Date();

            const signalSummary = signal.signals.map(s => `${s.source}: ${s.signal}`).join(', ');
            
            console.log(`[AUTOTRADER] 🤖 AUTO-${signal.direction} ${signal.ticker} @ $${signal.price.toFixed(2)}`);
            console.log(`[AUTOTRADER] Confidence: ${signal.confidence}%, Alignment: ${signal.alignmentScore}%`);
            console.log(`[AUTOTRADER] Signals: ${signalSummary}`);

            // Archive the trade
            await AutoTraderService.archiveTrade(signal);

            // Telegram alert
            await TelegramService.sendMessage(
                `🤖 AUTO-TRADE EXECUTED\n` +
                `${signal.direction} ${signal.ticker}\n` +
                `Price: $${signal.price.toFixed(2)}\n` +
                `ML Confidence: ${signal.confidence}%\n` +
                `Alignment: ${signal.alignmentScore}%\n` +
                `Signals: ${signal.signals.length}`
            );

        } catch (err) {
            console.error('[AUTOTRADER] Trade execution error:', err);
        }
    },

    // Archive trade signal for analysis
    archiveTrade: async (signal: TradeSignal) => {
        try {
            await query(
                `INSERT INTO autotrader_signals 
                 (ticker, direction, confidence, alignment_score, signals, price, executed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                    signal.ticker,
                    signal.direction,
                    signal.confidence,
                    signal.alignmentScore,
                    JSON.stringify(signal.signals),
                    signal.price
                ]
            );
        } catch (err) {
            // Table might not exist - that's ok
        }
    },

    // Check cooldown
    isOnCooldown: (ticker: string): boolean => {
        const lastTrade = tradeCooldowns.get(ticker);
        if (!lastTrade) return false;
        
        const cooldownMs = botConfig.cooldownMinutes * 60 * 1000;
        return (Date.now() - lastTrade) < cooldownMs;
    },

    // Get bot configuration
    getConfig: (): BotConfig => botConfig,

    // Update configuration
    updateConfig: (updates: Partial<BotConfig>): BotConfig => {
        botConfig = { ...botConfig, ...updates };
        
        // If mode changed, apply preset
        if (updates.mode) {
            botConfig = { ...botConfig, ...MODE_PRESETS[updates.mode] };
        }
        
        console.log('[AUTOTRADER] Config updated:', botConfig);
        return botConfig;
    },

    // Get bot stats
    getStats: (): BotStats => {
        if (botStats.isRunning) {
            botStats.uptime = Math.floor((Date.now() - startTime) / 1000);
        }
        return botStats;
    },

    // Get recent signals (from memory)
    getRecentSignals: (): TradeSignal | null => {
        return botStats.lastSignal;
    },

    // Manual signal generation (for testing)
    analyzeAsset: async (ticker: string): Promise<TradeSignal | null> => {
        const prediction = await MLPredictorService.predictAsset(ticker);
        return AutoTraderService.generateSignal(prediction);
    }
};
