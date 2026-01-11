// CONFIG SERVICE: Runtime configuration management
// This handles kill switches, thresholds, and other runtime settings

interface TradingConfig {
    killSwitch: boolean;              // Master kill switch
    paperTradingEnabled: boolean;     // Paper trading active
    liveTradingEnabled: boolean;      // Live trading active
    entryThreshold: number;           // Hijack force entry threshold
    exitThreshold: number;            // Momentum died threshold
    stopLossPercent: number;          // Stop loss percentage
    takeProfitPercent: number;        // Take profit percentage
    trailingStopEnabled: boolean;     // Trailing stop active
    trailingStopPercent: number;      // Trail percentage
    trailingActivation: number;       // Activation profit %
    requireNarrative: boolean;        // Require news confirmation
    maxOpenPositions: number;         // Max concurrent positions
    tradeSizeUsd: number;             // Position size
}

// Default configuration
const DEFAULT_CONFIG: TradingConfig = {
    killSwitch: false,
    paperTradingEnabled: true,
    liveTradingEnabled: false,
    entryThreshold: 0.08,
    exitThreshold: 0.01,
    stopLossPercent: -2.0,
    takeProfitPercent: 3.0,
    trailingStopEnabled: true,
    trailingStopPercent: 1.5,
    trailingActivation: 1.0,
    requireNarrative: true,
    maxOpenPositions: 5,
    tradeSizeUsd: 1000
};

// Runtime config (in-memory, persists until restart)
let currentConfig: TradingConfig = { ...DEFAULT_CONFIG };

export const ConfigService = {
    // Get current config
    getConfig: (): TradingConfig => {
        return { ...currentConfig };
    },

    // Update config (partial update)
    updateConfig: (updates: Partial<TradingConfig>): TradingConfig => {
        currentConfig = { ...currentConfig, ...updates };
        console.log('[CONFIG] Updated:', updates);
        return currentConfig;
    },

    // KILL SWITCH: Emergency stop all trading
    activateKillSwitch: (): void => {
        currentConfig.killSwitch = true;
        currentConfig.paperTradingEnabled = false;
        currentConfig.liveTradingEnabled = false;
        console.log('[CONFIG] ⛔ KILL SWITCH ACTIVATED - All trading stopped');
    },

    // Deactivate kill switch
    deactivateKillSwitch: (): void => {
        currentConfig.killSwitch = false;
        currentConfig.paperTradingEnabled = true;
        console.log('[CONFIG] ✅ Kill switch deactivated - Paper trading resumed');
    },

    // Check if trading is allowed
    isTradingAllowed: (): boolean => {
        return !currentConfig.killSwitch && (currentConfig.paperTradingEnabled || currentConfig.liveTradingEnabled);
    },

    // Check specific trading type
    isPaperTradingAllowed: (): boolean => {
        return !currentConfig.killSwitch && currentConfig.paperTradingEnabled;
    },

    isLiveTradingAllowed: (): boolean => {
        return !currentConfig.killSwitch && currentConfig.liveTradingEnabled;
    },

    // Reset to defaults
    resetToDefaults: (): TradingConfig => {
        currentConfig = { ...DEFAULT_CONFIG };
        console.log('[CONFIG] Reset to defaults');
        return currentConfig;
    },

    // Get specific values (for use in other services)
    getEntryThreshold: (): number => currentConfig.entryThreshold,
    getExitThreshold: (): number => currentConfig.exitThreshold,
    getStopLossPercent: (): number => currentConfig.stopLossPercent,
    getTakeProfitPercent: (): number => currentConfig.takeProfitPercent,
    getTrailingStopEnabled: (): boolean => currentConfig.trailingStopEnabled,
    getTrailingStopPercent: (): number => currentConfig.trailingStopPercent,
    getTrailingActivation: (): number => currentConfig.trailingActivation,
    getRequireNarrative: (): boolean => currentConfig.requireNarrative,
    getMaxOpenPositions: (): number => currentConfig.maxOpenPositions,
    getTradeSizeUsd: (): number => currentConfig.tradeSizeUsd
};
