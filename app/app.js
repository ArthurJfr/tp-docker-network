const express = require('express');
const redis = require('redis');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();

// Métriques Prometheus
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const REQUEST_COUNT = new client.Counter({
  name: 'app_requests_total',
  help: 'Total requests',
  labelNames: ['endpoint', 'method'],
  registers: [register]
});

const REQUEST_LATENCY = new client.Histogram({
  name: 'app_request_latency_seconds',
  help: 'Request latency',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Connexion Redis avec retry
const redisHost = process.env.REDIS_HOST || 'redis';
const redisClient = redis.createClient({
  url: `redis://${redisHost}:6379`,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error('Redis: Too many retries, giving up');
        return new Error('Too many retries');
      }
      const delay = Math.min(retries * 100, 3000);
      console.log(`Redis: Retry ${retries}, waiting ${delay}ms`);
      return delay;
    }
  }
});

let redisConnected = false;

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message || err);
  redisConnected = false;
});

redisClient.on('connect', () => {
  console.log('Redis: Connected');
  redisConnected = true;
});

redisClient.on('ready', () => {
  console.log('Redis: Ready');
  redisConnected = true;
});

redisClient.on('reconnecting', () => {
  console.log('Redis: Reconnecting...');
});

// Tentative de connexion avec retry
async function connectRedis() {
  try {
    console.log(`Redis: Attempting to connect to ${redisHost}:6379`);
    await redisClient.connect();
    redisConnected = true;
    console.log('Redis: Successfully connected');
  } catch (error) {
    console.error('Redis: Initial connection failed, will retry:', error.message || error);
    redisConnected = false;
  }
}

connectRedis();

// Connexion PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  port: 5432
});

app.get('/health', (req, res) => {
  REQUEST_COUNT.inc({ endpoint: '/health', method: 'GET' });
  res.json({ status: 'healthy' });
});

app.get('/api/data', async (req, res) => {
  const startTime = Date.now();
  REQUEST_COUNT.inc({ endpoint: '/api/data', method: 'GET' });
  
  try {
    // Tentative cache Redis (seulement si Redis est connecté)
    if (redisConnected) {
      try {
        const cached = await redisClient.get('data_cache');
        if (cached) {
          const latency = (Date.now() - startTime) / 1000;
          REQUEST_LATENCY.observe({ endpoint: '/api/data' }, latency);
          return res.json({ data: cached, source: 'cache' });
        }
      } catch (redisError) {
        console.warn('Redis cache read failed, falling back to database:', redisError.message);
      }
    }
    
    // Sinon, requête DB
    const result = await pool.query('SELECT NOW()');
    const data = result.rows[0].now.toString();
    
    // Mise en cache (60s) - seulement si Redis est connecté
    if (redisConnected) {
      try {
        await redisClient.setEx('data_cache', 60, data);
      } catch (redisError) {
        console.warn('Redis cache write failed:', redisError.message);
      }
    }
    
    const latency = (Date.now() - startTime) / 1000;
    REQUEST_LATENCY.observe({ endpoint: '/api/data' }, latency);
    res.json({ data, source: 'database' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
