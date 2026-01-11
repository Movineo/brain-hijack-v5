import WebSocket from 'ws';
import { Server } from 'http';

// Store for broadcasting to all connected clients
let wss: WebSocket.Server | null = null;
const clients: Set<WebSocket> = new Set();

export const WebSocketService = {
    // Initialize WebSocket server
    initialize: (server: Server) => {
        wss = new WebSocket.Server({ server, path: '/ws' });

        wss.on('connection', (ws: WebSocket) => {
            clients.add(ws);
            console.log(`[WS] Client connected. Total: ${clients.size}`);

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Brain Hijack WebSocket connected',
                timestamp: new Date().toISOString()
            }));

            ws.on('close', () => {
                clients.delete(ws);
                console.log(`[WS] Client disconnected. Total: ${clients.size}`);
            });

            ws.on('error', (err) => {
                console.error('[WS] Client error:', err);
                clients.delete(ws);
            });
        });

        console.log('[WS] WebSocket server initialized on /ws');
    },

    // Broadcast leaderboard update to all clients
    broadcastLeaderboard: (leaderboard: any[]) => {
        const message = JSON.stringify({
            type: 'leaderboard',
            data: leaderboard,
            timestamp: new Date().toISOString()
        });

        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    },

    // Broadcast trade execution
    broadcastTrade: (trade: {
        action: 'BUY' | 'SELL';
        ticker: string;
        price: number;
        force: number;
        reason?: string;
        pnl?: number;
    }) => {
        const message = JSON.stringify({
            type: 'trade',
            data: trade,
            timestamp: new Date().toISOString()
        });

        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    },

    // Broadcast hijack alert (high force detected)
    broadcastHijackAlert: (alert: {
        ticker: string;
        force: number;
        price: number;
        narrative?: number;
    }) => {
        const message = JSON.stringify({
            type: 'hijack_alert',
            data: alert,
            timestamp: new Date().toISOString()
        });

        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    },

    // Broadcast stats update
    broadcastStats: (stats: any) => {
        const message = JSON.stringify({
            type: 'stats',
            data: stats,
            timestamp: new Date().toISOString()
        });

        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    },

    // Get connection count
    getClientCount: () => clients.size,

    // Check if initialized
    isReady: () => wss !== null
};
