import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = token ? new TelegramBot(token, { polling: false }) : null;

// COOLDOWN SYSTEM
// Keeps track of when we last alerted for a specific ticker
// Format: { 'BTC': 1768123456789, 'DOGE': ... }
const cooldowns: Record<string, number> = {};
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 Minutes in milliseconds

export const TelegramService = {
    sendHijackAlert: async (ticker: string, price: number, force: number) => {
        if (!bot || !chatId) {
            console.warn('[Telegram] Credentials missing. Skipping alert.');
            return;
        }

        const now = Date.now();
        const lastAlert = cooldowns[ticker] || 0;

        // If we alerted recently, shut up
        if (now - lastAlert < COOLDOWN_TIME) {
            return;
        }

        // CRAFT THE MESSAGE
        const message = `
🚨 <b>HIJACK DETECTED: ${ticker}</b>

<b>Force:</b> ${force.toFixed(2)} ⚡
<b>Price:</b> $${price.toFixed(4)}
<b>Time:</b> ${new Date().toLocaleTimeString()}

<i>The crowd is moving. Check the Panopticon.</i>
        `;

        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            console.log(`[Telegram] Alert sent for ${ticker}`);
            
            // Update cooldown
            cooldowns[ticker] = now;
        } catch (error) {
            console.error('[Telegram] Failed to send:', error);
        }
    }
};