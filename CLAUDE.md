# AI QA Sentinel - Claude Project Memory

## 🎯 Project Overview

**AI QA Sentinel** - автономный AI QA инженер для автоматического тестирования Webflow и Next.js сайтов.

### Key Value Proposition
- Автоматическое обнаружение UI багов, broken links, performance issues
- Интеграция с Slack, ClickUp для баг-репортов
- Встроенный dashboard в Webflow Cloud для простых пользователей
- Масштабирование до тысяч сайтов одновременно

## 📋 Technical Specification

**Original TZ Location:** `/Users/georgeershov/Desktop/ai-assis/AI_QA_Sentinel_Prompt.md`

### Tech Stack (Final Decision)
- **Backend:** Node.js + Fastify (high-performance, 10k+ RPS)
- **Frontend:** Next.js 15 (minimal dashboard + Webflow Cloud widget)
- **Database:** Supabase (PostgreSQL + Storage + Auth)
- **Browser Automation:** Playwright
- **Deployment:** Vercel (frontend) + dedicated backend servers
- **AI/ML:** OpenAI API для анализа багов

### Architecture Priorities
1. **Backend = 80-90% complexity** (browser pool, AI engine, scheduling)
2. **Frontend = 10-20% complexity** (dashboard + Webflow widget)

## 📚 Key Documentation

### Backend Guidelines (CTO-level)
**Location:** `docs/backend/`
- `architecture-principles.md` - ОБЯЗАТЕЛЬНО к прочтению
- `memory-management.md` - предотвращение memory leaks в Playwright
- `worker-threads-guide.md` - безопасная многопоточность
- `performance-optimization.md` - оптимизация для высоких нагрузок
- `browser-pool-management.md` - управление браузерами
- `deployment-checklist.md` - production deployment процедуры

### Project Management
**Location:** `docs/project-management/`
- `tasks-overview.md` - все задачи проекта
- `current-sprint.md` - текущие задачи в разработке
- `backlog.md` - запланированные задачи
- `completed.md` - выполненные задачи
- `paused.md` - задачи на паузе

## 🔧 Development Standards

### Code Style
- **TypeScript strict mode** - обязательно
- **ESLint + Prettier** - автоформатирование
- **2-space indentation** для всех файлов
- **Functional programming** предпочтительно где возможно

### Memory Management (КРИТИЧНО)
```javascript
// ✅ ВСЕГДА используй try/finally для browser cleanup
async function scanWebsite(url) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    return await captureScreenshot(page);
  } finally {
    await browser.close(); // ОБЯЗАТЕЛЬНО
  }
}
```

### Error Handling
- **Fail Fast** подход
- Структурированное логирование (JSON format)
- Graceful degradation для non-critical features
- Circuit breaker для external APIs

### Testing
- Unit tests для business logic
- Integration tests для browser automation
- Load testing для performance validation
- **Минимум 80% code coverage**

## 🚀 Development Workflow

### Task Management Rules
1. **Micro-tasks only** - максимум 1-4 часа на задачу
2. **Always update task status** после каждого завершения
3. **Document dependencies** между задачами
4. **Small incremental commits** с понятными сообщениями

### Deployment Process
1. **Pre-deploy validation:** tests, linting, type-check
2. **Staging deployment** с health checks
3. **Production deployment** только после full testing
4. **Rollback strategy** всегда готова

## 📊 Critical Metrics

### Performance Targets
- Response time p95 < 200ms
- Memory usage < 512MB per worker
- Error rate < 0.1%
- Browser pool utilization < 80%
- Uptime > 99.9%

### Monitoring Commands
```bash
# Memory analysis
npm run memory:analyze

# Performance profiling
npm run perf:profile

# Health check
curl http://localhost:3000/health

# Force restart
pm2 restart qa-sentinel
```

## 🔥 Current Development Phase

**Phase:** Foundation + Documentation ✅ **COMPLETED**
**Focus:** Backend architecture и task management setup

### ✅ Completed Foundation Tasks
1. ✅ Complete project management structure
2. ✅ Decompose project into micro-tasks
3. ✅ Create comprehensive backend documentation (5,068 lines)
4. ✅ Set up CLAUDE.md and task tracking system

### ✅ Completed Backend Core Engine
1. ✅ **Browser Pool Manager Implementation** - Full lifecycle management (590+ lines)
2. ✅ **Page Manager Implementation** - Testing functions integration (420+ lines)
3. ✅ **Memory Monitor Implementation** - Automatic heap snapshots (380+ lines)
4. ✅ **QA Scanning Engine** - Central coordinator (360+ lines)
5. ✅ **TypeScript Integration** - All compilation errors fixed
6. ✅ **Test Script** - Working demonstration ready

### 🔥 CRITICAL Next Phase: Webflow OAuth Integration
1. 🎯 **Priority 1:** Webflow App Registration & OAuth Setup (Epic 9.1)
2. 🎯 **Priority 2:** Database Schema for Webflow Connections (Epic 9.2)
3. 🎯 **Priority 3:** OAuth Frontend Integration (Epic 9.3)

**BUSINESS IMPACT:** Removes main technical blocker - enables legal access to all Webflow sites without anti-bot limitations. Unlocks enterprise scalability (1000+ sites vs current 10-50).

### Task Management Workflow
**After each task completion:**
1. Update `docs/project-management/completed.md` with timing data
2. Move next task from backlog to `current-sprint.md`
3. Update this section in CLAUDE.md
4. Commit changes with clear message

## 🆘 Emergency Procedures

### Production Issues
- **Memory leaks:** See `docs/backend/memory-management.md#emergency-procedures`
- **Performance degradation:** See `docs/backend/performance-optimization.md#troubleshooting`
- **Worker failures:** See `docs/backend/worker-threads-guide.md#troubleshooting-guide`

### Quick Debug Commands
```bash
# Check running processes
pm2 list

# View logs
pm2 logs qa-sentinel

# Memory usage
free -h && ps aux --sort=-%mem | head -10
```

---

**Last Updated:** 2024-09-23
**Project Status:** Active Development - Foundation Phase
**Key Contact:** Backend architecture и memory management - критический приоритет