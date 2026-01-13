// BRAIN SCANNER SERVICE
// "Your job is to HIJACK BRAINS" - Giovanni
// 
// This service detects when the HERD'S brain is being hijacked:
// - FOMO (Fear Of Missing Out) → Greed spike, volume surge, price acceleration
// - FUD (Fear, Uncertainty, Doubt) → Panic selling, extreme fear, capitulation
// - EUPHORIA → Extreme greed, overleveraged longs, social mania
// - CAPITULATION → Extreme fear, overleveraged shorts, silence
//
// We don't trade OUR emotions. We trade THEIR emotions.
// "Operate like a psychopathic scientist. Nothing attached."

import { FearGreedService } from '../sentiment/fear-greed.service';
import { TwitterService } from '../sentiment/twitter.service';
import { OptionsFlowService } from '../analytics/options-flow.service';
import { OnChainService } from '../analytics/onchain.service';

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
    timestamp: Date;
}

interface HijackTrigger {
    name: string;
    description: string;
    strength: number;
    type: 'FOMO' | 'FUD' | 'MOMENTUM' | 'CONTRARIAN' | 'SMART_MONEY';
}

// The Scanner
export const BrainScannerService = {
    
    // Main scan - What's happening in the herd's brain?
    scanHerdBrain: async (ticker: string, currentForce: number, priceChange24h: number = 0): Promise<HijackSignal> => {
        const baseTicker = ticker.replace('USD', '').replace('-USD', '');
        const triggers: HijackTrigger[] = [];
        
        let fomoScore = 0;
        let fearScore = 0;
        let smartMoneyScore = 0;
        
        // 1. FEAR & GREED - Direct measurement of herd emotion
        try {
            const fg = await FearGreedService.getIndex();
            
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
        
        // DETERMINE BRAIN STATE
        const brainState = BrainScannerService.determineBrainState(fomoScore, fearScore);
        
        // DETERMINE OPTIMAL DIRECTION
        // Key insight: Trade WITH momentum, but be CONTRARIAN at extremes
        let optimalDirection: 'LONG' | 'SHORT';
        let contrarian = false;
        let herdDirection: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
        
        if (brainState === 'CAPITULATION' || brainState === 'DEPRESSION') {
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
        
        // Calculate hijack strength
        const hijackStrength = Math.min(100, Math.max(
            fomoScore,
            fearScore,
            Math.abs(smartMoneyScore) * 2
        ));
        
        // Confidence based on trigger alignment
        const confidence = triggers.length >= 3 
            ? Math.min(90, hijackStrength + triggers.length * 5)
            : Math.min(60, hijackStrength);
        
        return {
            ticker,
            brainState,
            hijackStrength,
            contrarian,
            herdDirection,
            optimalDirection,
            confidence,
            triggers,
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
    }
};
