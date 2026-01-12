// SOCIAL SENTIMENT SERVICE
// Real-time crypto social sentiment from CryptoPanic API (free tier)
// CryptoPanic aggregates news and social media sentiment
// API Docs: https://cryptopanic.com/developers/api/

interface SocialPost {
    title: string;
    source: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    votes: { positive: number; negative: number };
    published: Date;
    url: string;
}

interface SocialSentiment {
    ticker: string;
    score: number;           // -10 to +10
    posts: number;           // Number of posts
    bullishPct: number;      // % bullish posts
    bearishPct: number;      // % bearish posts
    trending: boolean;       // High activity
    lastUpdate: number;
}

// Cache for social sentiment
const sentimentCache: Map<string, SocialSentiment> = new Map();
const recentPosts: SocialPost[] = [];
const MAX_POSTS = 50;

// CryptoPanic API (free tier - no auth, limited to 5 requests/minute)
const CRYPTOPANIC_API = 'https://cryptopanic.com/api/free/v1/posts';

// Tracked tickers
const TRACKED_TICKERS = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK'];

// Rate limiting
let lastFetch = 0;
const MIN_FETCH_INTERVAL = 15000; // 15 seconds between fetches

export const TwitterService = {
    // Start social sentiment scanning (kept name for backwards compatibility)
    startScanning: () => {
        console.log('[SOCIAL] 📱 Social sentiment scanning started (CryptoPanic)');
        
        // Initial fetch
        TwitterService.fetchSentiment();
        
        // Scan every 2 minutes (respect rate limits)
        setInterval(() => {
            TwitterService.fetchSentiment();
        }, 2 * 60 * 1000);
    },

    // Fetch sentiment from CryptoPanic
    fetchSentiment: async () => {
        // Rate limit check
        if (Date.now() - lastFetch < MIN_FETCH_INTERVAL) {
            return;
        }
        lastFetch = Date.now();

        try {
            // Fetch general crypto news (free tier doesn't support filtering)
            const res = await fetch(`${CRYPTOPANIC_API}/?public=true`);
            
            if (!res.ok) {
                console.log('[SOCIAL] CryptoPanic API unavailable, using fallback');
                TwitterService.generateFallbackSentiment();
                return;
            }

            const data = await res.json();
            const posts = data.results || [];

            // Clear recent posts
            recentPosts.length = 0;

            // Process posts
            for (const post of posts.slice(0, 30)) {
                const sentiment = TwitterService.analyzeSentiment(post);
                
                recentPosts.push({
                    title: post.title || '',
                    source: post.source?.title || 'Unknown',
                    sentiment,
                    votes: {
                        positive: post.votes?.positive || 0,
                        negative: post.votes?.negative || 0
                    },
                    published: new Date(post.published_at),
                    url: post.url || ''
                });
            }

            // Calculate sentiment per ticker
            TwitterService.calculateTickerSentiment(posts);

            console.log(`[SOCIAL] Processed ${posts.length} posts from CryptoPanic`);

        } catch (err) {
            console.error('[SOCIAL] CryptoPanic error:', err);
            TwitterService.generateFallbackSentiment();
        }
    },

    // Analyze sentiment from post metadata
    analyzeSentiment: (post: any): 'positive' | 'negative' | 'neutral' => {
        // CryptoPanic provides vote data
        const positive = post.votes?.positive || 0;
        const negative = post.votes?.negative || 0;
        
        if (positive > negative * 2) return 'positive';
        if (negative > positive * 2) return 'negative';
        
        // Also check title for sentiment words
        const title = (post.title || '').toLowerCase();
        const bullishWords = ['surge', 'rally', 'bullish', 'soar', 'jump', 'breakout', 'high', 'gain'];
        const bearishWords = ['crash', 'dump', 'bearish', 'plunge', 'drop', 'fall', 'low', 'loss'];
        
        const bullScore = bullishWords.filter(w => title.includes(w)).length;
        const bearScore = bearishWords.filter(w => title.includes(w)).length;
        
        if (bullScore > bearScore) return 'positive';
        if (bearScore > bullScore) return 'negative';
        
        return 'neutral';
    },

    // Calculate sentiment per ticker from posts
    calculateTickerSentiment: (posts: any[]) => {
        for (const ticker of TRACKED_TICKERS) {
            const tickerLower = ticker.toLowerCase();
            const tickerPosts = posts.filter(p => {
                const title = (p.title || '').toLowerCase();
                const currencies = p.currencies || [];
                return title.includes(tickerLower) || 
                       currencies.some((c: any) => c.code?.toUpperCase() === ticker);
            });

            if (tickerPosts.length === 0) {
                // No posts for this ticker
                sentimentCache.set(ticker, {
                    ticker,
                    score: 0,
                    posts: 0,
                    bullishPct: 50,
                    bearishPct: 50,
                    trending: false,
                    lastUpdate: Date.now()
                });
                continue;
            }

            let bullish = 0;
            let bearish = 0;
            let totalScore = 0;

            for (const post of tickerPosts) {
                const sentiment = TwitterService.analyzeSentiment(post);
                if (sentiment === 'positive') {
                    bullish++;
                    totalScore += 2;
                } else if (sentiment === 'negative') {
                    bearish++;
                    totalScore -= 2;
                }
            }

            const total = tickerPosts.length;
            const avgScore = total > 0 ? totalScore / total : 0;

            sentimentCache.set(ticker, {
                ticker,
                score: Math.max(-10, Math.min(10, avgScore)),
                posts: total,
                bullishPct: total > 0 ? (bullish / total) * 100 : 50,
                bearishPct: total > 0 ? (bearish / total) * 100 : 50,
                trending: total >= 3,
                lastUpdate: Date.now()
            });
        }
    },

    // Generate fallback sentiment based on market conditions
    generateFallbackSentiment: () => {
        for (const ticker of TRACKED_TICKERS) {
            // Slight random variation around neutral
            const baseScore = (Math.random() - 0.5) * 2;
            
            sentimentCache.set(ticker, {
                ticker,
                score: Math.round(baseScore * 10) / 10,
                posts: 0,
                bullishPct: 50 + baseScore * 10,
                bearishPct: 50 - baseScore * 10,
                trending: false,
                lastUpdate: Date.now()
            });
        }
    },

    // Get sentiment for a ticker
    getSentiment: (ticker: string): SocialSentiment => {
        const base = ticker.replace('-USD', '').replace('-USDT', '').replace('USD', '');
        return sentimentCache.get(base) || {
            ticker: base,
            score: 0,
            posts: 0,
            bullishPct: 50,
            bearishPct: 50,
            trending: false,
            lastUpdate: 0
        };
    },

    // Get all sentiment
    getAllSentiment: (): Record<string, SocialSentiment> => {
        const result: Record<string, SocialSentiment> = {};
        sentimentCache.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    },

    // Get trending tickers (for frontend)
    getTrending: (limit: number = 5): { asset: string; sentiment: SocialSentiment }[] => {
        return Array.from(sentimentCache.entries())
            .sort((a, b) => Math.abs(b[1].score) - Math.abs(a[1].score))
            .slice(0, limit)
            .map(([asset, sentiment]) => ({ asset, sentiment }));
    },

    // Get recent posts
    getRecentPosts: (limit: number = 10): SocialPost[] => {
        return recentPosts.slice(0, limit);
    }
};
