# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Project Overview

**QA Sentinel** - автономный AI QA инженер для автоматического тестирования Webflow сайтов.

### Core Features
- Webflow OAuth интеграция для подключения сайтов
- Автоматическое сканирование: broken links, формы, визуальные баги
- Form testing с валидацией и реальной отправкой данных
- Real-time прогресс сканирования
- Скриншоты проблем

### Tech Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS 4
- **Backend:** Fastify API + BullMQ worker queues
- **Database:** Supabase (PostgreSQL + Storage + Auth)
- **Browser Automation:** Playwright
- **Infrastructure:** Docker (PostgreSQL, Redis, pgAdmin)
- **Deployment:** Vercel

## 🏗️ Architecture

### Project Structure
```
qa-sentinel/
├── app/                    # Next.js App Router
│   ├── dashboard/          # Main dashboard pages
│   ├── test-forms-v2/      # Form testing UI
│   └── api/                # Next.js API routes
├── lib/                    # Core business logic
│   ├── api/                # Fastify server & routes
│   │   ├── server.ts       # Main Fastify server
│   │   ├── worker.ts       # BullMQ worker
│   │   └── routes/         # API route handlers
│   ├── modules/            # Feature modules
│   │   ├── form-testing/   # Form testing orchestrator
│   │   └── form-checker/   # Form validation
│   ├── integrations/       # External services
│   │   └── webflow/        # Webflow API client
│   ├── shared/             # Shared utilities
│   │   ├── browser-pool/   # Playwright pool management
│   │   ├── logger/         # Logging utilities
│   │   └── scanning/       # Scanning utilities
│   ├── queue/              # BullMQ queue setup
│   └── supabase/           # Supabase clients
├── supabase/
│   └── migrations/         # Database migrations
├── docs/
│   ├── docker/             # Docker commands & tips (Russian)
│   └── plan-update.md      # Current implementation plan
└── docker-compose.yml      # Local dev infrastructure
```

### Dual-Server Architecture
The project runs **two separate servers**:

1. **Next.js Dev Server** (`npm run dev`)
   - Port: 3000
   - Handles: UI, SSR, Next.js API routes

2. **Fastify API Server** (`npm run api:dev`)
   - Port: 3001
   - Handles: Heavy operations, Webflow API, browser automation
   - Worker: `npm run worker:dev` processes background jobs

### Form Testing System
**Location:** `lib/modules/form-testing/`

The form testing system is modular and extensible:
- **FormTestingOrchestrator:** Main coordinator for all form tests
- **FormValidator:** Validates required fields, email formats
- **FormDiscoverer:** Finds forms using Webflow API
- **RealisticDataGenerator:** Generates test data presets
- **RealSubmissionTester:** Submits forms with real data (optional)
- **RateLimitHandler:** Handles Webflow API rate limits (429 errors)

## 🚀 Development Commands

### Local Development
```bash
# Start Next.js frontend
npm run dev                          # http://localhost:3000

# Start Fastify backend
npm run api:dev                      # http://localhost:3001

# Start BullMQ worker
npm run worker:dev                   # Background job processor

# Type checking
npm run type-check

# Linting
npm run lint
```

### Docker Infrastructure
```bash
# Start all services (PostgreSQL, Redis, pgAdmin)
docker compose up -d

# Stop services
docker compose down

# View container status (recommended UI)
lazydocker

# Quick commands reference
# See docs/docker/commands.md for complete list
```

**Docker Services:**
- PostgreSQL: `localhost:5432` (user: postgres, db: qa_sentinel)
- Redis: `localhost:6380`
- pgAdmin: `http://localhost:5050` (admin@qa-sentinel.com / admin)

### Testing
```bash
# E2E tests
npm run test:e2e

# Test Webflow integration
npm run test:webflow
```

## 🗄️ Database & Migrations

### Supabase CLI
Project is linked to remote Supabase instance: `uxoajdeybfnrxckemqnp`

```bash
# Create new migration
SUPABASE_ACCESS_TOKEN=xxx npx supabase migration new migration_name

# List projects
SUPABASE_ACCESS_TOKEN=xxx npx supabase projects list

# Get API keys
SUPABASE_ACCESS_TOKEN=xxx npx supabase projects api-keys --project-ref uxoajdeybfnrxckemqnp
```

**Note:** For executing SQL migrations, use Supabase Dashboard SQL Editor at:
`https://supabase.com/dashboard/project/uxoajdeybfnrxckemqnp/sql/new`

Migration files are in `supabase/migrations/` with format: `YYYYMMDDHHMMSS_name.sql`

### Key Tables
- `sites` - Webflow sites connected by users
- `webflow_tokens` - OAuth tokens for Webflow API
- `scans` - QA scan results
- `findings` - Individual issues found
- `baselines` - Visual regression baselines
- `form_test_scenarios` - Test data presets for form testing

## 🔧 Code Patterns

### Always Use ES6 Imports
```typescript
// ✅ Correct
import { createClient } from '@supabase/supabase-js';

// ❌ Wrong
const { createClient } = require('@supabase/supabase-js');
```

### Playwright Browser Management
Always clean up browser instances to prevent memory leaks:
```typescript
// ✅ Correct - Always use try/finally
async function scanWebsite(url: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    return await captureScreenshot(page);
  } finally {
    await browser.close(); // Critical!
  }
}

// ❌ Wrong - No cleanup
async function scanWebsite(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  return await captureScreenshot(page);
}
```

### Supabase Client Usage
Use the correct client based on context:
```typescript
// Server-side (API routes, server components)
import { createServerClient } from '@/lib/supabase/server';
const supabase = createServerClient();

// Client-side (React components)
import { createBrowserClient } from '@/lib/supabase/client';
const supabase = createBrowserClient();
```

### Environment Variables
```bash
# Required for development
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ACCESS_TOKEN=sbp_...

# Webflow OAuth
WEBFLOW_CLIENT_ID=xxx
WEBFLOW_CLIENT_SECRET=xxx
WEBFLOW_AUTH_URL=https://webflow.com/oauth/authorize

# API & Worker
API_PORT=3001
API_HOST=localhost
```

## 📋 Current Implementation: Form Testing with Real Submissions

**Active Plan:** See `docs/plan-update.md` for full details

### Status
- ✅ Database migration created (`form_test_scenarios` table)
- ✅ Migration applied to Supabase
- 🚧 Implementing RealisticDataGenerator
- 🚧 Building API routes for preset management
- 🚧 Creating UI for preset selection

### Key Components to Build
1. **RealisticDataGenerator** (`lib/modules/form-testing/RealisticDataGenerator.ts`)
   - Simple presets (test@test.com)
   - Realistic presets (John Doe, Sarah Smith, etc.)

2. **RealSubmissionTester** (`lib/modules/form-testing/RealSubmissionTester.ts`)
   - Smart field matching by name/id/placeholder/type
   - Screenshots before/after submission

3. **RateLimitHandler** (`lib/modules/form-testing/RateLimitHandler.ts`)
   - Handle Webflow 429 errors
   - Auto-pause for 60 seconds
   - User-friendly messages

4. **API Routes** (`lib/api/routes/test-scenarios.ts`)
   - GET `/api/test-scenarios/settings` - list presets
   - POST `/api/test-scenarios/settings` - create/update
   - POST `/api/test-scenarios/generate` - generate defaults

5. **UI Updates** (`app/test-forms-v2/page.tsx`)
   - Checkbox: "Real submission (creates actual leads)"
   - Preset dropdown selector
   - Warning messages

### Webflow Rate Limits
- Starter/Basic: 60 req/min
- CMS/Business: 120 req/min
- Form submissions via browser don't count as API requests
- Only form discovery via API counts toward limits

## 🔗 Important Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/uxoajdeybfnrxckemqnp
- **Supabase SQL Editor:** https://supabase.com/dashboard/project/uxoajdeybfnrxckemqnp/sql/new
- **Webflow Developer Portal:** https://developers.webflow.com
- **Local pgAdmin:** http://localhost:5050
- **Docker Documentation:** See `docs/docker/` for Russian commands & tips

---

**Last Updated:** 2025-09-30
**Current Phase:** Form Testing Implementation
**Docker Setup:** ✅ Completed (PostgreSQL, Redis, pgAdmin running locally)