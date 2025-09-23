# Worker Threads Guide
> Правильная реализация многопоточности в Node.js для QA Sentinel

## 🎯 Цель документа
Обеспечить надежную многопоточную архитектуру без типичных проблем: deadlocks, memory leaks, race conditions и performance bottlenecks.

---

## ⚠️ Критические проблемы Worker Threads

### 1. **Serialization Overhead**

#### ❌ **Проблема: Передача больших объектов**
```javascript
// МЕДЛЕННО: сериализация 10MB данных каждый раз
const bigData = {
  screenshots: new Array(1000).fill(new Uint8Array(10000)),
  metadata: { /* большой объект */ }
};

worker.postMessage({ action: 'process', data: bigData }); // 50-100ms overhead!
```

#### ✅ **Решение: SharedArrayBuffer + MessageChannel**
```javascript
// БЫСТРО: передача только указателей
class SharedDataManager {
  constructor() {
    this.buffers = new Map();
    this.nextId = 0;
  }

  storeData(data) {
    const id = ++this.nextId;

    // Сериализуем в SharedArrayBuffer
    const serialized = this.serialize(data);
    const buffer = new SharedArrayBuffer(serialized.length);
    const view = new Uint8Array(buffer);
    view.set(serialized);

    this.buffers.set(id, buffer);
    return id;
  }

  getData(id) {
    const buffer = this.buffers.get(id);
    if (!buffer) return null;

    const view = new Uint8Array(buffer);
    return this.deserialize(view);
  }

  cleanup(id) {
    this.buffers.delete(id);
  }
}

// В main thread
const sharedData = new SharedDataManager();
const dataId = sharedData.storeData(bigData);

worker.postMessage({
  action: 'process',
  dataId, // Передаем только ID (4 bytes)
  sharedBuffer: sharedData.buffers.get(dataId)
});
```

### 2. **Context Switching Costs**

#### ❌ **Проблема: Частое создание/уничтожение workers**
```javascript
// ДОРОГО: создание worker занимает 50-200ms
async function processTask(task) {
  const worker = new Worker('./scan-worker.js'); // Медленно!

  return new Promise((resolve, reject) => {
    worker.postMessage(task);
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', () => worker.terminate());
  });
}
```

#### ✅ **Решение: Worker Pool с pre-warming**
```javascript
class WorkerPool {
  constructor(workerScript, options = {}) {
    this.workerScript = workerScript;
    this.minWorkers = options.min || 2;
    this.maxWorkers = options.max || require('os').cpus().length;

    this.available = [];
    this.busy = new Set();
    this.pendingTasks = [];
    this.workerIndex = 0;

    // Pre-warm минимальное количество workers
    this.initialize();
  }

  async initialize() {
    const promises = [];
    for (let i = 0; i < this.minWorkers; i++) {
      promises.push(this.createWorker());
    }

    await Promise.all(promises);
    logger.info(`Worker pool initialized with ${this.minWorkers} workers`);
  }

  async createWorker() {
    const workerId = `worker-${++this.workerIndex}`;

    const worker = new Worker(this.workerScript, {
      workerData: { workerId }
    });

    const workerWrapper = {
      id: workerId,
      worker,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      taskCount: 0,
      isAvailable: true
    };

    // Error handling
    worker.on('error', (error) => {
      logger.error(`Worker ${workerId} error:`, error);
      this.handleWorkerError(workerWrapper, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Worker ${workerId} exited with code ${code}`);
      }
      this.removeWorker(workerWrapper);
    });

    this.available.push(workerWrapper);
    return workerWrapper;
  }

  async execute(task, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const taskWrapper = {
        id: `task-${Date.now()}-${Math.random()}`,
        task,
        resolve,
        reject,
        timeout,
        createdAt: Date.now()
      };

      this.pendingTasks.push(taskWrapper);
      this.processPendingTasks();

      // Timeout protection
      setTimeout(() => {
        const index = this.pendingTasks.indexOf(taskWrapper);
        if (index !== -1) {
          this.pendingTasks.splice(index, 1);
          reject(new Error(`Task timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  async processPendingTasks() {
    while (this.pendingTasks.length > 0 && this.available.length > 0) {
      const task = this.pendingTasks.shift();
      const workerWrapper = this.available.shift();

      await this.assignTaskToWorker(task, workerWrapper);
    }

    // Создаем дополнительных workers если нужно
    if (this.pendingTasks.length > 0 && this.busy.size < this.maxWorkers) {
      try {
        const newWorker = await this.createWorker();
        if (this.pendingTasks.length > 0) {
          const task = this.pendingTasks.shift();
          await this.assignTaskToWorker(task, newWorker);
        }
      } catch (error) {
        logger.error('Failed to create additional worker:', error);
      }
    }
  }

  async assignTaskToWorker(taskWrapper, workerWrapper) {
    workerWrapper.isAvailable = false;
    workerWrapper.lastUsed = Date.now();
    workerWrapper.taskCount++;

    this.busy.add(workerWrapper);

    const { worker } = workerWrapper;
    const { task, resolve, reject, id } = taskWrapper;

    // Одноразовые обработчики для этой задачи
    const messageHandler = (result) => {
      if (result.taskId === id) {
        cleanup();
        resolve(result.data);
        this.releaseWorker(workerWrapper);
      }
    };

    const errorHandler = (error) => {
      cleanup();
      reject(error);
      this.handleWorkerError(workerWrapper, error);
    };

    const cleanup = () => {
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
    };

    worker.on('message', messageHandler);
    worker.on('error', errorHandler);

    // Отправляем задачу
    worker.postMessage({
      taskId: id,
      ...task
    });
  }

  releaseWorker(workerWrapper) {
    this.busy.delete(workerWrapper);

    // Проверяем здоровье worker'а
    if (this.isWorkerHealthy(workerWrapper)) {
      workerWrapper.isAvailable = true;
      this.available.push(workerWrapper);

      // Обрабатываем ожидающие задачи
      this.processPendingTasks();
    } else {
      this.removeWorker(workerWrapper);
    }
  }

  isWorkerHealthy(workerWrapper) {
    const age = Date.now() - workerWrapper.createdAt;
    const maxAge = 30 * 60 * 1000; // 30 minutes

    // Restart worker если он слишком старый или обработал много задач
    return age < maxAge && workerWrapper.taskCount < 1000;
  }

  handleWorkerError(workerWrapper, error) {
    logger.error(`Worker ${workerWrapper.id} error:`, error);
    this.removeWorker(workerWrapper);

    // Создаем replacement worker
    if (this.busy.size + this.available.length < this.minWorkers) {
      this.createWorker().catch(err => {
        logger.error('Failed to create replacement worker:', err);
      });
    }
  }

  removeWorker(workerWrapper) {
    this.busy.delete(workerWrapper);

    const index = this.available.indexOf(workerWrapper);
    if (index !== -1) {
      this.available.splice(index, 1);
    }

    try {
      workerWrapper.worker.terminate();
    } catch (error) {
      logger.error(`Error terminating worker ${workerWrapper.id}:`, error);
    }
  }

  getStats() {
    return {
      available: this.available.length,
      busy: this.busy.size,
      pending: this.pendingTasks.length,
      total: this.available.length + this.busy.size
    };
  }

  async destroy() {
    // Ждем завершения текущих задач
    while (this.busy.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Закрываем всех workers
    for (const wrapper of this.available) {
      wrapper.worker.terminate();
    }

    this.available = [];
    this.pendingTasks = [];

    logger.info('Worker pool destroyed');
  }
}
```

### 3. **Race Conditions & Data Corruption**

#### ❌ **Проблема: Shared state без синхронизации**
```javascript
// ОПАСНО: race conditions
let globalCounter = 0;

function processInWorker() {
  // Несколько workers могут читать/записывать одновременно
  globalCounter++; // Race condition!
  return globalCounter;
}
```

#### ✅ **Решение: Atomic operations + Message passing**
```javascript
// БЕЗОПАСНО: атомарные операции
class SafeCounter {
  constructor() {
    // SharedArrayBuffer для атомарных операций
    this.buffer = new SharedArrayBuffer(8);
    this.view = new BigInt64Array(this.buffer);
    this.view[0] = 0n;
  }

  increment() {
    // Атомарная операция
    return Atomics.add(this.view, 0, 1n);
  }

  get value() {
    return Atomics.load(this.view, 0);
  }

  getBuffer() {
    return this.buffer;
  }
}

// В main thread
const counter = new SafeCounter();

// В worker
const { workerData } = require('worker_threads');
const counterView = new BigInt64Array(workerData.counterBuffer);

function processTask() {
  const id = Atomics.add(counterView, 0, 1n); // Атомарно
  return `Task ${id} processed`;
}
```

### 4. **Resource Contention**

#### ❌ **Проблема: Все workers конкурируют за браузеры**
```javascript
// ПРОБЛЕМАТИЧНО: workers блокируют друг друга
class BrowserManager {
  constructor() {
    this.browsers = []; // Shared pool
  }

  async getBrowser() {
    // Все workers ждут один lock
    while (this.browsers.length === 0) {
      await this.sleep(100); // Busy waiting
    }
    return this.browsers.pop();
  }
}
```

#### ✅ **Решение: Per-worker resource allocation**
```javascript
// ПРАВИЛЬНО: каждый worker имеет свои ресурсы
class ResourceManager {
  constructor(workerCount) {
    this.resourcePools = new Map();
    this.initializePools(workerCount);
  }

  initializePools(workerCount) {
    for (let i = 0; i < workerCount; i++) {
      this.resourcePools.set(`worker-${i}`, {
        browsers: [],
        maxBrowsers: 2, // Лимит per worker
        activeConnections: 0
      });
    }
  }

  async acquireResource(workerId, resourceType) {
    const pool = this.resourcePools.get(workerId);
    if (!pool) throw new Error(`Unknown worker: ${workerId}`);

    switch (resourceType) {
      case 'browser':
        return await this.acquireBrowser(pool);
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  async acquireBrowser(pool) {
    if (pool.browsers.length > 0) {
      return pool.browsers.pop();
    }

    if (pool.activeConnections < pool.maxBrowsers) {
      pool.activeConnections++;
      try {
        const browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        return browser;
      } catch (error) {
        pool.activeConnections--;
        throw error;
      }
    }

    throw new Error('Browser pool exhausted for this worker');
  }

  releaseResource(workerId, resourceType, resource) {
    const pool = this.resourcePools.get(workerId);
    if (!pool) return;

    switch (resourceType) {
      case 'browser':
        pool.browsers.push(resource);
        break;
    }
  }
}
```

### 5. **Error Propagation & Isolation**

#### ❌ **Проблема: Ошибки в одном worker влияют на других**
```javascript
// ОПАСНО: необработанные ошибки
process.on('uncaughtException', (error) => {
  console.error(error);
  process.exit(1); // Убивает весь процесс!
});
```

#### ✅ **Решение: Изоляция ошибок + Recovery**
```javascript
// В worker thread
class WorkerErrorHandler {
  constructor(workerId) {
    this.workerId = workerId;
    this.errorCount = 0;
    this.maxErrors = 5;
    this.errorWindow = 60000; // 1 minute
    this.errors = [];

    this.setupErrorHandling();
  }

  setupErrorHandling() {
    // Изоляция uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleError(error, 'uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.handleError(reason, 'unhandledRejection', { promise });
    });
  }

  handleError(error, type, metadata = {}) {
    const errorInfo = {
      timestamp: Date.now(),
      type,
      message: error.message,
      stack: error.stack,
      metadata,
      workerId: this.workerId
    };

    this.errors.push(errorInfo);
    this.errorCount++;

    // Отправляем информацию об ошибке в main thread
    if (parentPort) {
      parentPort.postMessage({
        type: 'error',
        error: errorInfo
      });
    }

    // Проверяем частоту ошибок
    this.checkErrorRate();
  }

  checkErrorRate() {
    const now = Date.now();

    // Удаляем старые ошибки
    this.errors = this.errors.filter(err =>
      now - err.timestamp < this.errorWindow
    );

    // Если слишком много ошибок - graceful shutdown
    if (this.errors.length >= this.maxErrors) {
      logger.error(`Worker ${this.workerId} has too many errors, shutting down`);

      if (parentPort) {
        parentPort.postMessage({
          type: 'shutdown',
          reason: 'too_many_errors',
          errorCount: this.errors.length
        });
      }

      // Graceful exit
      setTimeout(() => process.exit(1), 1000);
    }
  }
}

// В main thread - Error Recovery
class WorkerErrorManager {
  constructor(workerPool) {
    this.workerPool = workerPool;
    this.errorStats = new Map();
  }

  handleWorkerError(workerId, errorInfo) {
    if (!this.errorStats.has(workerId)) {
      this.errorStats.set(workerId, {
        errors: [],
        restarts: 0,
        lastRestart: 0
      });
    }

    const stats = this.errorStats.get(workerId);
    stats.errors.push(errorInfo);

    // Анализируем pattern ошибок
    this.analyzeErrorPattern(workerId, stats);
  }

  analyzeErrorPattern(workerId, stats) {
    const recentErrors = stats.errors.slice(-10);

    // Проверяем на systematic errors
    const errorTypes = recentErrors.map(e => e.type);
    const uniqueTypes = new Set(errorTypes);

    if (uniqueTypes.size === 1 && recentErrors.length >= 3) {
      logger.warn(`Worker ${workerId} has systematic errors of type: ${[...uniqueTypes][0]}`);

      // Restart worker with backoff
      this.restartWorkerWithBackoff(workerId, stats);
    }
  }

  async restartWorkerWithBackoff(workerId, stats) {
    const now = Date.now();
    const timeSinceLastRestart = now - stats.lastRestart;
    const minRestartInterval = Math.min(30000 * Math.pow(2, stats.restarts), 300000); // Max 5 min

    if (timeSinceLastRestart < minRestartInterval) {
      logger.info(`Worker ${workerId} restart delayed for ${minRestartInterval - timeSinceLastRestart}ms`);
      return;
    }

    logger.info(`Restarting worker ${workerId} (restart #${stats.restarts + 1})`);

    stats.restarts++;
    stats.lastRestart = now;

    try {
      await this.workerPool.restartWorker(workerId);
    } catch (error) {
      logger.error(`Failed to restart worker ${workerId}:`, error);
    }
  }
}
```

---

## 📊 Performance Optimization

### **Optimal Worker Count**
```javascript
// Определение оптимального количества workers
class WorkerOptimizer {
  static calculateOptimalWorkerCount(taskType = 'cpu-intensive') {
    const cpuCount = require('os').cpus().length;

    switch (taskType) {
      case 'cpu-intensive':
        // CPU-bound задачи: количество ядер
        return cpuCount;

      case 'io-intensive':
        // I/O-bound задачи: больше workers
        return cpuCount * 2;

      case 'browser-automation':
        // Browser tasks: учитываем память
        const totalMemoryGB = require('os').totalmem() / (1024 ** 3);
        const workersFromMemory = Math.floor(totalMemoryGB / 0.5); // 500MB per worker
        return Math.min(cpuCount * 1.5, workersFromMemory);

      default:
        return cpuCount;
    }
  }

  static async benchmarkWorkerPerformance() {
    const counts = [1, 2, 4, 8, 16];
    const results = [];

    for (const count of counts) {
      const startTime = Date.now();

      // Тестируем с разным количеством workers
      const pool = new WorkerPool('./test-worker.js', {
        min: count,
        max: count
      });

      try {
        // Запускаем 100 задач
        const tasks = Array.from({ length: 100 }, (_, i) =>
          pool.execute({ taskId: i, workload: 'test' })
        );

        await Promise.all(tasks);

        const duration = Date.now() - startTime;
        results.push({ workers: count, duration, throughput: 100 / (duration / 1000) });

      } finally {
        await pool.destroy();
      }
    }

    // Находим оптимальное количество
    const optimal = results.reduce((best, current) =>
      current.throughput > best.throughput ? current : best
    );

    logger.info('Benchmark results:', results);
    logger.info('Optimal configuration:', optimal);

    return optimal.workers;
  }
}
```

### **Task Partitioning Strategy**
```javascript
// Интеллектуальное разделение задач
class TaskPartitioner {
  static partitionScanTasks(sites, workerCount) {
    // Сортируем сайты по сложности
    const sortedSites = sites.sort((a, b) => {
      const complexityA = this.estimateComplexity(a);
      const complexityB = this.estimateComplexity(b);
      return complexityB - complexityA;
    });

    // Балансированное распределение
    const partitions = Array.from({ length: workerCount }, () => []);
    const workloads = new Array(workerCount).fill(0);

    for (const site of sortedSites) {
      // Находим worker с минимальной нагрузкой
      const minIndex = workloads.indexOf(Math.min(...workloads));

      partitions[minIndex].push(site);
      workloads[minIndex] += this.estimateComplexity(site);
    }

    return partitions;
  }

  static estimateComplexity(site) {
    let complexity = 1;

    // Факторы сложности
    if (site.url.includes('spa')) complexity += 2; // SPA сложнее
    if (site.url.includes('ecommerce')) complexity += 1.5; // Много контента
    if (site.previousScanDuration) {
      complexity += site.previousScanDuration / 10000; // Historical data
    }

    return complexity;
  }
}
```

---

## 🛡️ Worker Thread Best Practices

### **Worker Script Template**
```javascript
// scan-worker.js - Правильная структура worker'а
const { parentPort, workerData } = require('worker_threads');
const { chromium } = require('playwright');

class ScanWorker {
  constructor(workerId) {
    this.workerId = workerId;
    this.browserPool = [];
    this.maxBrowsers = 2;
    this.isShuttingDown = false;

    this.errorHandler = new WorkerErrorHandler(workerId);
    this.setupMessageHandling();
  }

  setupMessageHandling() {
    if (!parentPort) return;

    parentPort.on('message', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        this.errorHandler.handleError(error, 'messageHandling', { message });

        parentPort.postMessage({
          type: 'error',
          taskId: message.taskId,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }
    });
  }

  async handleMessage(message) {
    const { type, taskId, ...data } = message;

    switch (type) {
      case 'scan':
        const result = await this.performScan(data);
        parentPort.postMessage({
          type: 'result',
          taskId,
          data: result
        });
        break;

      case 'shutdown':
        await this.gracefulShutdown();
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  async performScan({ url, options = {} }) {
    const browser = await this.acquireBrowser();

    try {
      const page = await browser.newPage();

      // Настройка page
      await page.setViewportSize(options.viewport || { width: 1920, height: 1080 });

      // Навигация с таймаутом
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options.timeout || 30000
      });

      // Выполняем проверки
      const results = await this.runChecks(page, options);

      await page.close();
      return results;

    } finally {
      this.releaseBrowser(browser);
    }
  }

  async runChecks(page, options) {
    const checks = [];

    // Broken images check
    if (options.checkBrokenImages !== false) {
      checks.push(this.checkBrokenImages(page));
    }

    // Performance check
    if (options.checkPerformance) {
      checks.push(this.checkPerformance(page));
    }

    const results = await Promise.allSettled(checks);

    return results.map((result, index) => ({
      check: ['brokenImages', 'performance'][index],
      status: result.status,
      data: result.value,
      error: result.reason
    }));
  }

  async checkBrokenImages(page) {
    return await page.evaluate(() => {
      return Array.from(document.images)
        .filter(img => !img.complete || img.naturalWidth === 0)
        .map(img => ({
          src: img.src,
          alt: img.alt,
          position: {
            x: img.offsetLeft,
            y: img.offsetTop
          }
        }));
    });
  }

  async acquireBrowser() {
    if (this.browserPool.length > 0) {
      return this.browserPool.pop();
    }

    if (this.browserPool.length < this.maxBrowsers) {
      return await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--memory-pressure-off'
        ]
      });
    }

    throw new Error('Browser pool exhausted');
  }

  releaseBrowser(browser) {
    if (this.isShuttingDown) {
      browser.close().catch(() => {});
      return;
    }

    // Проверяем здоровье браузера
    browser.pages().then(pages => {
      if (pages.length <= 1) { // Только about:blank
        this.browserPool.push(browser);
      } else {
        browser.close().catch(() => {});
      }
    }).catch(() => {
      browser.close().catch(() => {});
    });
  }

  async gracefulShutdown() {
    this.isShuttingDown = true;

    // Закрываем все браузеры
    const closeTasks = this.browserPool.map(browser =>
      browser.close().catch(() => {})
    );

    await Promise.allSettled(closeTasks);

    parentPort.postMessage({ type: 'shutdown_complete' });
    process.exit(0);
  }
}

// Инициализация worker'а
const worker = new ScanWorker(workerData.workerId);
```

---

## ✅ Worker Threads Checklist

### **Pre-deployment Checklist**
- [ ] Worker pool size оптимизирован для сервера
- [ ] Error isolation настроен для каждого worker'а
- [ ] Graceful shutdown реализован
- [ ] Resource limits установлены per worker
- [ ] Memory monitoring включен для workers
- [ ] Task timeout настроен
- [ ] Serialization overhead минимизирован
- [ ] Race conditions исключены

### **Code Review Checklist**
- [ ] Нет shared mutable state между workers
- [ ] Все async operations имеют timeout
- [ ] Error handling изолирует failures
- [ ] Resources правильно освобождаются
- [ ] Message passing validated
- [ ] Worker lifecycle managed

### **Monitoring Checklist**
- [ ] Worker pool metrics tracked
- [ ] Error rates per worker monitored
- [ ] Task completion times measured
- [ ] Resource utilization per worker
- [ ] Memory usage per worker tracked

---

## 🚨 Troubleshooting Guide

### **Worker не отвечает**
```bash
# Проверить статус workers
curl http://localhost:3000/health/workers

# Проверить memory usage
ps aux | grep node

# Force restart worker pool
curl -X POST http://localhost:3000/admin/restart-workers
```

### **High error rate**
1. Проверить логи ошибок: `grep "worker.*error" app.log`
2. Анализировать heap dumps workers
3. Проверить resource contention
4. Временно уменьшить worker pool size

### **Performance degradation**
1. Benchmark текущую производительность
2. Профилировать worker threads
3. Оптимизировать task partitioning
4. Увеличить/уменьшить worker count

---

*Документ обновлен: 2024-09-23*
*Критически важно для production deployment*