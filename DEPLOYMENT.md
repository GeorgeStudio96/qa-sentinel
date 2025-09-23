# Инструкции по деплою QA Sentinel

## Быстрый деплой

### 1. Создание Supabase проекта

1. Перейдите на [supabase.com](https://supabase.com) и создайте аккаунт
2. Создайте новый проект
3. Скопируйте URL и API ключи из Settings → API

### 2. Настройка схемы БД

1. Перейдите в SQL Editor в Supabase Dashboard
2. Скопируйте и выполните SQL из `supabase/migrations/001_initial_schema.sql`
3. Убедитесь что создались таблицы: sites, scans, findings, baselines
4. Убедитесь что создались storage buckets: screenshots, baselines

### 3. Деплой на Vercel

#### Автоматический деплой
1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в Vercel Dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```
3. Деплойте проект

#### Ручной деплой
```bash
npm install -g vercel
vercel login
vercel
```

### 4. Проверка работы

1. Откройте deployed URL
2. Добавьте тестовый сайт (например, https://example.com)
3. Запустите сканирование
4. Проверьте что данные сохраняются в Supabase

### 5. Добавление интеграций (опционально)

#### Slack Webhook
1. Создайте Incoming Webhook в Slack
2. Добавьте переменную `SLACK_WEBHOOK_URL` в Vercel
3. Перезапустите деплой

#### Cron Jobs
Убедитесь что в `vercel.json` настроены cron jobs для автоматического сканирования.

## Мониторинг

- Логи Vercel Functions: Vercel Dashboard → Functions
- Логи БД: Supabase Dashboard → Logs
- Мониторинг ошибок: Vercel Dashboard → Overview

## Расходы

Ожидаемые расходы на тестовую нагрузку:
- Vercel Hobby: $0 (до лимитов)
- Supabase Free Tier: $0 (до 500MB БД)
- Общий расход: $5-10/месяц при активном использовании

## Troubleshooting

### Ошибка "Cannot connect to Supabase"
- Проверьте переменные окружения
- Убедитесь что Supabase проект активен

### Ошибка Playwright в продакшне
- Убедитесь что используется headless режим
- Проверьте лимиты времени выполнения (maxDuration: 300)

### Проблемы с Storage
- Убедитесь что RLS политики настроены правильно
- Проверьте что buckets созданы и публичные