#!/bin/bash

# QA Sentinel Development Startup Script
# Запускает Docker (Redis, Postgres) + API Server + Worker

set -e

echo "🚀 Starting QA Sentinel Development Environment..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Запуск Docker контейнеров
echo -e "\n${YELLOW}📦 Starting Docker containers (Redis, Postgres)...${NC}"
docker compose up -d redis postgres

# Ждём пока Redis запустится
echo -e "${YELLOW}⏳ Waiting for Redis...${NC}"
until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo -e "${GREEN}✅ Redis ready${NC}"

# 2. Останавливаем старые процессы Node.js (если есть)
echo -e "\n${YELLOW}🧹 Cleaning up old processes...${NC}"
pkill -f "lib/api/server.ts" 2>/dev/null || true
pkill -f "lib/api/worker.ts" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# 3. Запускаем API Server в фоне
echo -e "\n${YELLOW}🌐 Starting API Server (port 3001)...${NC}"
PORT=3001 npm run api:dev > logs/api.log 2>&1 &
API_PID=$!
echo -e "${GREEN}✅ API Server started (PID: $API_PID)${NC}"

# 4. Запускаем Worker в фоне
echo -e "\n${YELLOW}⚙️  Starting Worker...${NC}"
npm run worker:dev > logs/worker.log 2>&1 &
WORKER_PID=$!
echo -e "${GREEN}✅ Worker started (PID: $WORKER_PID)${NC}"

# Сохраняем PIDs
echo $API_PID > .api.pid
echo $WORKER_PID > .worker.pid

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 All services started successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n📋 Services:"
echo -e "  • API Server:   http://localhost:3001/api/health"
echo -e "  • Redis:        localhost:6380"
echo -e "  • Postgres:     localhost:5432"
echo -e "  • Next.js:      http://localhost:3000 (run separately)"
echo -e "\n📝 Logs:"
echo -e "  • API:    tail -f logs/api.log"
echo -e "  • Worker: tail -f logs/worker.log"
echo -e "\n🛑 To stop: ./stop.sh"
echo ""
