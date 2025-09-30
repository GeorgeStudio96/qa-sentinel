# Docker - Советы и рекомендации

## ⚠️ Важные правила

### 1. **Всегда используй `-d` для фона**
```bash
# ✅ Правильно - запуск в фоновом режиме
docker compose up -d

# ❌ Неправильно - блокирует терминал
docker compose up
```

### 2. **Останавливай контейнеры перед выключением Mac**
```bash
# Перед выключением компьютера
docker compose down
```

### 3. **Регулярно чисти неиспользуемые данные**
```bash
# Раз в неделю
docker system prune -a
```

## 🎯 Типичные сценарии

### Первый запуск проекта
```bash
cd qa-sentinel
docker compose up -d
```

### Начало работы каждый день
```bash
# Проверить что всё запущено
docker ps

# Если контейнеры остановлены
docker compose up -d
```

### Конец рабочего дня
```bash
# Можешь оставить запущенным или остановить
docker compose down
```

### Если что-то сломалось
```bash
# Полный перезапуск
docker compose down -v
docker compose up -d

# Если не помогло - пересоздать образы
docker compose down -v
docker compose pull
docker compose up -d
```

### Нужно освободить место на диске
```bash
# Удалить всё неиспользуемое
docker system prune -a --volumes
```

## 🚨 Частые проблемы

### Порт уже занят
```
Error: bind: address already in use
```

**Решение**: Изменить порт в `docker-compose.yml`
```yaml
ports:
  - "5433:5432"  # Вместо 5432:5432
```

### Контейнер не запускается
```bash
# Посмотреть логи
docker compose logs postgres

# Проверить healthcheck
docker ps
```

### База данных пустая после перезапуска
**Причина**: Удалил volumes (`docker compose down -v`)

**Решение**: Восстановить из бэкапа
```bash
cat backup.sql | docker exec -i qa-sentinel-postgres psql -U postgres -d qa_sentinel
```

### Docker Desktop не запускается
**Решение**:
1. Перезапустить Docker Desktop
2. Перезагрузить Mac
3. Переустановить Docker Desktop

## 💡 Полезные трюки

### Автоматический запуск Docker при старте Mac
Docker Desktop → Settings → General → Start Docker Desktop when you log in

### Ограничить потребление ресурсов
Docker Desktop → Settings → Resources:
- CPU: 4 cores
- Memory: 4 GB
- Swap: 1 GB
- Disk: 60 GB

### Быстрый доступ к логам
```bash
# Создай alias в ~/.zshrc
alias dlogs='docker compose logs -f --tail=50'

# Теперь можешь использовать
dlogs postgres
```

### Автоматический бэкап базы
```bash
# Создай скрипт backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec qa-sentinel-postgres pg_dump -U postgres qa_sentinel > "backups/backup_$DATE.sql"

# Запускай раз в день
chmod +x backup.sh
./backup.sh
```

## 📁 Структура данных Docker

```
Docker хранит данные в volumes:
├── postgres_data/     # Все таблицы и данные PostgreSQL
├── redis_data/        # Данные Redis (очереди)
└── pgadmin_data/      # Настройки pgAdmin

Эти данные НЕ удаляются при `docker compose down`
Удаляются только при `docker compose down -v`
```

## 🔐 Безопасность

### Для локальной разработки
- Простые пароли (postgres/postgres) - **ОК**
- Открытые порты (5432, 6380) - **ОК**

### Для продакшена (Vercel/Railway)
- Используй сильные пароли
- Не открывай порты наружу
- Используй SSL для подключения к базе
- Не коммить `.env` файлы в git

## 🎓 Что важно понимать

### Volumes vs Containers
- **Container** = запущенное приложение (удаляется при `down`)
- **Volume** = данные (сохраняются при `down`, удаляются при `down -v`)

### Images vs Containers
- **Image** = шаблон (скачивается один раз)
- **Container** = экземпляр шаблона (можно запустить много раз)

### Network
Docker создает виртуальную сеть `qa-sentinel`:
- Контейнеры видят друг друга по имени
- `postgres` доступен внутри сети как `postgres:5432`
- Снаружи доступен как `localhost:5432`

## 📚 Когда использовать что

### `docker compose up -d`
Запуск всех сервисов

### `docker compose down`
Остановка (данные сохраняются)

### `docker compose down -v`
Полная очистка (данные удаляются)

### `docker compose restart`
Быстрый перезапуск (без пересоздания)

### `docker compose logs -f`
Мониторинг в реальном времени
