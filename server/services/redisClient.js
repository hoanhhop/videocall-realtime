// redisClient.js - Production Redis Client for Video Call Translation

const redis = require('redis');

// Cấu hình Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

// Tạo Redis client với cấu hình production
const redisClient = redis.createClient({
    url: REDIS_URL,
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        reconnectStrategy: (retries) => {
            console.log(`Redis reconnect attempt ${retries}`);
            return Math.min(retries * 50, 500);
        }
    },
    password: REDIS_PASSWORD,
    database: 0,
    retry_unfulfilled_commands: true,
    enable_offline_queue: false
});

// Event handlers cho Redis client
redisClient.on('connect', () => {
    console.log('✅ Redis client connected successfully');
});

redisClient.on('ready', () => {
    console.log('✅ Redis client ready for commands');
});

redisClient.on('error', (err) => {
    console.error('❌ Redis client error:', err);
});

redisClient.on('end', () => {
    console.log('🔌 Redis client connection ended');
});

redisClient.on('reconnecting', () => {
    console.log('🔄 Redis client reconnecting...');
});

// Khởi tạo kết nối Redis
const initializeRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('🚀 Redis client initialized successfully');
        }
        return redisClient;
    } catch (error) {
        console.error('💥 Failed to initialize Redis client:', error);
        throw error;
    }
};

// Graceful shutdown
const shutdownRedis = async () => {
    try {
        if (redisClient.isOpen) {
            await redisClient.disconnect();
            console.log('👋 Redis client disconnected gracefully');
        }
    } catch (error) {
        console.error('❌ Error during Redis shutdown:', error);
    }
};

// Helper functions for common operations
const redisHelpers = {
    // Set key-value với TTL (time to live)
    setex: async (key, value, ttl = 3600) => {
        try {
            return await redisClient.setEx(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error(`Redis SETEX error for key ${key}:`, error);
            throw error;
        }
    },

    // Get value by key
    get: async (key) => {
        try {
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Redis GET error for key ${key}:`, error);
            return null;
        }
    },

    // Delete key
    del: async (key) => {
        try {
            return await redisClient.del(key);
        } catch (error) {
            console.error(`Redis DEL error for key ${key}:`, error);
            throw error;
        }
    },

    // Check if key exists
    exists: async (key) => {
        try {
            return await redisClient.exists(key);
        } catch (error) {
            console.error(`Redis EXISTS error for key ${key}:`, error);
            return false;
        }
    },

    // Set TTL for existing key
    expire: async (key, ttl) => {
        try {
            return await redisClient.expire(key, ttl);
        } catch (error) {
            console.error(`Redis EXPIRE error for key ${key}:`, error);
            throw error;
        }
    },

    // List operations
    lpush: async (key, ...values) => {
        try {
            return await redisClient.lPush(key, values.map(v => JSON.stringify(v)));
        } catch (error) {
            console.error(`Redis LPUSH error for key ${key}:`, error);
            throw error;
        }
    },

    rpop: async (key) => {
        try {
            const value = await redisClient.rPop(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Redis RPOP error for key ${key}:`, error);
            return null;
        }
    },

    // Hash operations
    hset: async (key, field, value) => {
        try {
            return await redisClient.hSet(key, field, JSON.stringify(value));
        } catch (error) {
            console.error(`Redis HSET error for key ${key}:`, error);
            throw error;
        }
    },

    hget: async (key, field) => {
        try {
            const value = await redisClient.hGet(key, field);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Redis HGET error for key ${key}:`, error);
            return null;
        }
    },

    // Pub/Sub operations
    publish: async (channel, message) => {
        try {
            return await redisClient.publish(channel, JSON.stringify(message));
        } catch (error) {
            console.error(`Redis PUBLISH error for channel ${channel}:`, error);
            throw error;
        }
    }
};

// Export Redis client và helper functions
module.exports = {
    redisClient,
    initializeRedis,
    shutdownRedis,
    ...redisHelpers
};
