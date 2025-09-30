# Form Testing System - Setup & Usage

## 🚀 Overview

High-performance browser-based form testing system built on:
- **Fastify** API server
- **BullMQ** job queue with Redis
- **Playwright** browser automation
- **Browser Pool** for optimal resource usage
- **Real-time progress** tracking

## 📦 Prerequisites

1. **Redis** - Required for BullMQ job queue
   ```bash
   # macOS
   brew install redis
   brew services start redis

   # Linux
   sudo apt-get install redis-server
   sudo systemctl start redis
   ```

2. **Environment Variables** - Add to `.env.local`:
   ```bash
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # API Server
   NEXT_PUBLIC_API_SERVER_URL=http://localhost:3001

   # OpenAI (Optional - for AI reports)
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```

## 🏃 Running the System

### Terminal 1: Fastify API Server
```bash
npm run api:dev
```
This starts the Fastify server on port 3001 with:
- Form testing endpoints
- Real-time progress streaming
- Queue statistics

### Terminal 2: BullMQ Worker
```bash
npm run worker:dev
```
This starts the background worker that processes form testing jobs.

### Terminal 3: Next.js Frontend
```bash
npm run dev
```
This starts the Next.js UI on port 3000.

## 🎯 Usage

1. Navigate to `/test-forms-v2` in your browser
2. Click "Start Advanced Testing"
3. Watch real-time progress as forms are tested
4. View detailed results with issues and recommendations

## 📊 Architecture

```
User clicks "Analyze" (Next.js UI)
    ↓
POST /api/form-testing/start (Fastify API)
    ↓
Job added to BullMQ queue
    ↓
Worker processes job:
  1. Discover forms via Webflow API (500ms)
  2. Initialize browser pool (2 browsers)
  3. Test forms in parallel (5 forms at a time)
  4. Generate AI report (if configured)
    ↓
Real-time progress updates via polling
    ↓
Results displayed in UI
```

## 🔧 Key Components

### 1. Browser Pool (`lib/shared/browser-pool/BrowserPoolOptimized.ts`)
- Maintains 2-10 reusable browsers
- Each browser can have up to 3 contexts
- Automatic page optimization (blocks images, fonts)
- Smart resource management

### 2. Form Tester (`lib/modules/form-testing/FormTester.ts`)
- Tests individual forms with real browser
- Runs multiple test cases:
  - Empty submission validation
  - Email field validation
  - Required fields check
  - Valid data submission
- Generates actionable issues

### 3. Orchestrator (`lib/modules/form-testing/FormTestingOrchestrator.ts`)
- Coordinates entire testing flow
- Discovers forms via Webflow API
- Parallelizes form testing (5 chunks)
- Provides real-time progress updates

### 4. Job Queue (`lib/queue/FormTestingQueue.ts`)
- BullMQ-based job queue
- Handles high-volume requests
- Priority support (paid users first)
- Automatic retries (2 attempts)

### 5. API Routes (`lib/api/routes/form-testing.ts`)
- `POST /api/form-testing/start` - Start testing job
- `GET /api/form-testing/progress/:jobId` - Poll progress
- `GET /api/form-testing/progress/:jobId/stream` - SSE stream
- `GET /api/form-testing/stats` - Queue statistics

## 📈 Performance

- **Discovery**: ~500ms (Webflow API)
- **Testing**: ~3-5 seconds for 10-20 forms
- **Parallel processing**: 5 forms simultaneously
- **Browser reuse**: Saves ~2-3 seconds per form
- **Total**: 800ms initial response + 3-5s full results

## 🎨 AI Report Generation

If OpenAI API key is configured:
- Executive summary of form quality
- Top 3-5 critical issues
- Detailed recommendations per form
- Overall quality score (0-100)

## 🐛 Troubleshooting

### Redis Connection Error
```
Error: ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Start Redis service
```bash
brew services start redis  # macOS
sudo systemctl start redis # Linux
```

### Worker Not Processing Jobs
**Check**:
1. Worker is running (`npm run worker:dev`)
2. Redis is accessible
3. Webflow access token is valid

### Browser Launch Failures
**Common causes**:
- Missing Playwright browsers: `npx playwright install chromium`
- Low memory: Reduce `maxSize` in browser pool config
- Docker: Add `--no-sandbox` flag (already configured)

## 📝 Environment Variables Reference

```bash
# Redis (Required)
REDIS_HOST=localhost
REDIS_PORT=6379

# API Server (Required)
NEXT_PUBLIC_API_SERVER_URL=http://localhost:3001
API_PORT=3001
API_HOST=localhost

# Browser Pool (Optional)
BROWSER_POOL_MIN_SIZE=2
BROWSER_POOL_MAX_SIZE=10

# OpenAI (Optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_BASE=https://api.openai.com/v1

# Webflow (Already configured)
# Access tokens stored in Supabase
```

## 🚢 Production Deployment

### Option 1: Vercel + Redis Cloud

1. Deploy Next.js to Vercel
2. Use Upstash Redis (free tier)
3. Add worker as serverless function or separate service

### Option 2: Docker

```dockerfile
# API Server + Worker in one container
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# Install Playwright
RUN npx playwright install chromium --with-deps

# Start both API and Worker
CMD ["sh", "-c", "npm run api:start & npm run worker:start"]
```

### Option 3: Separate Services

- **API**: Deploy to Vercel/Railway
- **Worker**: Deploy to Railway/Render
- **Redis**: Upstash/Redis Cloud

## 📚 Next Steps

1. **Scale**: Increase browser pool size for more throughput
2. **Cache**: Add Redis caching for Webflow API calls
3. **Scheduling**: Add cron jobs for automated testing
4. **Webhooks**: Notify users when tests complete
5. **History**: Store test results in Supabase

## 🎯 Testing

Run a quick test:
```bash
# Terminal 1
npm run api:dev

# Terminal 2
npm run worker:dev

# Terminal 3
curl -X POST http://localhost:3001/api/form-testing/start \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"your_webflow_token"}'

# Get progress
curl http://localhost:3001/api/form-testing/progress/test-user-123456789
```

## 💡 Tips

- **Local Development**: Use polling (GET /progress/:jobId) instead of SSE
- **Production**: Use SSE for real-time updates
- **High Load**: Increase Redis memory and browser pool size
- **Cost Optimization**: Use smaller browser pool (2-5) for lower memory usage