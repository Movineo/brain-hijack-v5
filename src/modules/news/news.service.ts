import Parser from 'rss-parser';

const parser = new Parser();

// Emotional Keywords (The "Hype" Dictionary)
const HYPE_WORDS = [
    'surge', 'blast', 'skyrocket', 'record', 'all-time high', 'breakout', 
    'bull', 'rally', 'jump', 'soar', 'massive', 'buy', 'adoption',
    'bullish', 'pump', 'moon', 'explode', 'spike', 'gain', 'winner'
];

const PANIC_WORDS = [
    'crash', 'plunge', 'collapse', 'ban', 'lawsuit', 'hack', 'dump', 
    'bear', 'fear', 'sell', 'regulatory', 'arrest', 'scam', 'fraud',
    'bearish', 'tank', 'drop', 'fall', 'lose', 'warning', 'risk'
];

// Asset keyword mapping (detect which coin the article is about)
const ASSET_KEYWORDS: Record<string, string[]> = {
    'BTC': ['bitcoin', 'btc'],
    'ETH': ['ethereum', 'eth', 'ether'],
    'SOL': ['solana', 'sol'],
    'DOGE': ['dogecoin', 'doge'],
    'PEPE': ['pepe'],
    'XRP': ['xrp', 'ripple'],
    'ADA': ['cardano', 'ada'],
    'AVAX': ['avalanche', 'avax'],
    'LINK': ['chainlink', 'link'],
    'DOT': ['polkadot', 'dot'],
    'SHIB': ['shiba', 'shib'],
    'LTC': ['litecoin', 'ltc'],
    'BCH': ['bitcoin cash', 'bch'],
    'MATIC': ['polygon', 'matic'],
    'UNI': ['uniswap', 'uni'],
    'ARB': ['arbitrum', 'arb'],
    'OP': ['optimism'],
    'SUI': ['sui'],
    'APT': ['aptos', 'apt']
};

// Memory Cache (To avoid hitting feeds too often)
interface NarrativeData {
    score: number;
    headline: string;
    timestamp: Date;
}

let narrativeCache: Record<string, NarrativeData> = {};

export const NewsService = {
    // Polls news every 5 minutes
    startScanning: () => {
        console.log('[News] 📰 Initializing Narrative Scanner...');
        NewsService.fetchNews();
        
        // Run every 5 minutes
        setInterval(NewsService.fetchNews, 5 * 60 * 1000); 
    },

    fetchNews: async () => {
        const feeds = [
            'https://cointelegraph.com/rss',
            'https://www.coindesk.com/arc/outboundfeeds/rss/',
            'https://decrypt.co/feed'
        ];

        let articlesProcessed = 0;

        for (const url of feeds) {
            try {
                const feed = await parser.parseURL(url);
                
                feed.items.forEach(item => {
                    const title = item.title?.toLowerCase() || '';
                    const snippet = item.contentSnippet?.toLowerCase() || '';
                    const fullText = title + ' ' + snippet;

                    // 1. Detect Asset
                    let detectedTicker = '';
                    for (const [ticker, keywords] of Object.entries(ASSET_KEYWORDS)) {
                        for (const keyword of keywords) {
                            if (fullText.includes(keyword)) {
                                detectedTicker = ticker;
                                break;
                            }
                        }
                        if (detectedTicker) break;
                    }

                    if (!detectedTicker) return;

                    // 2. Score Sentiment
                    let score = 0;
                    HYPE_WORDS.forEach(word => { 
                        if (fullText.includes(word)) score += 1; 
                    });
                    PANIC_WORDS.forEach(word => { 
                        if (fullText.includes(word)) score -= 1; 
                    });

                    // 3. Only update cache if article is recent (last 2 hours)
                    const pubDate = new Date(item.pubDate || new Date());
                    const ageInHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);

                    if (ageInHours < 2) {
                        // Only update if this is more recent or has stronger signal
                        const existing = narrativeCache[detectedTicker];
                        if (!existing || pubDate > existing.timestamp || Math.abs(score) > Math.abs(existing.score)) {
                            narrativeCache[detectedTicker] = {
                                score: score,
                                headline: item.title || 'Unknown Headline',
                                timestamp: pubDate
                            };
                            articlesProcessed++;
                        }
                    }
                });

            } catch (err: any) {
                console.error(`[News] ⚠️ Failed to parse ${url}:`, err?.message || err);
            }
        }
        
        console.log(`[News] ✅ Scan complete. ${articlesProcessed} relevant articles cached.`);
    },

    // Public getter for the Controller
    getNarrative: (ticker: string): { score: number; headline: string } => {
        // Strip suffixes like USD for lookup
        const cleanTicker = ticker
            .replace('USD', '')
            .replace('USDT', '')
            .replace('-', '')
            .toUpperCase();
            
        const data = narrativeCache[cleanTicker];
        return data 
            ? { score: data.score, headline: data.headline }
            : { score: 0, headline: '--' };
    },

    // Get full cache for debugging
    getFullNarrativeState: () => {
        return narrativeCache;
    }
};
