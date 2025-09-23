# Production Deployment Checklist
> Операционные регламенты для безопасного развертывания QA Sentinel в production

## 🎯 Цель документа
Обеспечить безошибочное развертывание с нулевым временем простоя и полной готовностью к production нагрузкам.

---

## 🔐 Pre-Deployment Security

### **Environment Variables Validation**
```bash
#!/bin/bash
# validate-env.sh - Проверка всех критичных переменных

required_vars=(
  "NODE_ENV"
  "DATABASE_URL"
  "REDIS_URL"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
  "MONITORING_API_KEY"
)

critical_vars=(
  "ADMIN_API_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "SLACK_WEBHOOK_URL"
)

echo "🔍 Validating environment variables..."

for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "❌ Required variable $var is not set"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

for var in "${critical_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "⚠️  Critical variable $var is not set (application may work with limited functionality)"
  else
    echo "✅ $var is set"
  fi
done

# Validate secret lengths
if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "❌ JWT_SECRET must be at least 32 characters long"
  exit 1
fi

if [[ ${#ENCRYPTION_KEY} -lt 32 ]]; then
  echo "❌ ENCRYPTION_KEY must be at least 32 characters long"
  exit 1
fi

echo "✅ All environment variables validated"
```

### **Security Configuration Checklist**
- [ ] All secrets rotated before deployment
- [ ] Environment variables validated and secured
- [ ] Database credentials have minimal required permissions
- [ ] API rate limiting configured
- [ ] CORS policies restrictive to required origins
- [ ] Security headers configured (HELMET.js)
- [ ] Input validation enabled for all endpoints
- [ ] SQL injection protection verified
- [ ] Authentication middleware tested
- [ ] Authorization policies reviewed

---

## 🏗️ Infrastructure Preparation

### **Server Configuration Checklist**
- [ ] Node.js 20+ installed
- [ ] npm/yarn latest version
- [ ] PM2 or equivalent process manager configured
- [ ] Firewall rules configured (ports 80, 443, 22 only)
- [ ] SSL certificates installed and validated
- [ ] Log rotation configured
- [ ] Disk space monitoring setup (min 20GB free)
- [ ] Memory monitoring configured
- [ ] Automatic updates configured for security patches

### **Database Setup Checklist**
- [ ] Database server hardened and secured
- [ ] Connection pooling configured
- [ ] Database indexes created for all queries
- [ ] Backup strategy implemented and tested
- [ ] Performance monitoring enabled
- [ ] Query logging configured for slow queries
- [ ] Connection limits set appropriately
- [ ] Database migrations tested in staging

### **Redis Configuration Checklist**
- [ ] Redis secured with authentication
- [ ] Memory limits configured
- [ ] Persistence configured (if needed)
- [ ] Connection pooling setup
- [ ] Redis monitoring enabled
- [ ] Backup strategy for critical cache data

---

## 📦 Application Deployment

### **Pre-Build Validation**
```bash
#!/bin/bash
# pre-deploy-validation.sh

echo "🔍 Running pre-deployment validation..."

# Check Node.js version
node_version=$(node -v | cut -d'v' -f2)
required_version="20.0.0"

if [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]]; then
  echo "❌ Node.js version $node_version is too old. Required: $required_version+"
  exit 1
fi

# Run tests
echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

# Run linting
echo "🔍 Running linter..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"
  exit 1
fi

# Type checking
echo "📝 Running type check..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ Type checking failed"
  exit 1
fi

# Security audit
echo "🔒 Running security audit..."
npm audit --audit-level high
if [ $? -ne 0 ]; then
  echo "⚠️  Security vulnerabilities found. Review before deploying."
fi

# Build application
echo "🏗️ Building application..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Pre-deployment validation passed"
```

### **Build Process Checklist**
- [ ] Dependencies audit passed (no high/critical vulnerabilities)
- [ ] TypeScript compilation successful
- [ ] ESLint checks passed
- [ ] Unit tests passed (coverage > 80%)
- [ ] Integration tests passed
- [ ] Build optimization verified
- [ ] Source maps generated for debugging
- [ ] Bundle size analyzed and optimized

### **Deployment Steps**
```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e  # Exit on any error

echo "🚀 Starting deployment to production..."

# 1. Backup current version
echo "📦 Creating backup..."
cp -r /app/current /app/backup-$(date +%Y%m%d-%H%M%S)

# 2. Deploy new version
echo "📂 Deploying new version..."
rsync -av --delete dist/ /app/staging/

# 3. Install dependencies
echo "📦 Installing dependencies..."
cd /app/staging
npm ci --production

# 4. Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate

# 5. Health check on staging
echo "🏥 Running health check..."
npm run health-check
if [ $? -ne 0 ]; then
  echo "❌ Health check failed"
  exit 1
fi

# 6. Stop current application
echo "⏸️ Stopping current application..."
pm2 stop qa-sentinel

# 7. Switch to new version
echo "🔄 Switching to new version..."
rm -rf /app/current
mv /app/staging /app/current
cd /app/current

# 8. Start application
echo "▶️ Starting application..."
pm2 start ecosystem.config.js

# 9. Wait for startup
echo "⏳ Waiting for application startup..."
sleep 30

# 10. Final health check
echo "🔍 Final health check..."
curl -f http://localhost:3000/health || {
  echo "❌ Application failed to start properly"
  echo "🔄 Rolling back..."
  pm2 stop qa-sentinel
  rm -rf /app/current
  mv /app/backup-$(ls /app/ | grep backup | tail -1) /app/current
  cd /app/current
  pm2 start ecosystem.config.js
  exit 1
}

echo "✅ Deployment successful!"
```

---

## 🔧 Process Manager Configuration

### **PM2 Ecosystem Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'qa-sentinel',
    script: './dist/app.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Memory and CPU limits
    max_memory_restart: '512M',
    min_uptime: '10s',
    max_restarts: 5,

    // Logging
    log_file: '/var/log/qa-sentinel/combined.log',
    out_file: '/var/log/qa-sentinel/out.log',
    error_file: '/var/log/qa-sentinel/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Auto-restart options
    watch: false,
    ignore_watch: ['node_modules', 'logs'],

    // Source map support
    source_map_support: true,

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,

    // Health monitoring
    health_check_grace_period: 3000,

    // Advanced PM2 features
    instance_var: 'INSTANCE_ID',
    combine_logs: true,
    merge_logs: true
  }],

  deploy: {
    production: {
      user: 'deploy',
      host: ['prod-server-1', 'prod-server-2'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/qa-sentinel.git',
      path: '/var/www/qa-sentinel',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
```

---

## 📊 Monitoring & Alerting Setup

### **Health Check Endpoints**
```javascript
// health-check.js
const express = require('express');
const router = express.Router();

// Basic health check
router.get('/health', async (req, res) => {
  const startTime = Date.now();

  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      version: process.env.npm_package_version,

      // Database health
      database: await checkDatabaseHealth(),

      // Redis health
      redis: await checkRedisHealth(),

      // Worker pool health
      workers: await checkWorkerPoolHealth(),

      // External services
      external: await checkExternalServices()
    };

    const responseTime = Date.now() - startTime;
    health.responseTime = responseTime;

    // Determine overall status
    const isHealthy = health.database.status === 'ok' &&
                     health.redis.status === 'ok' &&
                     health.workers.status === 'ok' &&
                     responseTime < 5000; // 5 second threshold

    res.status(isHealthy ? 200 : 503).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed status for monitoring
router.get('/status', async (req, res) => {
  const detailed = {
    application: {
      name: 'qa-sentinel',
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    },

    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch
    },

    metrics: await getApplicationMetrics(),
    dependencies: await checkDependencyVersions()
  };

  res.json(detailed);
});

async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    return {
      status: 'ok',
      responseTime: Date.now() - start,
      connections: db.pool.totalCount,
      idle: db.pool.idleCount
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

async function checkRedisHealth() {
  try {
    const start = Date.now();
    await redis.ping();
    return {
      status: 'ok',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}
```

### **Monitoring Configuration**
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure_password
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  prometheus_data:
  grafana_data:
```

---

## 🚨 Emergency Procedures

### **Incident Response Playbook**

#### **High Memory Usage (> 80%)**
```bash
# 1. Immediate assessment
echo "🔍 Checking memory usage..."
ps aux --sort=-%mem | head -20

# 2. Check application logs
tail -100 /var/log/qa-sentinel/error.log | grep -i "memory\|heap\|oom"

# 3. Force garbage collection
curl -X POST http://localhost:3000/admin/gc

# 4. If critical (> 95%), restart application
if [[ $(free | grep Mem | awk '{print ($3/$2) * 100.0}') > 95 ]]; then
  echo "🚨 Critical memory usage, restarting application..."
  pm2 restart qa-sentinel
fi
```

#### **High Response Time (> 2s)**
```bash
# 1. Check active connections
curl http://localhost:3000/health/performance

# 2. Check database performance
echo "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;" | psql $DATABASE_URL

# 3. Check worker pool status
curl http://localhost:3000/admin/workers/status

# 4. Temporary rate limiting
curl -X POST http://localhost:3000/admin/rate-limit -d '{"limit": 100}'
```

#### **Database Connection Issues**
```bash
# 1. Check database connectivity
pg_isready -h $DB_HOST -p $DB_PORT

# 2. Check connection pool
curl http://localhost:3000/health | jq '.database'

# 3. Reset connection pool
curl -X POST http://localhost:3000/admin/db/reset-pool

# 4. Fallback to read-only mode
curl -X POST http://localhost:3000/admin/maintenance-mode -d '{"readOnly": true}'
```

### **Rollback Procedure**
```bash
#!/bin/bash
# rollback.sh - Emergency rollback script

echo "🚨 Starting emergency rollback..."

# 1. Stop current application
pm2 stop qa-sentinel

# 2. Restore previous version
BACKUP_DIR=$(ls /app/ | grep backup | tail -1)
if [[ -z "$BACKUP_DIR" ]]; then
  echo "❌ No backup found!"
  exit 1
fi

rm -rf /app/current
mv "/app/$BACKUP_DIR" /app/current
cd /app/current

# 3. Rollback database if needed
if [[ "$1" == "--with-db" ]]; then
  echo "🗄️ Rolling back database..."
  npm run migrate:rollback
fi

# 4. Start application
pm2 start ecosystem.config.js

# 5. Verify rollback
sleep 30
curl -f http://localhost:3000/health || {
  echo "❌ Rollback failed!"
  exit 1
}

echo "✅ Rollback completed successfully"
```

---

## ✅ Final Production Checklist

### **🔐 Security Final Check**
- [ ] All secrets properly configured
- [ ] Security headers implemented
- [ ] Rate limiting active
- [ ] Input validation working
- [ ] SQL injection tests passed
- [ ] XSS protection verified
- [ ] Authentication working correctly
- [ ] Authorization policies tested

### **🏗️ Infrastructure Final Check**
- [ ] Load balancer configured
- [ ] SSL certificates valid
- [ ] Database indexes created
- [ ] Backup systems operational
- [ ] Monitoring dashboards active
- [ ] Log aggregation working
- [ ] Alert rules configured
- [ ] Health checks responding

### **📊 Performance Final Check**
- [ ] Load testing completed
- [ ] Memory usage under limits
- [ ] Response times acceptable
- [ ] Database performance optimized
- [ ] Caching strategies active
- [ ] CDN configured (if applicable)
- [ ] Connection pooling optimized

### **🔧 Application Final Check**
- [ ] All features tested in production environment
- [ ] Worker threads functioning
- [ ] Browser pool operational
- [ ] Queue processing working
- [ ] Scheduled jobs configured
- [ ] Error handling tested
- [ ] Logging levels appropriate

### **🚨 Emergency Preparedness**
- [ ] Rollback procedure tested
- [ ] Emergency contacts updated
- [ ] Incident response playbook ready
- [ ] Backup restoration tested
- [ ] Monitoring alerts active
- [ ] On-call schedule defined

---

## 📞 Emergency Contacts

### **Escalation Matrix**
```
Level 1: On-call Engineer
- Response time: 15 minutes
- Scope: Application issues, performance degradation

Level 2: Senior Engineer / Tech Lead
- Response time: 30 minutes
- Scope: System failures, security incidents

Level 3: Engineering Manager / CTO
- Response time: 1 hour
- Scope: Business critical failures, major incidents
```

### **Communication Channels**
- **Slack**: #qa-sentinel-alerts
- **PagerDuty**: qa-sentinel-production
- **Email**: engineering@company.com
- **Emergency Phone**: +1-XXX-XXX-XXXX

---

*Документ обновлен: 2024-09-23*
*Обязательное выполнение всех пунктов перед production deployment*