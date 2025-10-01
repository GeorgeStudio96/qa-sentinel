#!/bin/bash

# Start development services
cd "$(dirname "$0")"

echo "🚀 Starting QA Sentinel Development Environment..."

# Start Redis if not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "📦 Starting Redis..."
    redis-server --daemonize yes --port 6379
fi

# Start API server and worker with Docker Compose
echo "🐳 Starting API server and worker with Docker..."
docker compose up -d

echo "✅ All services started!"
echo ""
echo "📝 Logs:"
echo "  docker compose logs -f    # All services"
echo "  docker compose logs api-server -f"
echo "  docker compose logs worker -f"
echo ""
echo "🛑 To stop:"
echo "  docker compose down"
