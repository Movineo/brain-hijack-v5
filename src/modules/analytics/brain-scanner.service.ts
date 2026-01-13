// BRAIN SCANNER SERVICE v2.0
// "Your job is to HIJACK BRAINS" - Giovanni
// 
// This service detects when the HERD'S brain is being hijacked:
// - FOMO (Fear Of Missing Out) → Greed spike, volume surge, price acceleration
// - FUD (Fear, Uncertainty, Doubt) → Panic selling, extreme fear, capitulation
// - EUPHORIA → Extreme greed, overleveraged longs, social mania
// - CAPITULATION → Extreme fear, overleveraged shorts, silence
//
// v2.0 IMPROVEMENTS:
// - Sentiment VELOCITY detection (rate of change = early warning)
// - Pattern matching against known herd behaviors
// - Historical brain state storage for ML training
// - Multi-factor hijack strength calculation
//
// We don't trade OUR emotions. We trade THEIR emotions.
// "Operate like a psychopathic scientist. Nothing attached."

import { FearGreedService } from '../sentiment/fear-greed.service';
import { TwitterService } from '../sentiment/twitter.service';
import { OptionsFlowService } from '../analytics/options-flow.service';
import { OnChainService } from '../analytics/onchain.service';
import pool from '../../shared/db';

// Brain States - What's happening in the herd's mind
export type BrainState = 
    | 'FOMO'           // Greed taking over, chase mode
    | 'EUPHORIA'       // Peak delusion, "it only goes up"
    | 'COMPLACENCY'    // Calm before storm
    | 'ANXIETY'        // Starting to worry
    | 'DENIAL'         // "It'll bounce back"
    | 'PANIC'          // Selling everything
    | 'CAPITULATION'   // Given up, maximum fear
    | 'DEPRESSION'     // Silence, no one cares
    | 'HOPE'           // Starting to recover
    | 'NEUTRAL';       // No clear state

// Hijack Signal - When to strike
export interface HijackSignal {
    ticker: string;
    brainState: BrainState;
    hijackStrength: number;     // 0-100, how strong is the hijack
    contrarian: boolean;        // Are we going AGAINST the herd?
    herdDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
    optimalDirection: 'LONG' | 'SHORT';
    confidence: number;
    triggers: HijackTrigger[];
    // v2.0 additions
    sentimentVelocity: number;  // Rate of sentiment change per hour
    patternMatch?: string;      // Matched herd pattern name
    patternBoost: number;       // Extra confidence from pattern
    timestamp: Date;
}

interface HijackTrigger {
    name: string;
    description: string;
    strength: number;
    type: 'FOMO' | 'FUD' | 'MOMENTUM' | 'CONTRARIAN' | 'SMART_MONEY' | 'VELOCITY' | 'PATTERN';
}

// Historical state for velocity calculation
interface SentimentSnapshot {
    fearGreed: number;
    socialScore: number;
    timestamp: Date;
}

// In-memory cache for velocity calculation
const sentimentHistory: Map<string, SentimentSnapshot[]> = new Map();
const MAX_HISTORY_SIZE = 60; // 1 hour at 1-minute intervals

// The Scanner
export const BrainScannerService = {
    
    // Main scan - What's happening in the herd's brain?
    scanHerdBrain: async (ticker: string, currentForce: number, priceChange24h: number = 0): Promise<HijackSignal> => {
        const baseTicker = ticker.replace('USD', '').replace('-USD', '');
        const triggers: HijackTrigger[] = [];
        
        let fomoScore = 0;
        let fearScore = 0;
        let smartMoneyScore = 0;
        let currentFearGreed = 50;
        let currentSocialScore = 0;
        
        // 1. FEAR & GREED - Direct measurement of herd emotion
        try {
            const fg = await FearGreedService.getIndex();
            currentFearGreed = fg.value;
            
            if (fg.value <= 20) {
                // EXTREME FEAR = Contrarian BUY signal
                triggers.push({
                    name: 'EXTREME_FEAR',
                    description: `Fear & Greed at ${fg.value} - Herd is CAPITULATING`,
                    strength: 90,
                    type: 'CONTRARIAN'
                });
                fearScore = 90;
                smartMoneyScore += 30; // Smart money buys fear
            } else if (fg.value <= 35) {
                triggers.push({
                    name: 'HIGH_FEAR',
                    description: `Fear & Greed at ${fg.value} - Herd is ANXIOUS`,
                    strength: 60,
                    type: 'FUD'
                });
                fearScore = 60;
                smartMoneyScore += 15;
            } else if (fg.value >= 80) {
                // EXTREME GREED = Contrarian SELL signal
                triggers.push({
                    name: 'EXTREME_GREED',
                    description: `Fear & Greed at ${fg.value} - Herd is EUPHORIC`,
                    strength: 85,
                    type: 'CONTRARIAN'
                });
                fomoScore = 85;
                smartMoneyScore -= 20; // Smart money sells greed
            } else if (fg.value >= 65) {
                triggers.push({
                    name: 'HIGH_GREED',
                    description: `Fear & Greed at ${fg.value} - Herd is GREEDY`,
                    strength: 50,
                    type: 'FOMO'
                });
                fomoScore = 50;
            }
        } catch (e) { /* Skip */ }
        
        // 2. SOCIAL SENTIMENT - What's the herd saying?
        try {
            const social = TwitterService.getSentiment(baseTicker);
            currentSocialScore = social.score;
            
            if (social.score >= 5) {
                triggers.push({
                    name: 'SOCIAL_MANIA',
                    description: `Social score ${social.score.toFixed(1)} - Herd is MANIC`,
                    strength: 70,
                    type: 'FOMO'
                });
                fomoScore = Math.max(fomoScore, 70);
            } else if (social.score >= 2) {
                triggers.push({
                    name: 'SOCIAL_BULLISH',
                    description: `Social score ${social.score.toFixed(1)} - Herd is OPTIMISTIC`,
                    strength: 40,
                    type: 'MOMENTUM'
                });
                fomoScore = Math.max(fomoScore, 40);
            } else if (social.score <= -3) {
                triggers.push({
                    name: 'SOCIAL_PANIC',
                    description: `Social score ${social.score.toFixed(1)} - Herd is PANICKING`,
                    strength: 65,
                    type: 'FUD'
                });
                fearScore = Math.max(fearScore, 65);
                smartMoneyScore += 15;
            } else if (social.score <= -1) {
                triggers.push({
                    name: 'SOCIAL_BEARISH',
                    description: `Social score ${social.score.toFixed(1)} - Herd is WORRIED`,
                    strength: 35,
                    type: 'FUD'
                });
                fearScore = Math.max(fearScore, 35);
            }
            
            // Trending = Attention hijack
            if (social.trending && social.posts >= 10) {
                triggers.push({
                    name: 'ATTENTION_SPIKE',
                    description: `${social.posts} posts - Herd ATTENTION hijacked`,
                    strength: 45,
                    type: 'MOMENTUM'
                });
            }
        } catch (e) { /* Skip */ }
        
        // 3. OPTIONS FLOW - What's smart money doing?
        if (['BTC', 'ETH', 'BTCUSD', 'ETHUSD'].includes(ticker) || ['BTC', 'ETH'].includes(baseTicker)) {
            try {
                const options = await OptionsFlowService.getMarketSentiment();
                
                if (options.put_call_ratio <= 0.5) {
                    // Extreme call buying = FOMO
                    triggers.push({
                        name: 'OPTIONS_FOMO',
                        description: `P/C ${options.put_call_ratio.toFixed(2)} - Heavy CALL buying`,
                        strength: 60,
                        type: 'SMART_MONEY'
                    });
                    smartMoneyScore += 20;
                } else if (options.put_call_ratio >= 1.5) {
                    // Extreme put buying = Hedging/Fear
                    triggers.push({
                        name: 'OPTIONS_HEDGING',
                        description: `P/C ${options.put_call_ratio.toFixed(2)} - Heavy PUT buying`,
                        strength: 55,
                        type: 'SMART_MONEY'
                    });
                    smartMoneyScore -= 15;
                    fearScore = Math.max(fearScore, 40);
                }
            } catch (e) { /* Skip */ }
        }
        
        // 4. HIJACK FORCE - Momentum detection
        if (currentForce > 0.01) {
            triggers.push({
                name: 'STRONG_HIJACK',
                description: `Force ${currentForce.toFixed(4)} - Brain hijack in PROGRESS`,
                strength: 80,
                type: 'MOMENTUM'
            });
            fomoScore = Math.max(fomoScore, 75);
        } else if (currentForce > 0.005) {
            triggers.push({
                name: 'MODERATE_HIJACK',
                description: `Force ${currentForce.toFixed(4)} - Hijack building`,
                strength: 55,
                type: 'MOMENTUM'
            });
            fomoScore = Math.max(fomoScore, 50);
        } else if (currentForce > 0.002) {
            triggers.push({
                name: 'WEAK_HIJACK',
                description: `Force ${currentForce.toFixed(4)} - Early hijack signal`,
                strength: 35,
                type: 'MOMENTUM'
            });
        }
        
        // 5. ON-CHAIN - Network health
        try {
            const onchain = OnChainService.getHealthScore(baseTicker);
            if (onchain.score >= 75) {
                triggers.push({
                    name: 'STRONG_FUNDAMENTALS',
                    description: `On-chain health ${onchain.score}/100`,
                    strength: 30,
                    type: 'SMART_MONEY'
                });
                smartMoneyScore += 10;
            } else if (onchain.score <= 40) {
                triggers.push({
                    name: 'WEAK_FUNDAMENTALS',
                    description: `On-chain health ${onchain.score}/100`,
                    strength: 25,
                    type: 'FUD'
                });
                smartMoneyScore -= 10;
            }
        } catch (e) { /* Skip */ }
        
        // 6. SENTIMENT VELOCITY - Rate of change detection (EARLY WARNING)
        const velocity = BrainScannerService.calculateSentimentVelocity(ticker, currentFearGreed, currentSocialScore);
        
        if (velocity > 5) {
            // Sentiment rising fast = FOMO building
            triggers.push({
                name: 'VELOCITY_SPIKE_UP',
                description: `Sentiment rising ${velocity.toFixed(1)} pts/hr - FOMO accelerating`,
                strength: Math.min(80, 40 + velocity * 4),
                type: 'VELOCITY'
            });
            fomoScore = Math.max(fomoScore, 50 + velocity * 3);
        } else if (velocity < -5) {
            // Sentiment falling fast = Panic building
            triggers.push({
                name: 'VELOCITY_SPIKE_DOWN',
                description: `Sentiment falling ${Math.abs(velocity).toFixed(1)} pts/hr - PANIC accelerating`,
                strength: Math.min(80, 40 + Math.abs(velocity) * 4),
                type: 'VELOCITY'
            });
            fearScore = Math.max(fearScore, 50 + Math.abs(velocity) * 3);
            smartMoneyScore += 10; // Fast drops = buying opportunity
        } else if (velocity > 2) {
            triggers.push({
                name: 'VELOCITY_RISING',
                description: `Sentiment rising ${velocity.toFixed(1)} pts/hr`,
                strength: 30,
                type: 'VELOCITY'
            });
        } else if (velocity < -2) {
            triggers.push({
                name: 'VELOCITY_FALLING',
                description: `Sentiment falling ${Math.abs(velocity).toFixed(1)} pts/hr`,
                strength: 30,
                type: 'VELOCITY'
            });
        }
        
        // 7. PATTERN MATCHING - Known herd behavior patterns
        const patternMatch = await BrainScannerService.matchHerdPattern(
            currentFearGreed, 
            velocity, 
            currentSocialScore
        );
        
        if (patternMatch.matched) {
            triggers.push({
                name: `PATTERN_${patternMatch.pattern}`,
                description: patternMatch.description,
                strength: patternMatch.confidence,
                type: 'PATTERN'
            });
        }
        
        // DETERMINE BRAIN STATE
        const brainState = BrainScannerService.determineBrainState(fomoScore, fearScore);
        
        // DETERMINE OPTIMAL DIRECTION
        // Key insight: Trade WITH momentum, but be CONTRARIAN at extremes
        let optimalDirection: 'LONG' | 'SHORT';
        let contrarian = false;
        let herdDirection: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
        
        // Pattern-based direction override (highest priority)
        if (patternMatch.matched && patternMatch.action !== 'WAIT') {
            optimalDirection = patternMatch.action;
            contrarian = ['FOMO_TOP', 'CAPITULATION_BOTTOM', 'EUPHORIA_PEAK', 'DEPRESSION_BOTTOM'].includes(patternMatch.pattern);
            herdDirection = optimalDirection === 'LONG' ? 'SHORT' : 'LONG';
        } else if (brainState === 'CAPITULATION' || brainState === 'DEPRESSION') {
            // Extreme fear = BUY (contrarian)
            optimalDirection = 'LONG';
            contrarian = true;
            herdDirection = 'SHORT';
        } else if (brainState === 'EUPHORIA') {
            // Extreme greed = SELL (contrarian)
            optimalDirection = 'SHORT';
            contrarian = true;
            herdDirection = 'LONG';
        } else if (brainState === 'FOMO' || brainState === 'HOPE') {
            // Momentum up = ride the wave
            optimalDirection = 'LONG';
            herdDirection = 'LONG';
        } else if (brainState === 'PANIC' || brainState === 'ANXIETY') {
            // Momentum down = ride the wave (or stay out)
            optimalDirection = 'SHORT';
            herdDirection = 'SHORT';
        } else {
            // Neutral = follow smart money
            optimalDirection = smartMoneyScore > 0 ? 'LONG' : 'SHORT';
        }
        
        // Calculate hijack strength (multi-factor)
        const baseStrength = Math.max(fomoScore, fearScore);
        const velocityBoost = Math.min(20, Math.abs(velocity) * 2);
        const triggerBoost = Math.min(15, triggers.length * 3);
        const hijackStrength = Math.min(100, baseStrength + velocityBoost + triggerBoost);
        
        // Confidence based on trigger alignment + pattern matching
        let confidence = triggers.length >= 3 
            ? Math.min(90, hijackStrength + triggers.length * 5)
            : Math.min(60, hijackStrength);
        
        // Add pattern boost
        confidence = Math.min(95, confidence + patternMatch.boost);
        
        // Store brain state for ML training (async, don't await)
        BrainScannerService.storeBrainState(ticker, brainState, hijackStrength, {
            triggers,
            fearGreed: currentFearGreed,
            socialSentiment: currentSocialScore,
            velocity,
            contrarian,
            herdDirection,
            optimalDirection
        }).catch(() => {});
        
        return {
            ticker,
            brainState,
            hijackStrength,
            contrarian,
            herdDirection,
            optimalDirection,
            confidence,
            triggers,
            sentimentVelocity: velocity,
            patternMatch: patternMatch.matched ? patternMatch.pattern : undefined,
            patternBoost: patternMatch.boost,
            timestamp: new Date()
        };
    },
    
    // Determine what state the herd's brain is in
    determineBrainState: (fomoScore: number, fearScore: number): BrainState => {
        if (fearScore >= 80) return 'CAPITULATION';
        if (fearScore >= 60) return 'PANIC';
        if (fearScore >= 40) return 'ANXIETY';
        
        if (fomoScore >= 80) return 'EUPHORIA';
        if (fomoScore >= 60) return 'FOMO';
        if (fomoScore >= 40) return 'HOPE';
        
        if (fearScore >= 25 && fomoScore >= 25) return 'COMPLACENCY';
        if (fearScore >= 30) return 'DENIAL';
        if (fearScore <= 10 && fomoScore <= 10) return 'DEPRESSION';
        
        return 'NEUTRAL';
    },
    
    // Quick check - Is this a strong hijack opportunity?
    isStrongHijack: (signal: HijackSignal): boolean => {
        return signal.hijackStrength >= 60 && signal.confidence >= 50;
    },
    
    // Get trading recommendation
    getRecommendation: (signal: HijackSignal): string => {
        if (signal.hijackStrength < 30) {
            return '⏸️ WAIT - Weak hijack, no clear opportunity';
        }
        
        if (signal.contrarian) {
            if (signal.brainState === 'CAPITULATION') {
                return `🎯 CONTRARIAN LONG - Herd capitulating, smart money accumulating`;
            }
            if (signal.brainState === 'EUPHORIA') {
                return `🎯 CONTRARIAN SHORT - Herd euphoric, smart money distributing`;
            }
        }
        
        if (signal.brainState === 'FOMO') {
            return `🚀 MOMENTUM LONG - Ride the FOMO wave`;
        }
        
        if (signal.brainState === 'PANIC') {
            return `📉 MOMENTUM SHORT - Ride the panic (or stay out)`;
        }
        
        return `⚖️ NEUTRAL - No strong brain hijack detected`;
    },
    
    // Calculate sentiment velocity (rate of change per hour)
    calculateSentimentVelocity: (ticker: string, currentFearGreed: number, currentSocialScore: number): number => {
        const history = sentimentHistory.get(ticker) || [];
        const now = new Date();
        
        // Add current snapshot
        history.push({
            fearGreed: currentFearGreed,
            socialScore: currentSocialScore,
            timestamp: now
        });
        
        // Keep only last hour of data
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const filtered = history.filter(h => h.timestamp > oneHourAgo);
        
        // Limit size
        while (filtered.length > MAX_HISTORY_SIZE) {
            filtered.shift();
        }
        sentimentHistory.set(ticker, filtered);
        
        // Need at least 5 minutes of data
        if (filtered.length < 5) return 0;
        
        // Calculate velocity using oldest vs newest
        const oldest = filtered[0];
        const newest = filtered[filtered.length - 1];
        const timeDiffHours = (newest.timestamp.getTime() - oldest.timestamp.getTime()) / (1000 * 60 * 60);
        
        if (timeDiffHours < 0.05) return 0; // Need at least 3 minutes
        
        // Combined velocity: Fear/Greed change + Social score change
        const fgVelocity = (newest.fearGreed - oldest.fearGreed) / timeDiffHours;
        const socialVelocity = (newest.socialScore - oldest.socialScore) * 10 / timeDiffHours;
        
        return (fgVelocity + socialVelocity) / 2;
    },
    
    // Match against known herd behavior patterns
    matchHerdPattern: async (fearGreed: number, velocity: number, socialScore: number): Promise<{
        matched: boolean;
        pattern: string;
        description: string;
        action: 'LONG' | 'SHORT' | 'WAIT';
        confidence: number;
        boost: number;
    }> => {
        // Default: no pattern matched
        const noMatch = { matched: false, pattern: '', description: '', action: 'WAIT' as const, confidence: 0, boost: 0 };
        
        try {
            const result = await pool.query(`
                SELECT pattern_name, description, recommended_action, confidence_boost,
                       times_detected, times_profitable
                FROM herd_patterns
                WHERE fear_greed_min <= $1 AND fear_greed_max >= $1
                  AND (sentiment_velocity_min IS NULL OR sentiment_velocity_min <= $2)
                  AND (sentiment_velocity_max IS NULL OR sentiment_velocity_max >= $2)
                  AND (social_sentiment_min IS NULL OR social_sentiment_min <= $3)
                  AND (social_sentiment_max IS NULL OR social_sentiment_max >= $3)
                ORDER BY confidence_boost DESC
                LIMIT 1
            `, [fearGreed, velocity, socialScore / 10]); // Normalize social score to -1/+1
            
            if (result.rows.length > 0) {
                const p = result.rows[0];
                const winRate = p.times_detected > 0 
                    ? (p.times_profitable / p.times_detected * 100).toFixed(0)
                    : 'N/A';
                    
                return {
                    matched: true,
                    pattern: p.pattern_name,
                    description: `${p.description} (${winRate}% historical win rate)`,
                    action: p.recommended_action,
                    confidence: 60 + p.confidence_boost,
                    boost: p.confidence_boost
                };
            }
        } catch (e) {
            // Pattern matching failed, continue without
        }
        
        // Fallback: Hardcoded extreme patterns (no DB)
        if (fearGreed >= 85 && velocity < -0.5) {
            return {
                matched: true,
                pattern: 'EUPHORIA_REVERSAL',
                description: 'Extreme greed + sentiment reversing = TOP signal',
                action: 'SHORT',
                confidence: 80,
                boost: 20
            };
        }
        
        if (fearGreed <= 15 && velocity > 0.5) {
            return {
                matched: true,
                pattern: 'CAPITULATION_REVERSAL',
                description: 'Extreme fear + sentiment recovering = BOTTOM signal',
                action: 'LONG',
                confidence: 85,
                boost: 25
            };
        }
        
        return noMatch;
    },
    
    // Store brain state for ML training
    storeBrainState: async (ticker: string, brainState: BrainState, hijackStrength: number, data: {
        triggers: HijackTrigger[];
        fearGreed: number;
        socialSentiment: number;
        velocity: number;
        contrarian: boolean;
        herdDirection: string;
        optimalDirection: string;
    }): Promise<void> => {
        try {
            // Only store significant states (above threshold)
            if (hijackStrength < 40) return;
            
            // Determine trigger type
            const triggerTypes = data.triggers.map(t => t.type);
            const triggerType = triggerTypes.includes('CONTRARIAN') ? 'CONTRARIAN'
                : triggerTypes.includes('VELOCITY') ? 'VELOCITY'
                : triggerTypes.includes('FOMO') ? 'FOMO'
                : triggerTypes.includes('FUD') ? 'FUD'
                : 'MOMENTUM';
            
            await pool.query(`
                INSERT INTO brain_states (
                    ticker, brain_state, hijack_strength, trigger_type,
                    is_contrarian, herd_direction, optimal_direction,
                    fear_greed_index, social_sentiment, sentiment_velocity
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                ticker,
                brainState,
                hijackStrength,
                triggerType,
                data.contrarian,
                data.herdDirection,
                data.optimalDirection,
                data.fearGreed,
                data.socialSentiment / 10, // Normalize to -1/+1
                data.velocity
            ]);
        } catch (e) {
            // Storage failed, continue (not critical)
        }
    },
    
    // Get recent brain states for a ticker (for analysis)
    getRecentBrainStates: async (ticker: string, limit: number = 20): Promise<any[]> => {
        try {
            const result = await pool.query(`
                SELECT brain_state, hijack_strength, trigger_type, 
                       is_contrarian, optimal_direction, recorded_at
                FROM brain_states
                WHERE ticker = $1
                ORDER BY recorded_at DESC
                LIMIT $2
            `, [ticker, limit]);
            return result.rows;
        } catch (e) {
            return [];
        }
    },
    
    // Analyze pattern effectiveness (for dashboard)
    getPatternStats: async (): Promise<any[]> => {
        try {
            const result = await pool.query(`
                SELECT pattern_name, description, recommended_action,
                       times_detected, times_profitable,
                       CASE WHEN times_detected > 0 
                            THEN ROUND(times_profitable::numeric / times_detected * 100, 1)
                            ELSE 0 END as win_rate_pct,
                       avg_profit_pct
                FROM herd_patterns
                ORDER BY times_detected DESC
            `);
            return result.rows;
        } catch (e) {
            return [];
        }
    }};