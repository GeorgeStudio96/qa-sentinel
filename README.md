# QA Sentinel

Автономный AI QA-инженер для Webflow/Next.js сайтов. Сканирует веб-сайты, находит реальные баги и создает профессиональные баг-репорты.

## Возможности

- 🔍 Автоматическое сканирование веб-сайтов
- 🖼️ Обнаружение сломанных изображений
- 📱 Проверка на разных устройствах (desktop, tablet, mobile)
- 📊 Простой dashboard для управления
- 📸 Скриншоты проблем
- 💾 Хранение всех данных в Supabase

## Технический стек

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Vercel Functions
- **База данных**: Supabase (PostgreSQL)
- **Хранилище**: Supabase Storage
- **Тестирование**: Playwright
- **Хостинг**: Vercel

## Быстрый старт

### Требования

- Node.js 20+
- npm или pnpm

### Установка

1. Клонируйте проект:
```bash
git clone <your-repo-url>
cd qa-sentinel
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
cp .env.example .env.local
```

Заполните `.env.local` своими значениями:
- Создайте проект в [Supabase Dashboard](https://app.supabase.com)
- Скопируйте URL и API ключи

4. Создайте схему БД в Supabase:
- Перейдите в SQL Editor в Supabase Dashboard
- Выполните SQL из `supabase/migrations/001_initial_schema.sql`

5. Запустите проект:
```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Использование

1. **Добавьте сайт**: Введите название и URL сайта в форме
2. **Запустите сканирование**: Нажмите "Start Scan" рядом с сайтом
3. **Просмотрите результаты**: Увидите статус сканирования и количество найденных проблем

## Архитектура проекта

```
qa-sentinel/
├── app/                      # Next.js App Router
│   ├── dashboard/           # Dashboard страницы
│   └── api/                 # API routes
├── lib/                     # Утилиты
│   └── supabase/           # Supabase клиенты
├── packages/               # Монорепо пакеты (будущее)
│   ├── core/               # Основная логика
│   ├── integrations/       # Внешние сервисы
│   └── shared/             # Общий код
├── supabase/               # Supabase конфигурация
│   └── migrations/         # SQL миграции
└── types/                  # TypeScript типы
```

## Деплой

### Vercel

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в Vercel Dashboard
3. Деплойте проект

### Переменные окружения для продакшна

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Roadmap

### Неделя 1 ✅
- [x] Базовая структура проекта
- [x] Supabase интеграция
- [x] Dashboard с добавлением сайтов
- [x] API для сканирования
- [x] Обнаружение сломанных изображений

### Неделя 2 (в планах)
- [ ] Visual regression тестирование
- [ ] Проверка форм
- [ ] Slack интеграция
- [ ] Автоматическое сканирование (Cron Jobs)

### Неделя 3 (в планах)
- [ ] Webflow OAuth интеграция
- [ ] Performance мониторинг (Lighthouse)
- [ ] ClickUp интеграция
- [ ] CI/CD с GitHub Actions

## Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для фичи (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## Лицензия

MIT
