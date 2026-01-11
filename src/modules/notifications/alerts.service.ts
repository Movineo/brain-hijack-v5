// ============================================
// Price Alerts Service - "Alert me when BTC hits $50k"
// ============================================

import pool from '../../shared/db';
import { TelegramService } from '../notifications/telegram.service';
import { PushNotificationService } from '../notifications/push.service';

interface PriceAlert {
  id: number;
  ticker: string;
  target_price: number;
  condition: 'above' | 'below';
  active: boolean;
  triggered_at?: Date;
  created_at: Date;
}

interface CreateAlertInput {
  ticker: string;
  target_price: number;
  condition: 'above' | 'below';
}

export class AlertsService {
  private static instance: AlertsService;
  private checkInterval: NodeJS.Timeout | null = null;
  private latestPrices: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): AlertsService {
    if (!AlertsService.instance) {
      AlertsService.instance = new AlertsService();
    }
    return AlertsService.instance;
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async createAlert(input: CreateAlertInput): Promise<PriceAlert> {
    try {
      const result = await pool.query(
        `INSERT INTO price_alerts (ticker, target_price, condition, active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        [input.ticker.toUpperCase(), input.target_price, input.condition]
      );
      console.log(`[ALERTS] Created alert: ${input.ticker} ${input.condition} $${input.target_price}`);
      return result.rows[0];
    } catch (err) {
      console.error('[ALERTS] Error creating alert:', err);
      throw err;
    }
  }

  async getActiveAlerts(): Promise<PriceAlert[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM price_alerts WHERE active = TRUE ORDER BY created_at DESC`
      );
      return result.rows;
    } catch (err) {
      console.error('[ALERTS] Error fetching alerts:', err);
      return [];
    }
  }

  async getAlertsByTicker(ticker: string): Promise<PriceAlert[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM price_alerts WHERE ticker = $1 ORDER BY created_at DESC`,
        [ticker.toUpperCase()]
      );
      return result.rows;
    } catch (err) {
      console.error('[ALERTS] Error fetching ticker alerts:', err);
      return [];
    }
  }

  async deleteAlert(id: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `DELETE FROM price_alerts WHERE id = $1 RETURNING id`,
        [id]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (err) {
      console.error('[ALERTS] Error deleting alert:', err);
      return false;
    }
  }

  async deactivateAlert(id: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `UPDATE price_alerts SET active = FALSE, triggered_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (err) {
      console.error('[ALERTS] Error deactivating alert:', err);
      return false;
    }
  }

  // ============================================
  // Price Checking Engine
  // ============================================

  updatePrice(ticker: string, price: number): void {
    this.latestPrices.set(ticker.toUpperCase(), price);
  }

  async checkAlerts(): Promise<void> {
    const alerts = await this.getActiveAlerts();
    if (alerts.length === 0) return;

    for (const alert of alerts) {
      const currentPrice = this.latestPrices.get(alert.ticker);
      if (!currentPrice) continue;

      const triggered = this.isAlertTriggered(alert, currentPrice);
      if (triggered) {
        await this.triggerAlert(alert, currentPrice);
      }
    }
  }

  private isAlertTriggered(alert: PriceAlert, currentPrice: number): boolean {
    if (alert.condition === 'above') {
      return currentPrice >= alert.target_price;
    } else {
      return currentPrice <= alert.target_price;
    }
  }

  private async triggerAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    console.log(`[ALERTS] 🔔 TRIGGERED: ${alert.ticker} ${alert.condition} $${alert.target_price} (now $${currentPrice.toFixed(2)})`);

    // Deactivate the alert
    await this.deactivateAlert(alert.id);

    // Format message
    const emoji = alert.condition === 'above' ? '📈' : '📉';
    const message = `${emoji} PRICE ALERT: ${alert.ticker}\n` +
      `Target: ${alert.condition === 'above' ? '≥' : '≤'} $${Number(alert.target_price).toFixed(2)}\n` +
      `Current: $${currentPrice.toFixed(2)}`;

    // Send notifications
    try {
      await TelegramService.sendMessage(message);
    } catch (err) {
      console.error('[ALERTS] Telegram notification failed');
    }

    try {
      await PushNotificationService.sendToAll(
        `Price Alert: ${alert.ticker}`,
        `${alert.ticker} hit $${currentPrice.toFixed(2)} (target: ${alert.condition} $${Number(alert.target_price).toFixed(2)})`
      );
    } catch (err) {
      console.error('[ALERTS] Push notification failed');
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  start(intervalMs: number = 5000): void {
    if (this.checkInterval) return;
    
    console.log('[ALERTS] Starting price alert checker...');
    this.checkInterval = setInterval(() => this.checkAlerts(), intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[ALERTS] Price alert checker stopped');
    }
  }

  // ============================================
  // Stats
  // ============================================

  async getStats(): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    triggeredToday: number;
  }> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE active = TRUE) as active,
          COUNT(*) FILTER (WHERE triggered_at >= CURRENT_DATE) as triggered_today
        FROM price_alerts
      `);
      
      return {
        totalAlerts: parseInt(result.rows[0]?.total || '0'),
        activeAlerts: parseInt(result.rows[0]?.active || '0'),
        triggeredToday: parseInt(result.rows[0]?.triggered_today || '0')
      };
    } catch (err) {
      return { totalAlerts: 0, activeAlerts: 0, triggeredToday: 0 };
    }
  }

  async getTriggeredHistory(limit: number = 20): Promise<PriceAlert[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM price_alerts 
         WHERE triggered_at IS NOT NULL 
         ORDER BY triggered_at DESC 
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (err) {
      console.error('[ALERTS] Error fetching history:', err);
      return [];
    }
  }
}
