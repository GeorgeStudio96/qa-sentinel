# Supabase CLI Commands

## Основные команды

```bash
# Авторизация (используем токен из env)
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase projects list

# Инициализация проекта
npx supabase init

# Связать с удаленным проектом
npx supabase link --project-ref $SUPABASE_PROJECT_REF

# Статус проекта
npx supabase status

# База данных
npx supabase db push --linked          # применить миграции
npx supabase db pull --linked          # скачать схему
npx supabase db reset                  # сбросить локальную БД
npx supabase db dump --data-only       # дамп данных
npx supabase db diff                   # показать изменения

# Миграции
npx supabase migration new <name>      # создать миграцию
npx supabase migration list            # список миграций
npx supabase migration repair          # исправить миграции

# Локальная разработка
npx supabase start                     # запустить локально
npx supabase stop                      # остановить

## ЕСЛИ ХОЧЕШЬ ЗАПУСТИТЬ ЛОКАЛЬНО

После `npx supabase start` получишь:

```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
MCP URL: http://127.0.0.1:54321/mcp
Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Mailpit URL: http://127.0.0.1:54324

Publishable key: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
Secret key: sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
S3 Region: local
```

**Studio (UI):** http://127.0.0.1:54323 — открой в браузере для визуального управления БД

# API ключи
npx supabase projects api-keys --project-ref $SUPABASE_PROJECT_REF

# Функции
npx supabase functions new <name>      # создать функцию
npx supabase functions deploy <name>   # задеплоить функцию
npx supabase functions serve           # запустить локально

# Логи
npx supabase functions logs <name>

# Информация
npx supabase --help
```
