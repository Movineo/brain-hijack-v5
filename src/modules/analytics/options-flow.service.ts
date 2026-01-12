// OPTIONS FLOW SERVICE
// Real-time crypto options data from Deribit API (free, no auth required for public endpoints)
// Deribit API Docs: https://docs.deribit.com/

interface OptionsFlow {
    ticker: string;
    type: 'CALL' | 'PUT';
    strike: number;
    expiry: string;
    premium: number;
    contracts: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    unusualActivity: boolean;
    timestamp: Date;
}

interface OptionsMetrics {
    ticker: string;
    putCallRatio: number;
    totalCallVolume: number;
    totalPutVolume: number;
    maxPainPrice: number;
    impliedVolatility: number;
    openInterest: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    lastUpdate: Date;
}

// Cache for options data
const optionsCache: Map<string, OptionsMetrics> = new Map();
const recentFlows: OptionsFlow[] = [];
const MAX_FLOWS = 100;

// Deribit API base URL (public endpoints, no auth needed)
const DERIBIT_API = 'https://www.deribit.com/api/v2/public';

// Tracked crypto options assets
const TRACKED_ASSETS = ['BTC', 'ETH'];

export const OptionsFlowService = {
    // Start options flow monitoring
    startMonitoring: () => {
        console.log('[OPTIONS] 📊 Connecting to Deribit API for real options data...');
        
        // Initial fetch
        OptionsFlowService.fetchAllMetrics();
        
        // Update every 2 minutes (Deribit rate limits are generous)
        setInterval(() => {
            OptionsFlowService.fetchAllMetrics();
        }, 2 * 60 * 1000);
    },

    // Fetch real metrics from Deribit
    fetchAllMetrics: async () => {
        for (const ticker of TRACKED_ASSETS) {
            try {
                await OptionsFlowService.fetchDeribitMetrics(ticker);
            } catch (err) {
                console.error(`[OPTIONS] Error fetching ${ticker}:`, err);
            }
        }
    },

    // Fetch real options data from Deribit API
    fetchDeribitMetrics: async (ticker: string) => {
        try {
            // Get index price
            const indexRes = await fetch(`${DERIBIT_API}/get_index_price?index_name=${ticker.toLowerCase()}_usd`);
            const indexData = await indexRes.json();
            const indexPrice = indexData.result?.index_price || 0;

            // Get book summary for volume/OI data (this is the key endpoint)
            const summaryRes = await fetch(`${DERIBIT_API}/get_book_summary_by_currency?currency=${ticker}&kind=option`);
            const summaryData = await summaryRes.json();
            const summaries = summaryData.result || [];

            if (summaries.length === 0) {
                console.log(`[OPTIONS] No options data for ${ticker}`);
                return;
            }

            // Aggregate metrics
            let totalCallVolume = 0;
            let totalPutVolume = 0;
            let totalCallOI = 0;
            let totalPutOI = 0;
            let totalIV = 0;
            let ivCount = 0;
            const unusualFlows: OptionsFlow[] = [];

            // Strike prices for max pain calculation
            const strikePainMap: Map<number, number> = new Map();

            for (const summary of summaries) {
                const name = summary.instrument_name || '';
                const isCall = name.includes('-C');
                const isPut = name.includes('-P');
                
                const volume = summary.volume || 0;
                const openInterest = summary.open_interest || 0;
                const markIV = summary.mark_iv || 0;
                
                if (isCall) {
                    totalCallVolume += volume;
                    totalCallOI += openInterest;
                } else if (isPut) {
                    totalPutVolume += volume;
                    totalPutOI += openInterest;
                }

                if (markIV > 0) {
                    totalIV += markIV;
                    ivCount++;
                }

                // Extract strike price for max pain
                const parts = name.split('-');
                if (parts.length >= 3) {
                    const strike = parseFloat(parts[2]);
                    if (!isNaN(strike)) {
                        const currentPain = strikePainMap.get(strike) || 0;
                        strikePainMap.set(strike, currentPain + openInterest);
                    }
                }

                // Detect unusual activity (high volume relative to OI)
                if (volume > 100 && openInterest > 0 && volume / openInterest > 0.5) {
                    const strike = parseFloat(parts[2]) || 0;
                    unusualFlows.push({
                        ticker,
                        type: isCall ? 'CALL' : 'PUT',
                        strike,
                        expiry: parts[1] || 'N/A',
                        premium: (summary.mid_price || 0) * volume * indexPrice,
                        contracts: Math.round(volume),
                        sentiment: isCall ? 'BULLISH' : 'BEARISH',
                        unusualActivity: true,
                        timestamp: new Date()
                    });
                }
            }

            // Calculate max pain (strike with most OI)
            let maxPainPrice = indexPrice;
            let maxPain = 0;
            strikePainMap.forEach((pain, strike) => {
                if (pain > maxPain) {
                    maxPain = pain;
                    maxPainPrice = strike;
                }
            });

            // Put/Call ratio
            const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;
            
            // Average IV
            const avgIV = ivCount > 0 ? totalIV / ivCount : 50;

            // Determine sentiment
            let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            if (putCallRatio < 0.7) sentiment = 'BULLISH';
            else if (putCallRatio > 1.0) sentiment = 'BEARISH';

            const metrics: OptionsMetrics = {
                ticker,
                putCallRatio: Math.round(putCallRatio * 100) / 100,
                totalCallVolume: Math.round(totalCallVolume),
                totalPutVolume: Math.round(totalPutVolume),
                maxPainPrice: Math.round(maxPainPrice),
                impliedVolatility: Math.round(avgIV),
                openInterest: Math.round(totalCallOI + totalPutOI),
                sentiment,
                lastUpdate: new Date()
            };

            optionsCache.set(ticker, metrics);

            // Add unusual flows to recent flows
            for (const flow of unusualFlows.slice(0, 5)) {
                recentFlows.unshift(flow);
            }
            while (recentFlows.length > MAX_FLOWS) {
                recentFlows.pop();
            }

            console.log(`[OPTIONS] ${ticker}: P/C=${putCallRatio.toFixed(2)}, IV=${avgIV.toFixed(0)}%, OI=${(totalCallOI + totalPutOI).toLocaleString()}`);

        } catch (err) {
            console.error(`[OPTIONS] Deribit API error for ${ticker}:`, err);
        }
    },

    // Get metrics for a specific asset
    getMetrics: (ticker: string): OptionsMetrics | null => {
        return optionsCache.get(ticker) || null;
    },

    // Get all options metrics
    getAllMetrics: (): OptionsMetrics[] => {
        return Array.from(optionsCache.values());
    },

    // Get recent unusual flows
    getUnusualFlows: (limit: number = 20): OptionsFlow[] => {
        return recentFlows.filter(f => f.unusualActivity).slice(0, limit);
    },

    // Get all recent flows
    getRecentFlows: (limit: number = 50): OptionsFlow[] => {
        return recentFlows.slice(0, limit);
    },

    // Get overall market sentiment from options
    getMarketSentiment: (): { sentiment: string; confidence: number; put_call_ratio: number; signals: string[] } => {
        const metrics = Array.from(optionsCache.values());
        const signals: string[] = [];

        if (metrics.length === 0) {
            return { sentiment: 'NEUTRAL', confidence: 50, put_call_ratio: 1, signals: ['Fetching data...'] };
        }

        // Calculate aggregate put/call ratio
        const totalCalls = metrics.reduce((sum, m) => sum + m.totalCallVolume, 0);
        const totalPuts = metrics.reduce((sum, m) => sum + m.totalPutVolume, 0);
        const aggregatePCR = totalCalls > 0 ? totalPuts / totalCalls : 1;

        // Determine sentiment
        let sentiment = 'NEUTRAL';
        let confidence = 50;

        if (aggregatePCR < 0.7) {
            sentiment = 'BULLISH';
            confidence = 70;
            signals.push(`Low P/C ratio: ${aggregatePCR.toFixed(2)}`);
        } else if (aggregatePCR > 1.0) {
            sentiment = 'BEARISH';
            confidence = 65;
            signals.push(`High P/C ratio: ${aggregatePCR.toFixed(2)}`);
        } else {
            signals.push(`Neutral P/C ratio: ${aggregatePCR.toFixed(2)}`);
        }

        // Check IV levels
        const avgIV = metrics.reduce((sum, m) => sum + m.impliedVolatility, 0) / metrics.length;
        if (avgIV > 80) {
            signals.push(`High IV: ${avgIV.toFixed(0)}% (uncertainty)`);
            confidence -= 10;
        } else if (avgIV < 40) {
            signals.push(`Low IV: ${avgIV.toFixed(0)}% (complacency)`);
        }

        // Unusual flow analysis
        const recentBullish = recentFlows.filter(f => f.sentiment === 'BULLISH').length;
        const recentBearish = recentFlows.filter(f => f.sentiment === 'BEARISH').length;
        if (recentBullish > recentBearish * 2) {
            signals.push(`Bullish flow: ${recentBullish} vs ${recentBearish}`);
            confidence += 5;
        } else if (recentBearish > recentBullish * 2) {
            signals.push(`Bearish flow: ${recentBearish} vs ${recentBullish}`);
            confidence += 5;
        }

        return {
            sentiment,
            confidence: Math.min(100, Math.max(0, confidence)),
            put_call_ratio: Math.round(aggregatePCR * 100) / 100,
            signals
        };
    }
};
