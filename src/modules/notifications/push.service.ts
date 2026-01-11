import webpush from 'web-push';

// WEB PUSH NOTIFICATION SERVICE
// Sends browser push notifications for hijack alerts

interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

// Store subscriptions in memory (use database in production)
const subscriptions: Set<string> = new Set();
const subscriptionObjects: Map<string, PushSubscription> = new Map();

// Configure web-push (generate keys with: npx web-push generate-vapid-keys)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BKxJF7PdJ0d5K5s3Z9Y8pN8RvN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5xZN5';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'abcdef1234567890abcdef1234567890abcdef12';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@brainhijack.io';

webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

export const PushNotificationService = {
    // Get VAPID public key for frontend
    getPublicKey: (): string => {
        return VAPID_PUBLIC_KEY;
    },

    // Subscribe a client to push notifications
    subscribe: (subscription: PushSubscription): { success: boolean; message: string } => {
        try {
            const key = subscription.endpoint;
            subscriptions.add(key);
            subscriptionObjects.set(key, subscription);
            console.log('[PUSH] New subscription added');
            return { success: true, message: 'Subscribed successfully' };
        } catch (err) {
            console.error('[PUSH] Subscribe error:', err);
            return { success: false, message: 'Failed to subscribe' };
        }
    },

    // Unsubscribe a client
    unsubscribe: (endpoint: string): { success: boolean; message: string } => {
        if (subscriptions.has(endpoint)) {
            subscriptions.delete(endpoint);
            subscriptionObjects.delete(endpoint);
            console.log('[PUSH] Subscription removed');
            return { success: true, message: 'Unsubscribed successfully' };
        }
        return { success: false, message: 'Subscription not found' };
    },

    // Send notification to all subscribers
    sendToAll: async (title: string, body: string, data?: any): Promise<{ sent: number; failed: number }> => {
        let sent = 0;
        let failed = 0;

        const payload = JSON.stringify({
            title,
            body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            data: data || {}
        });

        for (const [endpoint, subscription] of subscriptionObjects.entries()) {
            try {
                await webpush.sendNotification(subscription, payload);
                sent++;
            } catch (err: any) {
                console.error('[PUSH] Send error:', err);
                failed++;
                
                // Remove invalid subscriptions
                if (err.statusCode === 410 || err.statusCode === 404) {
                    subscriptions.delete(endpoint);
                    subscriptionObjects.delete(endpoint);
                }
            }
        }

        return { sent, failed };
    },

    // Send hijack alert notification
    sendHijackAlert: async (ticker: string, force: number, price: number): Promise<void> => {
        const title = `🚨 Hijack Alert: ${ticker}`;
        const body = `Force: ${force.toFixed(4)} | Price: $${price.toFixed(2)}`;
        
        const result = await PushNotificationService.sendToAll(title, body, {
            type: 'hijack_alert',
            ticker,
            force,
            price
        });
        
        if (result.sent > 0) {
            console.log(`[PUSH] Hijack alert sent to ${result.sent} subscribers`);
        }
    },

    // Send trade notification
    sendTradeAlert: async (action: 'BUY' | 'SELL', ticker: string, price: number, pnl?: number): Promise<void> => {
        const emoji = action === 'BUY' ? '🔫' : (pnl && pnl >= 0 ? '💰' : '💸');
        const title = `${emoji} ${action}: ${ticker}`;
        const body = action === 'BUY' 
            ? `Entered at $${price.toFixed(2)}`
            : `Exited at $${price.toFixed(2)} | P&L: $${pnl?.toFixed(2) || '0.00'}`;
        
        await PushNotificationService.sendToAll(title, body, {
            type: 'trade',
            action,
            ticker,
            price,
            pnl
        });
    },

    // Get subscriber count
    getSubscriberCount: (): number => {
        return subscriptions.size;
    }
};
