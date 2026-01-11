import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

// AUTHENTICATION SERVICE
// Simple API key authentication for protected endpoints

// In production, store these in database
const API_KEYS: Map<string, { name: string; permissions: string[]; created: Date }> = new Map();

// Generate initial admin key from env or create random
const ADMIN_KEY = process.env.ADMIN_API_KEY || crypto.randomBytes(32).toString('hex');

// Initialize with admin key
API_KEYS.set(ADMIN_KEY, {
    name: 'Admin',
    permissions: ['read', 'write', 'admin'],
    created: new Date()
});

console.log(`[AUTH] Admin API Key: ${ADMIN_KEY.substring(0, 8)}...`);

export const AuthService = {
    // Validate API key
    validateKey: (apiKey: string): { valid: boolean; permissions: string[] } => {
        const keyData = API_KEYS.get(apiKey);
        if (!keyData) {
            return { valid: false, permissions: [] };
        }
        return { valid: true, permissions: keyData.permissions };
    },

    // Check specific permission
    hasPermission: (apiKey: string, permission: string): boolean => {
        const { valid, permissions } = AuthService.validateKey(apiKey);
        return valid && (permissions.includes(permission) || permissions.includes('admin'));
    },

    // Generate new API key
    generateKey: (name: string, permissions: string[] = ['read']): string => {
        const newKey = crypto.randomBytes(32).toString('hex');
        API_KEYS.set(newKey, {
            name,
            permissions,
            created: new Date()
        });
        return newKey;
    },

    // Revoke API key
    revokeKey: (apiKey: string): boolean => {
        return API_KEYS.delete(apiKey);
    },

    // List all keys (masked)
    listKeys: (): { key: string; name: string; permissions: string[]; created: Date }[] => {
        const keys: { key: string; name: string; permissions: string[]; created: Date }[] = [];
        API_KEYS.forEach((value, key) => {
            keys.push({
                key: `${key.substring(0, 8)}...${key.substring(key.length - 4)}`,
                name: value.name,
                permissions: value.permissions,
                created: value.created
            });
        });
        return keys;
    },

    // Get admin key (for initial setup)
    getAdminKey: (): string => ADMIN_KEY
};

// Fastify authentication hook
export const authHook = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
        reply.status(401).send({ success: false, error: 'API key required. Use X-API-Key header.' });
        return;
    }

    const { valid, permissions } = AuthService.validateKey(apiKey);
    
    if (!valid) {
        reply.status(403).send({ success: false, error: 'Invalid API key.' });
        return;
    }

    // Attach permissions to request for downstream use
    (request as any).permissions = permissions;
};

// Check for write permission
export const writeAuthHook = async (request: FastifyRequest, reply: FastifyReply) => {
    await authHook(request, reply);
    
    const permissions = (request as any).permissions;
    if (!permissions?.includes('write') && !permissions?.includes('admin')) {
        reply.status(403).send({ success: false, error: 'Write permission required.' });
        return;
    }
};

// Check for admin permission
export const adminAuthHook = async (request: FastifyRequest, reply: FastifyReply) => {
    await authHook(request, reply);
    
    const permissions = (request as any).permissions;
    if (!permissions?.includes('admin')) {
        reply.status(403).send({ success: false, error: 'Admin permission required.' });
        return;
    }
};

// Simple session-based auth (for dashboard)
const sessions: Map<string, { user: string; created: Date; expires: Date }> = new Map();

export const SessionService = {
    // Create session from password
    login: (password: string): string | null => {
        // Simple password check (use env var in production)
        const validPassword = process.env.DASHBOARD_PASSWORD || 'brain-hijack-2026';
        
        if (password !== validPassword) {
            return null;
        }

        const sessionId = crypto.randomBytes(32).toString('hex');
        sessions.set(sessionId, {
            user: 'dashboard',
            created: new Date(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        return sessionId;
    },

    // Validate session
    validateSession: (sessionId: string): boolean => {
        const session = sessions.get(sessionId);
        if (!session) return false;
        
        if (new Date() > session.expires) {
            sessions.delete(sessionId);
            return false;
        }

        return true;
    },

    // Logout
    logout: (sessionId: string): void => {
        sessions.delete(sessionId);
    }
};
