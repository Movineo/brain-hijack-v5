import Parser from 'rss-parser';

// TWITTER/X SENTIMENT SERVICE
// Scrapes crypto Twitter influencers via RSS proxies
// Note: Direct Twitter API requires paid access

const parser = new Parser({
    timeout: 10000,
    headers: { 
        'User-Agent': 'Brain-Hijack/5.0',
        'Accept': 'application/rss+xml'
    }
});

// Crypto Twitter influencers (using Nitter RSS mirrors)
// Nitter is a free, open-source Twitter frontend that provides RSS feeds
const TWITTER_FEEDS: { handle: string; weight: number }[] = [
    // High-influence accounts
    { handle: 'caboratcrypto', weight: 2 },      // Michael Saylor
    { handle: 'VitalikButerin', weight: 2 },     // Vitalik
    { handle: 'caboratcrypto', weight: 1.5 },    // CZ Binance
    { handle: 'APompliano', weight: 1.5 },       // Anthony Pompliano
    { handle: 'aantonop', weight: 1.5 },         // Andreas Antonopoulos
    { handle: 'WuBlockchain', weight: 1 },       // Wu Blockchain
    { handle: 'tier10k', weight: 1 },            // Tier10k
    { handle: 'loomdart', weight: 1 },           // Loomdart
];

// Nitter instances (rotate if one is down)
const NITTER_INSTANCES = [
    'https://nitter.net',
    'https://nitter.it',
    'https://nitter.privacydev.net'
];

// Sentiment keywords
const BULLISH_WORDS = [
    'bullish', 'moon', 'pump', 'breakout', 'buy', 'long', 'accumulate', 'hodl',
    'all time high', 'ath', 'rally', 'surge', 'soar', 'launch', 'massive', 'huge',
    'institutional', 'adoption', 'bullrun', 'undervalued', '🚀', '📈', '💪', '🔥'
];

const BEARISH_WORDS = [
    'bearish', 'dump', 'crash', 'sell', 'short', 'warning', 'careful', 'concern',
    'dead', 'scam', 'rug', 'collapse', 'plunge', 'drop', 'fear', 'panic', 'bubble',
    'overvalued', 'correction', 'exit', '📉', '⚠️', '🚨', '💀'
];

// Asset keywords (same as news service)
const ASSET_KEYWORDS: Record<string, string[]> = {
    'BTC': ['bitcoin', 'btc', '$btc', 'sats'],
    'ETH': ['ethereum', 'eth', '$eth', 'vitalik'],
    'SOL': ['solana', 'sol', '$sol'],
    'DOGE': ['doge', 'dogecoin', '$doge', 'elon'],
    'XRP': ['xrp', 'ripple', '$xrp'],
    'ADA': ['cardano', 'ada', '$ada'],
    'AVAX': ['avalanche', 'avax', '$avax'],
    'LINK': ['chainlink', 'link', '$link'],
    'DOT': ['polkadot', 'dot', '$dot'],
    'SHIB': ['shib', 'shiba', '$shib'],
    'PEPE': ['pepe', '$pepe'],
    'MATIC': ['polygon', 'matic', '$matic'],
};

// Cache for Twitter sentiment
interface TwitterSentiment {
    score: number;           // -10 to +10
    tweets: number;          // Number of mentions
    lastTweet: string;       // Most recent tweet
    lastUpdate: number;      // Timestamp
}

const twitterCache: Map<string, TwitterSentiment> = new Map();
const allTweets: { handle: string; text: string; time: Date; sentiment: number }[] = [];

export const TwitterService = {
    // Start Twitter sentiment scanning
    startScanning: () => {
        console.log('[TWITTER] 🐦 Twitter sentiment scanning started');
        
        // Initial fetch
        TwitterService.fetchAllFeeds();
        
        // Scan every 5 minutes
        setInterval(() => {
            TwitterService.fetchAllFeeds();
        }, 5 * 60 * 1000);
    },

    // Fetch all Twitter feeds
    fetchAllFeeds: async () => {
        for (const feed of TWITTER_FEEDS) {
            try {
                await TwitterService.fetchFeed(feed.handle, feed.weight);
            } catch (err) {
                // Silently fail - Nitter instances are unreliable
            }
        }
        
        // Process and score after fetching
        TwitterService.processSentiment();
    },

    // Fetch single Twitter feed via Nitter RSS
    fetchFeed: async (handle: string, weight: number) => {
        for (const instance of NITTER_INSTANCES) {
            try {
                const url = `${instance}/${handle}/rss`;
                const feed = await parser.parseURL(url);
                
                // Process tweets (last 2 hours)
                const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
                
                for (const item of feed.items || []) {
                    if (!item.pubDate || new Date(item.pubDate).getTime() < twoHoursAgo) continue;
                    
                    const text = (item.title || item.content || '').toLowerCase();
                    const sentiment = TwitterService.scoreTweet(text);
                    
                    allTweets.push({
                        handle,
                        text: text.substring(0, 200),
                        time: new Date(item.pubDate),
                        sentiment: sentiment * weight
                    });
                }
                
                // Success - no need to try other instances
                break;
            } catch (err) {
                // Try next Nitter instance
                continue;
            }
        }
    },

    // Score a single tweet
    scoreTweet: (text: string): number => {
        let score = 0;
        
        BULLISH_WORDS.forEach(word => {
            if (text.includes(word.toLowerCase())) score++;
        });
        
        BEARISH_WORDS.forEach(word => {
            if (text.includes(word.toLowerCase())) score--;
        });
        
        return Math.max(-10, Math.min(10, score));
    },

    // Process sentiment for all assets
    processSentiment: () => {
        // Clear old tweets (keep last 2 hours)
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        while (allTweets.length > 0 && allTweets[allTweets.length - 1].time.getTime() < twoHoursAgo) {
            allTweets.pop();
        }

        // Calculate sentiment per asset
        for (const [asset, keywords] of Object.entries(ASSET_KEYWORDS)) {
            const relevantTweets = allTweets.filter(t => 
                keywords.some(kw => t.text.includes(kw.toLowerCase()))
            );
            
            if (relevantTweets.length === 0) {
                twitterCache.set(asset, {
                    score: 0,
                    tweets: 0,
                    lastTweet: '--',
                    lastUpdate: Date.now()
                });
                continue;
            }
            
            const totalScore = relevantTweets.reduce((sum, t) => sum + t.sentiment, 0);
            const avgScore = totalScore / relevantTweets.length;
            
            twitterCache.set(asset, {
                score: Math.round(avgScore * 10) / 10,
                tweets: relevantTweets.length,
                lastTweet: relevantTweets[0]?.text || '--',
                lastUpdate: Date.now()
            });
        }
        
        console.log(`[TWITTER] Processed ${allTweets.length} tweets`);
    },

    // Get Twitter sentiment for an asset
    getSentiment: (ticker: string): TwitterSentiment => {
        const base = ticker.replace('-USD', '').replace('-USDT', '');
        return twitterCache.get(base) || {
            score: 0,
            tweets: 0,
            lastTweet: '--',
            lastUpdate: 0
        };
    },

    // Get all Twitter sentiment
    getAllSentiment: (): Record<string, TwitterSentiment> => {
        const result: Record<string, TwitterSentiment> = {};
        twitterCache.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    },

    // Get trending sentiment (highest activity)
    getTrending: (limit: number = 5): { asset: string; sentiment: TwitterSentiment }[] => {
        const sorted = Array.from(twitterCache.entries())
            .sort((a, b) => b[1].tweets - a[1].tweets)
            .slice(0, limit);
        
        return sorted.map(([asset, sentiment]) => ({ asset, sentiment }));
    }
};
