# Docker - Основные команды

## 🚀 Запуск и остановка

```bash
# Запустить lazydocker
lazydocker

```bash
# Запустить все сервисы
docker compose up -d

# Остановить все сервисы
docker compose down

# Перезапустить все сервисы
docker compose restart

# Остановить все сервисы и удалить данные
docker compose down -v
```

## 📊 Мониторинг

```bash
# Посмотреть запущенные контейнеры
docker ps

# Посмотреть все контейнеры (включая остановленные)
docker ps -a

# Посмотреть логи всех сервисов
docker compose logs -f

# Посмотреть логи конкретного сервиса
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f pgadmin
```

## 🔧 Работа с контейнерами

```bash
# Зайти внутрь контейнера PostgreSQL
docker exec -it qa-sentinel-postgres sh

# Зайти внутрь контейнера Redis
docker exec -it qa-sentinel-redis sh

# Выполнить команду в контейнере PostgreSQL
docker exec qa-sentinel-postgres psql -U postgres -d qa_sentinel -c 'SELECT * FROM sites;'

# Выполнить команду в контейнере Redis
docker exec qa-sentinel-redis redis-cli ping
```

## 🗄️ Работа с базой данных

```bash
# Подключиться к PostgreSQL
docker exec -it qa-sentinel-postgres psql -U postgres -d qa_sentinel

# Посмотреть все таблицы
docker exec qa-sentinel-postgres psql -U postgres -d qa_sentinel -c '\dt'

# Посмотреть структуру таблицы
docker exec qa-sentinel-postgres psql -U postgres -d qa_sentinel -c '\d sites'

# Выполнить SQL запрос
docker exec qa-sentinel-postgres psql -U postgres -d qa_sentinel -c 'SELECT COUNT(*) FROM sites;'

# Создать бэкап базы
docker exec qa-sentinel-postgres pg_dump -U postgres qa_sentinel > backup.sql

# Восстановить из бэкапа
cat backup.sql | docker exec -i qa-sentinel-postgres psql -U postgres -d qa_sentinel
```

## 🧹 Очистка

```bash
# Остановить и удалить контейнеры
docker compose down

# Удалить все данные (volumes)
docker compose down -v

# Удалить неиспользуемые образы
docker image prune -a

# Удалить все (контейнеры, образы, volumes)
docker system prune -a --volumes
```

## 🔄 Обновление

```bash
# Скачать новые версии образов
docker compose pull

# Пересобрать и перезапустить
docker compose up -d --build

# Пересоздать контейнер с новым образом
docker compose up -d --force-recreate postgres
```

## 🐛 Диагностика

```bash
# Посмотреть использование ресурсов
docker stats

# Посмотреть информацию о контейнере
docker inspect qa-sentinel-postgres

# Проверить здоровье контейнеров
docker compose ps

# Посмотреть сети Docker
docker network ls

# Посмотреть volumes
docker volume ls
```

## 💾 Volumes (данные)

```bash
# Посмотреть все volumes
docker volume ls

# Посмотреть информацию о volume
docker volume inspect qa-sentinel_postgres_data

# Удалить конкретный volume
docker volume rm qa-sentinel_postgres_data

# Удалить все неиспользуемые volumes
docker volume prune
```

## ⚡ Быстрые команды

```bash
# Полный перезапуск с очисткой
docker compose down -v && docker compose up -d

# Посмотреть логи последних 100 строк
docker compose logs --tail=100

# Следить за логами в реальном времени
docker compose logs -f --tail=50

# Проверить статус healthcheck
docker inspect --format='{{.State.Health.Status}}' qa-sentinel-postgres
```

## 🔗 Полезные ссылки для твоего проекта

- **pgAdmin**: http://localhost:5050
  - Email: `admin@qa-sentinel.com`
  - Password: `admin`

- **PostgreSQL**:
  - Host: `localhost`
  - Port: `5432`
  - Database: `qa_sentinel`
  - User: `postgres`
  - Password: `postgres`

- **Redis**:
  - Host: `localhost`
  - Port: `6380`
