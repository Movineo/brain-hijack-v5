// FEAR & GREED INDEX SERVICE
// Combines multiple sentiment indicators into a single index (0-100)
// 0 = Extreme Fear, 100 = Extreme Greed

import { NewsService } from '../news/news.service';

interface FearGreedComponents {
    momentum: number;          // Price momentum (0-100)
    volatility: number;        // Market volatility (0-100, inverted)
    volume: number;            // Market volume vs average (0-100)
    socialSentiment: number;   // News + Twitter sentiment (0-100)
    dominance: number;         // BTC dominance trend (0-100)
}

interface FearGreedIndex {
    value: number;             // 0-100
    label: string;             // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
    components: FearGreedComponents;
    timestamp: Date;
    change24h: number;         // Change from 24h ago
}

// Historical index values for change calculation
const historyBuffer: { value: number; timestamp: number }[] = [];
const MAX_HISTORY = 288; // 24 hours at 5-min intervals

// Current index cache
let currentIndex: FearGreedIndex | null = null;

// Component weights
const WEIGHTS = {
    momentum: 0.25,      // 25%
    volatility: 0.25,    // 25%
    volume: 0.20,        // 20%
    socialSentiment: 0.20, // 20%
    dominance: 0.10      // 10%
};

export const FearGreedService = {
    // Get current Fear & Greed Index
    getIndex: (): FearGreedIndex => {
        if (currentIndex && Date.now() - currentIndex.timestamp.getTime() < 60000) {
            return currentIndex; // Return cached if less than 1 minute old
        }
        
        // Calculate fresh index
        currentIndex = FearGreedService.calculateIndex();
        return currentIndex;
    },

    // Calculate the Fear & Greed Index
    calculateIndex: (): FearGreedIndex => {
        const components = FearGreedService.calculateComponents();
        
        // Weighted average
        const value = Math.round(
            components.momentum * WEIGHTS.momentum +
            components.volatility * WEIGHTS.volatility +
            components.volume * WEIGHTS.volume +
            components.socialSentiment * WEIGHTS.socialSentiment +
            components.dominance * WEIGHTS.dominance
        );

        // Get label based on value
        const label = FearGreedService.getLabel(value);
        
        // Calculate 24h change
        const change24h = FearGreedService.get24hChange(value);
        
        // Store in history
        historyBuffer.push({ value, timestamp: Date.now() });
        if (historyBuffer.length > MAX_HISTORY) {
            historyBuffer.shift();
        }

        return {
            value: Math.max(0, Math.min(100, value)),
            label,
            components,
            timestamp: new Date(),
            change24h
        };
    },

    // Calculate individual components
    calculateComponents: (): FearGreedComponents => {
        return {
            momentum: FearGreedService.calculateMomentum(),
            volatility: FearGreedService.calculateVolatility(),
            volume: FearGreedService.calculateVolume(),
            socialSentiment: FearGreedService.calculateSocialSentiment(),
            dominance: FearGreedService.calculateDominance()
        };
    },

    // Momentum: Recent price changes (simulated)
    calculateMomentum: (): number => {
        // In production, calculate from actual price data
        // For now, simulate based on market conditions
        const base = 50;
        const variation = (Math.random() - 0.5) * 40;
        return Math.round(base + variation);
    },

    // Volatility: Lower volatility = more greed (inverted)
    calculateVolatility: (): number => {
        // High volatility = fear, Low volatility = greed
        // Simulated - in production, use actual price variance
        const base = 55;
        const variation = (Math.random() - 0.5) * 30;
        return Math.round(base + variation);
    },

    // Volume: Higher volume = more greed
    calculateVolume: (): number => {
        // Compare current volume to 30-day average
        // Simulated - in production, use actual volume data
        const base = 50;
        const variation = (Math.random() - 0.5) * 30;
        return Math.round(base + variation);
    },

    // Social Sentiment: News + Twitter combined
    calculateSocialSentiment: (): number => {
        // Get aggregate news sentiment
        const newsScores: number[] = [];
        ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP'].forEach(ticker => {
            const narrative = NewsService.getNarrative(ticker);
            newsScores.push(narrative.score);
        });
        
        const avgNews = newsScores.reduce((a, b) => a + b, 0) / newsScores.length;
        
        // Convert -10 to +10 scale to 0-100
        const normalized = ((avgNews + 10) / 20) * 100;
        
        return Math.round(normalized);
    },

    // BTC Dominance: Rising dominance = fear (flight to safety)
    calculateDominance: (): number => {
        // BTC dominance typically ranges 40-70%
        // Rising = fear, Falling = greed (altcoin season)
        // Simulated - in production, get from CoinGecko or CMC
        const dominance = 45 + Math.random() * 15; // 45-60%
        
        // Inverted: high dominance = fear (low score for greed)
        // 40% dominance = 70 greed, 60% dominance = 30 greed
        return Math.round(100 - (dominance - 30) * 2);
    },

    // Get label based on index value
    getLabel: (value: number): string => {
        if (value <= 20) return 'Extreme Fear';
        if (value <= 40) return 'Fear';
        if (value <= 60) return 'Neutral';
        if (value <= 80) return 'Greed';
        return 'Extreme Greed';
    },

    // Get 24h change
    get24hChange: (currentValue: number): number => {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const pastValue = historyBuffer.find(h => h.timestamp <= oneDayAgo);
        
        if (!pastValue) return 0;
        return currentValue - pastValue.value;
    },

    // Get historical data for charting
    getHistory: (hours: number = 24): { value: number; timestamp: Date }[] => {
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return historyBuffer
            .filter(h => h.timestamp >= cutoff)
            .map(h => ({ value: h.value, timestamp: new Date(h.timestamp) }));
    },

    // Get market mood summary
    getMoodSummary: (): string => {
        const index = FearGreedService.getIndex();
        
        if (index.value <= 20) {
            return "🥶 Market is in EXTREME FEAR. Could be a buying opportunity, but high risk.";
        } else if (index.value <= 40) {
            return "😰 Market sentiment is FEARFUL. Caution advised, but potential upside.";
        } else if (index.value <= 60) {
            return "😐 Market is NEUTRAL. Wait for clearer signals before major moves.";
        } else if (index.value <= 80) {
            return "😃 Market sentiment is GREEDY. Consider taking profits on winners.";
        } else {
            return "🤑 EXTREME GREED detected! High risk of correction. Be very cautious.";
        }
    }
};
