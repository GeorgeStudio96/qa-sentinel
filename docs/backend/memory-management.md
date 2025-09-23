# Memory Management Guidelines
> Предотвращение утечек памяти в высоконагруженных Node.js приложениях

## 🎯 Цель документа
Исключить memory leaks и обеспечить стабильное потребление памяти при работе с браузерами, изображениями и долгоживущими процессами.

---

## 🚨 Критические источники утечек

### 1. **Browser/Playwright Leaks**

#### ❌ **Типичные ошибки:**
```javascript
// НИКОГДА не делай так:
async function scanWebsite(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  if (someCondition) {
    return; // browser остается открытым!
  }

  await page.goto(url);
  return screenshots; // browser не закрыт!
}
```

#### ✅ **Правильная реализация:**
```javascript
// ВСЕГДА используй try/finally:
async function scanWebsite(url) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    // Настройка page с cleanup
    const cleanup = setupPageListeners(page);

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      return await captureScreenshots(page);
    } finally {
      cleanup(); // Очистка event listeners
    }
  } finally {
    await browser.close(); // ГАРАНТИРОВАННОЕ закрытие
  }
}

function setupPageListeners(page) {
  const consoleHandler = (msg) => logger.info(msg.text());
  const responseHandler = (res) => logger.debug(res.url());

  page.on('console', consoleHandler);
  page.on('response', responseHandler);

  // Возвращаем функцию cleanup
  return () => {
    page.removeListener('console', consoleHandler);
    page.removeListener('response', responseHandler);
  };
}
```

### 2. **Event Listener Leaks**

#### ❌ **Накопление listeners:**
```javascript
// ОПАСНО: listeners накапливаются
class ScanManager {
  setupWorker(worker) {
    worker.on('message', this.handleMessage);
    worker.on('error', this.handleError);
    // listeners никогда не удаляются
  }
}
```

#### ✅ **Управление lifecycle:**
```javascript
// ПРАВИЛЬНО: явное управление listeners
class ScanManager {
  constructor() {
    this.workers = new Map();
    this.cleanupFunctions = new Map();
  }

  setupWorker(workerId, worker) {
    const messageHandler = (msg) => this.handleMessage(workerId, msg);
    const errorHandler = (err) => this.handleError(workerId, err);

    worker.on('message', messageHandler);
    worker.on('error', errorHandler);

    // Сохраняем cleanup функцию
    this.cleanupFunctions.set(workerId, () => {
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
    });

    this.workers.set(workerId, worker);
  }

  removeWorker(workerId) {
    const cleanup = this.cleanupFunctions.get(workerId);
    if (cleanup) {
      cleanup(); // Удаляем listeners
      this.cleanupFunctions.delete(workerId);
    }

    const worker = this.workers.get(workerId);
    if (worker) {
      worker.terminate();
      this.workers.delete(workerId);
    }
  }

  shutdown() {
    // Cleanup всех workers
    for (const [workerId] of this.workers) {
      this.removeWorker(workerId);
    }
  }
}
```

### 3. **Closure Leaks**

#### ❌ **Удержание больших объектов:**
```javascript
// ОПАСНО: bigData никогда не освобождается
function createProcessor(bigData) {
  return {
    process: async (url) => {
      // Весь bigData остается в памяти
      return await doSomething(url, bigData);
    }
  };
}
```

#### ✅ **Извлечение только нужных данных:**
```javascript
// ПРАВИЛЬНО: извлекаем только необходимое
function createProcessor(bigData) {
  // Извлекаем только нужные поля
  const { config, settings } = bigData;
  const processingOptions = bigData.options?.processing;

  // bigData может быть собран GC
  return {
    process: async (url) => {
      return await doSomething(url, { config, settings, processingOptions });
    }
  };
}
```

### 4. **Cache/Map Leaks**

#### ❌ **Бесконечно растущие кеши:**
```javascript
// ОПАСНО: cache растет бесконечно
const cache = new Map();

function getCachedResult(key) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const result = expensiveOperation(key);
  cache.set(key, result); // Никогда не очищается!
  return result;
}
```

#### ✅ **LRU Cache с ограничениями:**
```javascript
// ПРАВИЛЬНО: ограниченный cache с TTL
const LRU = require('lru-cache');

const cache = new LRU({
  max: 1000, // Максимум элементов
  ttl: 1000 * 60 * 30, // 30 минут TTL
  updateAgeOnGet: true,
  dispose: (value, key) => {
    // Cleanup при удалении из cache
    if (value?.cleanup) {
      value.cleanup();
    }
  }
});

function getCachedResult(key) {
  let result = cache.get(key);
  if (!result) {
    result = expensiveOperation(key);
    cache.set(key, result);
  }
  return result;
}
```

---

## 📊 Memory Monitoring

### **Automatic Memory Tracking**
```javascript
// Настройка автоматического мониторинга
class MemoryMonitor {
  constructor(options = {}) {
    this.thresholds = {
      warning: options.warningThreshold || 500 * 1024 * 1024, // 500MB
      critical: options.criticalThreshold || 800 * 1024 * 1024, // 800MB
      restart: options.restartThreshold || 1000 * 1024 * 1024 // 1GB
    };

    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.measurements = [];
    this.isMonitoring = false;
  }

  start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);

    logger.info('Memory monitoring started');
  }

  checkMemory() {
    const usage = process.memoryUsage();
    const timestamp = Date.now();

    this.measurements.push({
      timestamp,
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    });

    // Храним только последние 100 измерений
    if (this.measurements.length > 100) {
      this.measurements.shift();
    }

    // Проверяем пороги
    this.checkThresholds(usage);
  }

  checkThresholds(usage) {
    const { heapUsed } = usage;

    if (heapUsed > this.thresholds.restart) {
      logger.error('CRITICAL: Memory usage exceeded restart threshold', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(this.thresholds.restart / 1024 / 1024) + 'MB'
      });

      // Graceful restart
      this.initiateGracefulRestart();

    } else if (heapUsed > this.thresholds.critical) {
      logger.error('CRITICAL: High memory usage', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB'
      });

      // Принудительная сборка мусора
      this.forceGC();

    } else if (heapUsed > this.thresholds.warning) {
      logger.warn('WARNING: Elevated memory usage', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB'
      });
    }
  }

  forceGC() {
    if (global.gc) {
      logger.info('Forcing garbage collection');
      global.gc();
    } else {
      logger.warn('GC not available, start with --expose-gc flag');
    }
  }

  async initiateGracefulRestart() {
    logger.info('Initiating graceful restart due to memory threshold');

    // Останавливаем прием новых запросов
    await this.stopAcceptingNewRequests();

    // Ждем завершения текущих запросов
    await this.waitForActiveRequests();

    // Выходим с кодом для рестарта
    process.exit(1);
  }

  getMemoryReport() {
    const current = process.memoryUsage();
    const trend = this.calculateTrend();

    return {
      current: {
        rss: Math.round(current.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(current.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(current.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(current.external / 1024 / 1024) + 'MB'
      },
      trend,
      thresholds: {
        warning: Math.round(this.thresholds.warning / 1024 / 1024) + 'MB',
        critical: Math.round(this.thresholds.critical / 1024 / 1024) + 'MB',
        restart: Math.round(this.thresholds.restart / 1024 / 1024) + 'MB'
      }
    };
  }

  calculateTrend() {
    if (this.measurements.length < 10) return 'insufficient_data';

    const recent = this.measurements.slice(-10);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;

    const changePercent = ((last - first) / first) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }
}

// Инициализация мониторинга
const memoryMonitor = new MemoryMonitor({
  warningThreshold: 400 * 1024 * 1024,  // 400MB
  criticalThreshold: 600 * 1024 * 1024, // 600MB
  restartThreshold: 800 * 1024 * 1024   // 800MB
});

memoryMonitor.start();
```

### **Heap Dump для анализа**
```javascript
// Автоматический heap dump при превышении порога
const v8 = require('v8');
const fs = require('fs').promises;
const path = require('path');

class HeapDumpManager {
  constructor() {
    this.dumpDirectory = './heap-dumps';
    this.maxDumps = 5; // Максимум дампов для хранения
  }

  async ensureDumpDirectory() {
    try {
      await fs.mkdir(this.dumpDirectory, { recursive: true });
    } catch (err) {
      logger.error('Failed to create dump directory', err);
    }
  }

  async createHeapDump(reason = 'manual') {
    await this.ensureDumpDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `heap-dump-${reason}-${timestamp}.heapsnapshot`;
    const filepath = path.join(this.dumpDirectory, filename);

    try {
      logger.info(`Creating heap dump: ${filename}`);
      v8.writeHeapSnapshot(filepath);

      // Cleanup старых дампов
      await this.cleanupOldDumps();

      return filepath;
    } catch (err) {
      logger.error('Failed to create heap dump', err);
      throw err;
    }
  }

  async cleanupOldDumps() {
    try {
      const files = await fs.readdir(this.dumpDirectory);
      const dumps = files
        .filter(f => f.endsWith('.heapsnapshot'))
        .map(f => ({
          name: f,
          path: path.join(this.dumpDirectory, f),
          time: fs.stat(path.join(this.dumpDirectory, f)).then(s => s.mtime)
        }));

      if (dumps.length > this.maxDumps) {
        // Сортируем по времени создания
        const sortedDumps = await Promise.all(dumps.map(async d => ({
          ...d,
          time: await d.time
        })));

        sortedDumps.sort((a, b) => b.time - a.time);

        // Удаляем старые дампы
        const toDelete = sortedDumps.slice(this.maxDumps);
        await Promise.all(toDelete.map(d => fs.unlink(d.path)));

        logger.info(`Cleaned up ${toDelete.length} old heap dumps`);
      }
    } catch (err) {
      logger.error('Failed to cleanup old dumps', err);
    }
  }
}
```

---

## 🔧 Resource Pool Management

### **Browser Pool Implementation**
```javascript
// Правильная реализация пула браузеров
class BrowserPool {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 5;
    this.minSize = options.minSize || 1;
    this.maxAge = options.maxAge || 30 * 60 * 1000; // 30 minutes
    this.idleTimeout = options.idleTimeout || 5 * 60 * 1000; // 5 minutes

    this.available = [];
    this.busy = new Set();
    this.creating = 0;
    this.destroyed = false;

    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      errors: 0
    };

    // Инициализация минимального количества браузеров
    this.initialize();

    // Периодическая очистка
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Каждую минуту
  }

  async initialize() {
    for (let i = 0; i < this.minSize; i++) {
      try {
        await this.createBrowser();
      } catch (err) {
        logger.error('Failed to initialize browser pool', err);
      }
    }
  }

  async createBrowser() {
    if (this.destroyed) return null;

    this.creating++;
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const browserWrapper = {
        browser,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        id: `browser-${this.stats.created}`,
        inUse: false
      };

      // Обработка закрытия браузера
      browser.on('disconnected', () => {
        this.handleBrowserDisconnect(browserWrapper);
      });

      this.stats.created++;
      return browserWrapper;
    } finally {
      this.creating--;
    }
  }

  async acquire() {
    if (this.destroyed) {
      throw new Error('Browser pool is destroyed');
    }

    // Проверяем доступные браузеры
    let browserWrapper = this.getAvailableBrowser();

    if (!browserWrapper && this.canCreateNew()) {
      browserWrapper = await this.createBrowser();
    }

    if (!browserWrapper) {
      throw new Error('No browsers available and cannot create new ones');
    }

    // Помечаем как занятый
    browserWrapper.inUse = true;
    browserWrapper.lastUsed = Date.now();
    this.busy.add(browserWrapper);
    this.stats.acquired++;

    return browserWrapper.browser;
  }

  async release(browser) {
    const browserWrapper = this.findBrowserWrapper(browser);
    if (!browserWrapper) {
      logger.warn('Attempted to release unknown browser');
      return;
    }

    browserWrapper.inUse = false;
    browserWrapper.lastUsed = Date.now();
    this.busy.delete(browserWrapper);

    // Проверяем состояние браузера
    if (await this.isBrowserHealthy(browserWrapper)) {
      this.available.push(browserWrapper);
    } else {
      await this.destroyBrowser(browserWrapper);
    }

    this.stats.released++;
  }

  getAvailableBrowser() {
    // Удаляем устаревшие браузеры
    this.available = this.available.filter(wrapper => {
      const age = Date.now() - wrapper.createdAt;
      if (age > this.maxAge) {
        this.destroyBrowser(wrapper);
        return false;
      }
      return true;
    });

    return this.available.shift() || null;
  }

  canCreateNew() {
    const total = this.available.length + this.busy.size + this.creating;
    return total < this.maxSize;
  }

  async isBrowserHealthy(browserWrapper) {
    try {
      // Простая проверка здоровья
      const pages = await browserWrapper.browser.pages();
      return pages.length >= 0; // Браузер отвечает
    } catch (err) {
      return false;
    }
  }

  findBrowserWrapper(browser) {
    for (const wrapper of this.busy) {
      if (wrapper.browser === browser) {
        return wrapper;
      }
    }
    return null;
  }

  async destroyBrowser(browserWrapper) {
    try {
      await browserWrapper.browser.close();
      this.stats.destroyed++;
    } catch (err) {
      logger.error('Error destroying browser', err);
      this.stats.errors++;
    }
  }

  handleBrowserDisconnect(browserWrapper) {
    // Удаляем из всех коллекций
    this.busy.delete(browserWrapper);
    const index = this.available.indexOf(browserWrapper);
    if (index !== -1) {
      this.available.splice(index, 1);
    }

    logger.warn(`Browser disconnected: ${browserWrapper.id}`);
  }

  async cleanup() {
    const now = Date.now();

    // Удаляем idle браузеры
    this.available = this.available.filter(wrapper => {
      const idleTime = now - wrapper.lastUsed;
      if (idleTime > this.idleTimeout && this.available.length > this.minSize) {
        this.destroyBrowser(wrapper);
        return false;
      }
      return true;
    });
  }

  getStats() {
    return {
      ...this.stats,
      available: this.available.length,
      busy: this.busy.size,
      creating: this.creating,
      total: this.available.length + this.busy.size + this.creating
    };
  }

  async destroy() {
    if (this.destroyed) return;

    this.destroyed = true;
    clearInterval(this.cleanupInterval);

    // Закрываем все браузеры
    const allBrowsers = [...this.available, ...this.busy];
    await Promise.all(allBrowsers.map(wrapper => this.destroyBrowser(wrapper)));

    this.available = [];
    this.busy.clear();

    logger.info('Browser pool destroyed');
  }
}

// Использование с автоматическим release
class SafeBrowserManager {
  constructor() {
    this.pool = new BrowserPool();
  }

  async withBrowser(callback) {
    const browser = await this.pool.acquire();
    try {
      return await callback(browser);
    } finally {
      await this.pool.release(browser);
    }
  }

  async destroy() {
    await this.pool.destroy();
  }
}
```

---

## ✅ Memory Safety Checklist

### **Pre-deployment Checklist**
- [ ] Все browser.close() в finally блоках
- [ ] Event listeners имеют cleanup
- [ ] Кеши ограничены по размеру и TTL
- [ ] Worker threads корректно terminate
- [ ] Нет глобальных переменных для хранения state
- [ ] Memory monitoring включен
- [ ] Heap dump настроен для критических случаев
- [ ] Graceful restart при превышении лимитов

### **Code Review Checklist**
- [ ] Нет naked async operations без error handling
- [ ] Closures не удерживают большие объекты
- [ ] Нет infinite loops в async operations
- [ ] Promise chains имеют proper cleanup
- [ ] Stream operations корректно завершаются

### **Monitoring Checklist**
- [ ] Memory usage alerts настроены
- [ ] Heap growth trend отслеживается
- [ ] Browser pool metrics мониторятся
- [ ] Worker thread memory tracked
- [ ] Auto-restart на memory leaks

---

## 🚨 Emergency Procedures

### **При обнаружении memory leak:**

1. **Immediate Response (< 5 min)**
   ```bash
   # Создать heap dump
   kill -USR2 <pid>

   # Проверить memory usage
   ps aux | grep node

   # Graceful restart если критично
   pm2 restart app --time
   ```

2. **Investigation (< 30 min)**
   ```bash
   # Анализ heap dump
   node --inspect-brk memory-analyzer.js heap-dump.heapsnapshot

   # Проверить логи на patterns
   grep -i "memory\|heap\|leak" app.log | tail -100
   ```

3. **Mitigation (< 1 hour)**
   - Temporary memory limit increase
   - Aggressive garbage collection
   - Browser pool size reduction
   - Worker restart frequency increase

---

*Документ обновлен: 2024-09-23*
*Обязательное чтение для всех backend разработчиков*