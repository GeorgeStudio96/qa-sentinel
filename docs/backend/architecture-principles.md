# Backend Architecture Principles
> CTO-level guidelines для высоконагруженных Node.js проектов

## 🎯 Цель документа
Обеспечить создание масштабируемого, надежного backend'а способного обрабатывать миллионы запросов в день с минимальными затратами на поддержку.

---

## 📋 Основные принципы

### 1. **Fail Fast, Fail Safe**
- Обнаруживай проблемы на раннем этапе
- Изолируй сбои, не дай им распространиться
- Всегда имей план восстановления

```javascript
// ✅ DO: Валидация входных данных
function processScanRequest(data) {
  if (!data?.siteId || !data?.url) {
    throw new ValidationError('Missing required fields');
  }
  // Продолжаем только с валидными данными
}

// ❌ DON'T: Обработка невалидных данных
function processScanRequest(data) {
  const siteId = data.siteId || 'default'; // Скрытые баги
}
```

### 2. **Separation of Concerns**
- Каждый модуль имеет одну ответственность
- Четкие границы между слоями
- Минимальные зависимости между компонентами

```javascript
// ✅ DO: Разделенная архитектура
class ScanService {
  async scan(url) { /* только логика сканирования */ }
}

class ScanController {
  async handleScanRequest(req, res) { /* только HTTP логика */ }
}

// ❌ DON'T: Смешанные ответственности
class ScanHandler {
  async handleScan(req, res) {
    // HTTP логика + бизнес логика + сохранение в БД
  }
}
```

### 3. **Resource Lifecycle Management**
- Явное управление ресурсами
- Гарантированное освобождение
- Мониторинг использования ресурсов

```javascript
// ✅ DO: RAII паттерн
class BrowserManager {
  async withBrowser(callback) {
    const browser = await this.acquire();
    try {
      return await callback(browser);
    } finally {
      await this.release(browser);
    }
  }
}
```

---

## 🏗️ Архитектурные слои

### **Presentation Layer** (HTTP/API)
```
┌─────────────────────────┐
│   HTTP Controllers      │  ← Только HTTP логика
├─────────────────────────┤
│   Request Validation    │  ← Валидация входных данных
├─────────────────────────┤
│   Response Formatting   │  ← Форматирование ответов
└─────────────────────────┘
```

### **Business Logic Layer**
```
┌─────────────────────────┐
│    Domain Services      │  ← Бизнес логика
├─────────────────────────┤
│    Use Cases           │  ← Сценарии использования
├─────────────────────────┤
│    Domain Models       │  ← Модели предметной области
└─────────────────────────┘
```

### **Infrastructure Layer**
```
┌─────────────────────────┐
│    Database Access     │  ← Работа с БД
├─────────────────────────┤
│    External APIs       │  ← Внешние интеграции
├─────────────────────────┤
│    File System         │  ← Файловые операции
└─────────────────────────┘
```

---

## ⚡ Performance Guidelines

### **Database Access**
```javascript
// ✅ DO: Connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ✅ DO: Query optimization
const result = await db.query(
  'SELECT id, url FROM sites WHERE status = $1 LIMIT $2',
  ['active', 100]
);

// ❌ DON'T: N+1 queries
for (const site of sites) {
  const scans = await db.query('SELECT * FROM scans WHERE site_id = $1', [site.id]);
}
```

### **Memory Management**
```javascript
// ✅ DO: Explicit cleanup
class ScanWorker {
  constructor() {
    this.activeScans = new Map();
  }

  async processScan(scanId) {
    try {
      // Process scan
    } finally {
      this.activeScans.delete(scanId); // Explicit cleanup
    }
  }
}
```

### **Error Handling**
```javascript
// ✅ DO: Structured error handling
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

// Centralized error handler
function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  } else {
    // Log and return generic error
    logger.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## 📊 Monitoring & Observability

### **Health Checks**
```javascript
// ✅ Обязательные health checks
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dependencies: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      browser: await checkBrowserPool()
    }
  };

  res.json(health);
});
```

### **Metrics Collection**
```javascript
// ✅ Business metrics
const metrics = {
  scansCompleted: new Counter('scans_completed_total'),
  scanDuration: new Histogram('scan_duration_seconds'),
  activeWorkers: new Gauge('active_workers'),
  memoryUsage: new Gauge('memory_usage_bytes')
};

// Collect metrics in business logic
async function completeScan(scanId) {
  const startTime = Date.now();
  try {
    // Scan logic
    metrics.scansCompleted.inc();
  } finally {
    metrics.scanDuration.observe((Date.now() - startTime) / 1000);
  }
}
```

---

## 🔒 Security Guidelines

### **Input Validation**
```javascript
// ✅ DO: Strict validation
const Joi = require('joi');

const scanRequestSchema = Joi.object({
  url: Joi.string().uri().required(),
  siteId: Joi.string().uuid().required(),
  options: Joi.object({
    viewport: Joi.string().valid('desktop', 'mobile', 'tablet')
  })
});

// ❌ DON'T: Trust user input
app.post('/scan', (req, res) => {
  const url = req.body.url; // Direct usage without validation
});
```

### **Rate Limiting**
```javascript
// ✅ DO: Implement rate limiting
const rateLimit = require('express-rate-limit');

const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many scan requests, please try again later'
});

app.use('/api/scan', scanLimiter);
```

---

## 📝 Code Quality Standards

### **Naming Conventions**
```javascript
// ✅ DO: Descriptive names
class BrowserPoolManager {
  async acquireAvailableBrowser() { }
  async releaseBrowserToPool(browser) { }
  async terminateIdleBrowsers() { }
}

// ❌ DON'T: Unclear names
class BM {
  async get() { }
  async put(b) { }
  async clean() { }
}
```

### **Function Design**
```javascript
// ✅ DO: Single responsibility, predictable
async function validateScanRequest(request) {
  // Only validation logic
  if (!request.url) throw new ValidationError('URL required');
  if (!isValidUrl(request.url)) throw new ValidationError('Invalid URL');
  return true;
}

// ❌ DON'T: Multiple responsibilities
async function processRequest(request) {
  // Validation + processing + logging + side effects
}
```

---

## ⚠️ Critical Don'ts

### ❌ **NEVER do these:**

1. **Блокирующие операции в main thread**
   ```javascript
   // ❌ NEVER
   const data = fs.readFileSync('huge-file.txt');

   // ✅ ALWAYS
   const data = await fs.promises.readFile('huge-file.txt');
   ```

2. **Ignore error handling**
   ```javascript
   // ❌ NEVER
   doSomethingAsync().catch(() => {}); // Silent fails

   // ✅ ALWAYS
   doSomethingAsync().catch(err => logger.error(err));
   ```

3. **Memory leaks через closures**
   ```javascript
   // ❌ NEVER
   function createHandler(bigData) {
     return async (req, res) => {
       // bigData никогда не освободится
     };
   }
   ```

4. **Shared mutable state между workers**
   ```javascript
   // ❌ NEVER
   const globalCache = new Map(); // Shared between workers
   ```

---

## 🎯 Success Metrics

### **Performance KPIs**
- Response time p95 < 200ms
- Throughput > 10,000 RPS
- Memory usage < 512MB per worker
- CPU utilization < 70%

### **Reliability KPIs**
- Uptime > 99.9%
- Error rate < 0.1%
- MTTR < 5 minutes
- Zero data loss events

### **Operational KPIs**
- Deploy frequency > 10/day
- Lead time < 2 hours
- Change failure rate < 5%

---

## 📚 Required Reading
1. [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
2. [Fastify Performance Guide](https://www.fastify.io/docs/latest/Guides/Getting-Started/)
3. [Worker Threads Guide](https://nodejs.org/api/worker_threads.html)
4. [Memory Management in Node.js](https://blog.appsignal.com/2020/10/28/nodejs-memory-management.html)

---

*Документ обновлен: 2024-09-23*
*Следующий review: каждые 3 месяца*