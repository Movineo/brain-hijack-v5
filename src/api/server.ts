import Fastify from 'fastify';
import path from 'path';
import fastifyStatic from '@fastify/static';
import sentimentRoutes from './routes/sentiment.routes';
import dotenv from 'dotenv';
import { IngestorService } from '../modules/ingestor/ingestor.service';
import { TelegramService } from '../modules/notifications/telegram.service';

dotenv.config();

const fastify = Fastify({ logger: true });

// 1. Get exact path to public folder
const publicPath = path.join(process.cwd(), 'public');

// 2. Register Static Plugin
fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: '/', 
});

// 3. EXPLICITLY handle the root route to serve index.html
fastify.get('/', (req, reply) => {
    return reply.sendFile('index.html');
});

// 4. HEALTH CHECK ENDPOINT (Critical for Render)
fastify.get('/health', async (req, reply) => {
    return reply.send({ 
        status: 'alive', 
        timestamp: new Date().toISOString(),
        telegram: TelegramService.isConfigured() ? 'configured' : 'not configured'
    });
});

fastify.register(sentimentRoutes, { prefix: '/api/v1/sentiment' });

// Global error handler to prevent crashes
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({ 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

const start = async () => {
    try {
        const port = Number(process.env.PORT) || 3000;
        await fastify.listen({ port, host: '0.0.0.0' });
        
        console.log(`Brain Hijack v5 running at http://localhost:${port}`);
        console.log(`[Telegram] Status: ${TelegramService.isConfigured() ? '✅ Ready' : '⚠️ Not configured'}`);

        // UPDATED: No arguments needed. 
        // The Ingestor now automatically filters the CoinCap firehose for BTC, ETH, SOL, DOGE, PEPE.
        IngestorService.startIngestion(); 

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

start();