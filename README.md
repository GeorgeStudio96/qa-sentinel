# QA Sentinel

Автономный AI QA-инженер для автоматического тестирования Webflow сайтов.

## 🚀 Возможности

- **🔐 Webflow OAuth Integration** - Подключение через официальный Webflow OAuth
- **🔍 Автоматическое сканирование** - Broken links, формы, визуальные баги
- **📊 Real-time прогресс** - Отслеживание сканирования в реальном времени
- **🖼️ Скриншоты проблем** - Визуальные доказательства найденных багов
- **📱 Responsive тестирование** - Desktop, tablet, mobile
- **💾 Supabase хранилище** - Надежное хранение всех данных

## Технический стек

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Vercel Functions
- **База данных**: Supabase (PostgreSQL)
- **Хранилище**: Supabase Storage
- **Тестирование**: Playwright
- **Хостинг**: Vercel

## 📋 Требования

- Node.js 18+
- Supabase аккаунт (база данных)
- Webflow Developer аккаунт (для OAuth)

## 🛠️ Быстрый старт

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
cp .env.local.example .env.local
```

4. **Настройте Supabase:**
- Создайте проект в [Supabase Dashboard](https://app.supabase.com)
- Скопируйте credentials в `.env.local`
- Выполните миграции из `supabase/migrations/`

5. **Настройте Webflow OAuth:**
- Создайте App на https://developers.webflow.com
- Добавьте redirect URI: `http://localhost:3000/api/auth/webflow/callback`
- Скопируйте Client Secret в `.env.local`:
```env
WEBFLOW_CLIENT_SECRET=your_secret_here
```

6. Запустите проект:
```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 💡 Использование

1. **Подключите Webflow**: Нажмите "Connect to Webflow" и авторизуйтесь
2. **Выберите сайты**: Выберите сайты для мониторинга из вашего Webflow аккаунта
3. **Запустите сканирование**: Система автоматически проанализирует сайты
4. **Просмотрите отчеты**: Детальные отчеты с приоритизацией проблем

## 📚 Документация

- [OAuth Setup Guide](docs/oauth/setup.md)
- [MVP Roadmap](docs/roadmap/mvp.md)
- [Backend Architecture](docs/backend/README.md)

## 🏗️ Архитектура

Построен для масштабирования с использованием:
- **Worker Threads** - параллельная обработка
- **Browser Pool** - эффективное управление браузерами
- **Memory Management** - стабильность 24/7

Детали в `/docs/backend/`

## 📂 Структура проекта

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

## 🗺️ Roadmap

### ✅ Completed
- [x] Webflow OAuth интеграция
- [x] Supabase база данных
- [x] Dashboard UI
- [x] Базовая архитектура

### 🚀 MVP (Next 4 weeks)
- [ ] Получение данных через Webflow API
- [ ] Сканирование с Playwright
- [ ] Broken links проверка
- [ ] Form тестирование
- [ ] Visual regression
- [ ] Отчеты и экспорт

### 🔮 Future
- [ ] AI анализ с OpenAI
- [ ] Slack/Discord интеграция
- [ ] Scheduled сканирование
- [ ] Performance monitoring

## Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для фичи (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## Лицензия

MIT
