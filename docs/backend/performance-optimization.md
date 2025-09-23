# Performance Optimization Guide
> Обеспечение высокой производительности для миллионов запросов в день

## 🎯 Цель документа
Достижение целевых KPI: 10,000+ RPS, latency p95 < 200ms, memory < 512MB per worker при минимальных затратах на инфраструктуру.

---

## 📊 Performance Targets

### **Production KPIs**
- **Throughput**: > 10,000 RPS sustained
- **Latency**: p95 < 200ms, p99 < 500ms
- **Memory**: < 512MB per worker process
- **CPU**: < 70% average utilization
- **Availability**: > 99.9% uptime
- **Error rate**: < 0.1%

### **Cost Efficiency**
- **Server utilization**: > 80%
- **Resource per request**: < 1MB memory, < 10ms CPU
- **Infrastructure cost**: < $0.001 per request

---

## ⚡ Fastify Optimization

### **Server Configuration**
```javascript
// High-performance Fastify setup
const fastify = require('fastify')({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.ip,
        userAgent: req.headers['user-agent']
      })
    }
  },
  // Optimize for high throughput
  maxParamLength: 500,
  bodyLimit: 1048576, // 1MB
  keepAliveTimeout: 65000,
  connectionTimeout: 60000,

  // Production optimizations
  trustProxy: true,
  disableRequestLogging: process.env.NODE_ENV === 'production',

  // HTTP/2 support
  http2: true,

  // Request ID for tracing
  genReqId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
});

// Performance plugins
await fastify.register(require('@fastify/compress'), {
  global: true,
  threshold: 1024, // Минимальный размер для сжатия
  encodings: ['gzip', 'deflate', 'br']
});

await fastify.register(require('@fastify/rate-limit'), {
  max: 1000, // Requests per timeWindow
  timeWindow: '1 minute',
  cache: 10000, // Cache size for rate limiting
  allowList: ['127.0.0.1', '10.0.0.0/8'], // Internal networks
  redis: redisClient // Distributed rate limiting
});

// CORS optimization
await fastify.register(require('@fastify/cors'), {
  origin: (origin, callback) => {
    // Быстрая проверка origin без regex
    const allowed = ['localhost', 'yourdomain.com'];
    const isAllowed = !origin || allowed.some(domain => origin.includes(domain));
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
});
```

### **Route Optimization**
```javascript
// High-performance route handlers
const RouteOptimizer = {
  // Pre-compile JSON schemas для validation
  schemas: {
    scanRequest: {
      type: 'object',
      required: ['url', 'siteId'],
      properties: {
        url: { type: 'string', format: 'uri' },
        siteId: { type: 'string', format: 'uuid' },
        options: {
          type: 'object',
          properties: {
            viewport: { type: 'string', enum: ['desktop', 'mobile', 'tablet'] },
            timeout: { type: 'integer', minimum: 1000, maximum: 60000 }
          }
        }
      }
    }
  },

  // Optimized route handler
  async scanHandler(request, reply) {
    const startTime = process.hrtime.bigint();

    try {
      // Fast validation (pre-compiled schema)
      const validationResult = this.validateRequest(request.body);
      if (!validationResult.valid) {
        return reply.code(400).send({ error: validationResult.error });
      }

      // Quick permission check (cache results)
      const hasPermission = await this.checkPermissionCached(request.user.id, request.body.siteId);
      if (!hasPermission) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Dispatch to worker pool
      const result = await workerPool.execute({
        type: 'scan',
        ...request.body
      }, 30000); // 30s timeout

      // Add performance metrics
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // ms

      reply.header('X-Response-Time', `${duration.toFixed(2)}ms`);
      return reply.send({
        success: true,
        scanId: result.scanId,
        estimatedDuration: result.estimatedDuration
      });

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;

      // Fast error handling
      if (error.code === 'WORKER_TIMEOUT') {
        return reply.code(408).send({ error: 'Scan timeout' });
      }

      if (error.code === 'WORKER_BUSY') {
        return reply.code(503).send({
          error: 'Service busy, try again later',
          retryAfter: 30
        });
      }

      request.log.error({ error, duration }, 'Scan request failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  },

  // Cached permission check
  async checkPermissionCached(userId, siteId) {
    const cacheKey = `perm:${userId}:${siteId}`;

    let result = await redis.get(cacheKey);
    if (result !== null) {
      return result === 'true';
    }

    // Fallback to database
    result = await database.checkUserSitePermission(userId, siteId);

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, result.toString());

    return result;
  }
};

// Register optimized routes
fastify.post('/api/scan', {
  schema: {
    body: RouteOptimizer.schemas.scanRequest
  },
  preHandler: [authenticate, authorize],
  handler: RouteOptimizer.scanHandler.bind(RouteOptimizer)
});
```

---

## 🔄 Connection Pooling

### **Database Connection Pool**
```javascript
// Optimized PostgreSQL pool
const { Pool } = require('pg');

const dbPool = new Pool({
  // Connection limits
  max: 20, // Maximum connections
  min: 5,  // Minimum connections

  // Timeouts
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  acquireTimeoutMillis: 60000,

  // Performance optimizations
  allowExitOnIdle: true,

  // Connection string optimizations
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // SSL configuration
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,

  // Performance settings
  application_name: 'qa-sentinel',
  statement_timeout: 30000,
  query_timeout: 30000,

  // Pool events for monitoring
  log: (level, msg, meta) => {
    if (level === 'error') {
      logger.error({ msg, meta }, 'Database pool error');
    }
  }
});

// Pool monitoring
setInterval(() => {
  const stats = {
    totalCount: dbPool.totalCount,
    idleCount: dbPool.idleCount,
    waitingCount: dbPool.waitingCount
  };

  metrics.dbPoolSize.set(stats.totalCount);
  metrics.dbIdleConnections.set(stats.idleCount);
  metrics.dbWaitingConnections.set(stats.waitingCount);

  // Alert if pool is exhausted
  if (stats.waitingCount > 5) {
    logger.warn(stats, 'Database pool under pressure');
  }
}, 10000);

// Optimized query executor
class DatabaseOptimizer {
  static async executeQuery(query, params = []) {
    const startTime = process.hrtime.bigint();
    let client;

    try {
      client = await dbPool.connect();
      const result = await client.query(query, params);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      metrics.dbQueryDuration.observe(duration);

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      metrics.dbQueryErrors.inc();

      logger.error({
        query: query.substring(0, 100),
        params: params.length,
        duration,
        error: error.message
      }, 'Database query failed');

      throw error;

    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Bulk operations для performance
  static async bulkInsert(table, records, chunkSize = 1000) {
    if (!records.length) return;

    const chunks = [];
    for (let i = 0; i < records.length; i += chunkSize) {
      chunks.push(records.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map(chunk => this.insertChunk(table, chunk))
    );

    return results.flat();
  }

  static async insertChunk(table, records) {
    const columns = Object.keys(records[0]);
    const values = records.map((record, index) =>
      `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${values}
      RETURNING id
    `;

    const params = records.flatMap(record => columns.map(col => record[col]));

    return await this.executeQuery(query, params);
  }
}
```

### **Redis Connection Pool**
```javascript
// High-performance Redis setup
const Redis = require('ioredis');

const redisPool = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 }
], {
  // Performance options
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,

  // Connection pool
  lazyConnect: true,
  maxRedirections: 16,

  // Timeouts
  connectTimeout: 10000,
  commandTimeout: 5000,

  // Cluster options
  scaleReads: 'slave',
  readOnly: false,

  redisOptions: {
    // Individual connection options
    connectTimeout: 2000,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    keepAlive: 30000,

    // Serialization optimization
    keyPrefix: 'qa:',
    retryDelayOnFailover: 50
  }
});

// Optimized Redis operations
class RedisOptimizer {
  // Pipelining для batch operations
  static async batchSet(keyValuePairs, ttl = 3600) {
    const pipeline = redisPool.pipeline();

    for (const [key, value] of keyValuePairs) {
      if (ttl > 0) {
        pipeline.setex(key, ttl, JSON.stringify(value));
      } else {
        pipeline.set(key, JSON.stringify(value));
      }
    }

    return await pipeline.exec();
  }

  static async batchGet(keys) {
    const pipeline = redisPool.pipeline();

    keys.forEach(key => {
      pipeline.get(key);
    });

    const results = await pipeline.exec();

    return results.map(([error, result], index) => ({
      key: keys[index],
      value: error ? null : (result ? JSON.parse(result) : null),
      error
    }));
  }

  // Lua scripts для atomic operations
  static async atomicIncrement(key, incrementBy = 1, ttl = 3600) {
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;

    return await redisPool.eval(script, 1, key, ttl);
  }

  // Distributed locking
  static async acquireLock(lockKey, ttl = 30, timeout = 5000) {
    const identifier = `${process.pid}-${Date.now()}-${Math.random()}`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await redisPool.set(lockKey, identifier, 'PX', ttl * 1000, 'NX');

      if (result === 'OK') {
        return {
          identifier,
          release: () => this.releaseLock(lockKey, identifier)
        };
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    throw new Error(`Failed to acquire lock: ${lockKey}`);
  }

  static async releaseLock(lockKey, identifier) {
    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

    return await redisPool.eval(script, 1, lockKey, identifier);
  }
}
```

---

## 🚀 Caching Strategy

### **Multi-level Caching**
```javascript
class MultiLevelCache {
  constructor() {
    // Level 1: In-memory LRU cache (fastest)
    this.l1Cache = new LRU({
      max: 10000,
      ttl: 60000, // 1 minute
      updateAgeOnGet: true
    });

    // Level 2: Redis cluster (fast, shared)
    this.l2Cache = redisPool;

    // Level 3: Database (slowest, authoritative)
    this.l3Cache = dbPool;

    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0
    };
  }

  async get(key, options = {}) {
    const startTime = process.hrtime.bigint();

    try {
      // Level 1: Memory cache
      let value = this.l1Cache.get(key);
      if (value !== undefined) {
        this.stats.l1Hits++;
        return this.deserialize(value);
      }

      // Level 2: Redis cache
      value = await this.l2Cache.get(key);
      if (value !== null) {
        this.stats.l2Hits++;
        const deserialized = this.deserialize(value);

        // Populate L1 cache
        this.l1Cache.set(key, value);

        return deserialized;
      }

      // Level 3: Database или compute
      if (options.computeFunction) {
        value = await options.computeFunction();
        this.stats.l3Hits++;

        // Populate all cache levels
        const serialized = this.serialize(value);

        this.l1Cache.set(key, serialized);

        if (options.ttl) {
          await this.l2Cache.setex(key, options.ttl, serialized);
        }

        return value;
      }

      this.stats.misses++;
      return null;

    } finally {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      metrics.cacheGetDuration.observe(duration);
    }
  }

  async set(key, value, ttl = 3600) {
    const serialized = this.serialize(value);

    // Set in all cache levels
    this.l1Cache.set(key, serialized);

    if (ttl > 0) {
      await this.l2Cache.setex(key, ttl, serialized);
    } else {
      await this.l2Cache.set(key, serialized);
    }
  }

  async delete(key) {
    // Remove from all levels
    this.l1Cache.delete(key);
    await this.l2Cache.del(key);
  }

  serialize(value) {
    return JSON.stringify(value);
  }

  deserialize(value) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  getStats() {
    const total = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits + this.stats.misses;

    return {
      ...this.stats,
      total,
      hitRate: total > 0 ? (this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits) / total : 0,
      l1HitRate: total > 0 ? this.stats.l1Hits / total : 0,
      l2HitRate: total > 0 ? this.stats.l2Hits / total : 0
    };
  }
}

// Application-specific caching
class ScanResultCache {
  constructor() {
    this.cache = new MultiLevelCache();
  }

  async getScanResult(siteId, scanOptions) {
    const cacheKey = this.generateCacheKey(siteId, scanOptions);

    return await this.cache.get(cacheKey, {
      computeFunction: () => this.performActualScan(siteId, scanOptions),
      ttl: this.calculateTTL(scanOptions)
    });
  }

  generateCacheKey(siteId, options) {
    const optionsHash = crypto
      .createHash('md5')
      .update(JSON.stringify(options))
      .digest('hex')
      .substring(0, 8);

    return `scan:${siteId}:${optionsHash}`;
  }

  calculateTTL(options) {
    // Динамический TTL based на тип проверки
    if (options.checkType === 'visual-regression') {
      return 3600; // 1 hour для visual regression
    }

    if (options.checkType === 'broken-links') {
      return 1800; // 30 minutes для broken links
    }

    return 600; // 10 minutes по умолчанию
  }

  async invalidateSiteCache(siteId) {
    // Invalidate всех связанных cache entries
    const pattern = `scan:${siteId}:*`;
    const keys = await redisPool.keys(pattern);

    if (keys.length > 0) {
      await redisPool.del(...keys);
    }
  }
}
```

---

## 📈 Load Balancing & Circuit Breaker

### **Circuit Breaker Pattern**
```javascript
class CircuitBreaker {
  constructor(service, options = {}) {
    this.service = service;
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      timeout: options.timeout || 60000,
      resetTimeout: options.resetTimeout || 30000,
      ...options
    };

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;

    this.stats = {
      requests: 0,
      successes: 0,
      failures: 0,
      rejections: 0
    };
  }

  async execute(operation, ...args) {
    this.stats.requests++;

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        this.stats.rejections++;
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await Promise.race([
        operation.apply(this.service, args),
        this.timeoutPromise()
      ]);

      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.stats.successes++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // 3 successful calls to close
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.stats.failures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  timeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });
  }

  getStats() {
    return {
      ...this.stats,
      state: this.state,
      failureCount: this.failureCount,
      successRate: this.stats.requests > 0 ? this.stats.successes / this.stats.requests : 0
    };
  }
}

// Usage with external services
const browserServiceBreaker = new CircuitBreaker(browserService, {
  failureThreshold: 3,
  timeout: 30000,
  resetTimeout: 60000
});

const databaseBreaker = new CircuitBreaker(databaseService, {
  failureThreshold: 5,
  timeout: 5000,
  resetTimeout: 30000
});
```

### **Load Balancer для Worker Pool**
```javascript
class WorkerLoadBalancer {
  constructor(workers) {
    this.workers = workers;
    this.algorithm = 'least-connections'; // round-robin, least-connections, weighted
    this.currentIndex = 0;

    this.workerStats = new Map();
    workers.forEach(worker => {
      this.workerStats.set(worker.id, {
        activeConnections: 0,
        totalRequests: 0,
        errors: 0,
        avgResponseTime: 0,
        weight: 1.0
      });
    });
  }

  selectWorker() {
    switch (this.algorithm) {
      case 'round-robin':
        return this.roundRobin();

      case 'least-connections':
        return this.leastConnections();

      case 'weighted-response-time':
        return this.weightedResponseTime();

      default:
        return this.roundRobin();
    }
  }

  roundRobin() {
    const worker = this.workers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.workers.length;
    return worker;
  }

  leastConnections() {
    let selectedWorker = this.workers[0];
    let minConnections = this.workerStats.get(selectedWorker.id).activeConnections;

    for (const worker of this.workers) {
      const stats = this.workerStats.get(worker.id);
      if (stats.activeConnections < minConnections) {
        minConnections = stats.activeConnections;
        selectedWorker = worker;
      }
    }

    return selectedWorker;
  }

  weightedResponseTime() {
    // Выбираем worker с лучшим временем ответа
    let selectedWorker = this.workers[0];
    let bestScore = this.calculateWorkerScore(selectedWorker);

    for (const worker of this.workers) {
      const score = this.calculateWorkerScore(worker);
      if (score > bestScore) {
        bestScore = score;
        selectedWorker = worker;
      }
    }

    return selectedWorker;
  }

  calculateWorkerScore(worker) {
    const stats = this.workerStats.get(worker.id);

    // Higher score = better worker
    const connectionLoad = 1 - (stats.activeConnections / 10); // Assume max 10 connections
    const responseTimeScore = 1 / (stats.avgResponseTime + 1);
    const errorRate = 1 - (stats.errors / (stats.totalRequests + 1));

    return (connectionLoad * 0.4) + (responseTimeScore * 0.4) + (errorRate * 0.2);
  }

  async executeWithLoadBalancing(task) {
    const worker = this.selectWorker();
    const stats = this.workerStats.get(worker.id);

    stats.activeConnections++;
    stats.totalRequests++;

    const startTime = Date.now();

    try {
      const result = await worker.execute(task);

      // Update stats
      const responseTime = Date.now() - startTime;
      stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;

      return result;

    } catch (error) {
      stats.errors++;
      throw error;

    } finally {
      stats.activeConnections--;
    }
  }

  getWorkerStats() {
    const stats = {};
    for (const [workerId, workerStats] of this.workerStats) {
      stats[workerId] = { ...workerStats };
    }
    return stats;
  }

  // Adaptive load balancing
  adjustWeights() {
    for (const [workerId, stats] of this.workerStats) {
      // Adjust weight based на performance
      const errorRate = stats.errors / (stats.totalRequests || 1);
      const avgResponseTime = stats.avgResponseTime;

      if (errorRate > 0.1 || avgResponseTime > 1000) {
        stats.weight = Math.max(0.1, stats.weight * 0.9); // Reduce weight
      } else {
        stats.weight = Math.min(2.0, stats.weight * 1.1); // Increase weight
      }
    }
  }
}
```

---

## 📊 Performance Monitoring

### **Real-time Metrics**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: new Counter('http_requests_total', ['method', 'status']),
      duration: new Histogram('http_duration_seconds', ['route']),
      activeConnections: new Gauge('active_connections'),
      memoryUsage: new Gauge('memory_usage_bytes', ['type']),
      cpuUsage: new Gauge('cpu_usage_percent'),

      // Business metrics
      scansCompleted: new Counter('scans_completed_total', ['status']),
      scanDuration: new Histogram('scan_duration_seconds', ['type']),
      workerPoolSize: new Gauge('worker_pool_size', ['status'])
    };

    this.startCollecting();
  }

  startCollecting() {
    // System metrics collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5000);

    // Business metrics collection
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 10000);
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();

    this.metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.metrics.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    this.metrics.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    this.metrics.memoryUsage.set({ type: 'external' }, memUsage.external);

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.metrics.cpuUsage.set(cpuPercent);
  }

  collectBusinessMetrics() {
    // Worker pool metrics
    if (global.workerPool) {
      const stats = global.workerPool.getStats();
      this.metrics.workerPoolSize.set({ status: 'available' }, stats.available);
      this.metrics.workerPoolSize.set({ status: 'busy' }, stats.busy);
      this.metrics.workerPoolSize.set({ status: 'pending' }, stats.pending);
    }

    // Cache metrics
    if (global.cache) {
      const cacheStats = global.cache.getStats();
      this.metrics.cacheHitRate = cacheStats.hitRate;
    }
  }

  // Request middleware для automatic metrics
  requestMetrics() {
    return (request, reply, done) => {
      const startTime = Date.now();

      reply.addHook('onSend', () => {
        const duration = (Date.now() - startTime) / 1000;

        this.metrics.requests.inc({
          method: request.method,
          status: reply.statusCode
        });

        this.metrics.duration.observe(
          { route: request.routerPath || 'unknown' },
          duration
        );
      });

      done();
    };
  }

  // Performance alerts
  checkThresholds() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    if (heapUsedMB > 400) { // 400MB threshold
      logger.warn({
        heapUsed: heapUsedMB,
        threshold: 400
      }, 'High memory usage detected');
    }

    // Response time alerts
    const avgResponseTime = this.getAverageResponseTime();
    if (avgResponseTime > 500) { // 500ms threshold
      logger.warn({
        avgResponseTime,
        threshold: 500
      }, 'High response time detected');
    }
  }

  getAverageResponseTime() {
    // Calculate from histogram
    return this.metrics.duration._sum / this.metrics.duration._count || 0;
  }
}

// Health check endpoint
fastify.get('/health/performance', async (request, reply) => {
  const healthData = {
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),

    // Business health
    database: await checkDatabaseHealth(),
    redis: await checkRedisHealth(),
    workerPool: global.workerPool ? global.workerPool.getStats() : null,

    // Performance indicators
    avgResponseTime: performanceMonitor.getAverageResponseTime(),
    requestRate: await getRequestRate(), // Requests per second
    errorRate: await getErrorRate()
  };

  const isHealthy = (
    healthData.memory.heapUsed < 500 * 1024 * 1024 && // < 500MB
    healthData.avgResponseTime < 1000 && // < 1s
    healthData.errorRate < 0.05 && // < 5%
    healthData.database.status === 'ok' &&
    healthData.redis.status === 'ok'
  );

  reply.code(isHealthy ? 200 : 503);
  return {
    status: isHealthy ? 'ok' : 'degraded',
    ...healthData
  };
});
```

---

## ⚡ Optimization Checklist

### **Code Level Optimizations**
- [ ] JSON.stringify/parse optimized для hot paths
- [ ] RegExp compiled outside loops
- [ ] String concatenation использует template literals
- [ ] Array operations prefer for-loops над forEach для performance
- [ ] Object property access cached в variables
- [ ] Async/await без unnecessary Promise wrapping

### **Database Optimizations**
- [ ] Connection pooling настроен properly
- [ ] Indexes созданы для всех frequent queries
- [ ] Query планы analyzed и optimized
- [ ] Bulk operations используются для batch inserts
- [ ] Database connection limits не превышены

### **Network Optimizations**
- [ ] HTTP/2 enabled
- [ ] Compression enabled для responses
- [ ] Keep-alive connections используются
- [ ] Connection timeout настроены appropriately
- [ ] DNS caching configured

### **Memory Optimizations**
- [ ] Memory leaks проверены и устранены
- [ ] Object pooling для frequently created objects
- [ ] Garbage collection tuned если needed
- [ ] Buffer reuse для stream operations

---

*Документ обновлен: 2024-09-23*
*Обязательное следование для production deployment*