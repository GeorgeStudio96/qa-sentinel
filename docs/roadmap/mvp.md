# QA Sentinel MVP Roadmap

## 🎯 MVP Goal
Автоматическое QA тестирование Webflow сайтов с базовым набором проверок

## ✅ Completed
- [x] OAuth интеграция с Webflow
- [x] Подключение и авторизация сайтов
- [x] Сохранение токенов в базу данных
- [x] UI для управления подключениями

## 🚀 MVP Features (Priority Order)

### Phase 1: Basic Scanning (Week 1)
- [ ] Получение списка страниц через Webflow API
- [ ] Простое сканирование с Playwright
- [ ] Проверка broken links
- [ ] Проверка загрузки изображений
- [ ] Базовый отчет о найденных проблемах

### Phase 2: Form Testing (Week 2)
- [ ] Обнаружение форм на страницах
- [ ] Тестирование submit форм
- [ ] Валидация required полей
- [ ] Проверка email валидации
- [ ] Отчет о проблемах с формами

### Phase 3: Visual Testing (Week 3)
- [ ] Скриншоты страниц
- [ ] Базовое сравнение с baseline
- [ ] Обнаружение layout сломанностей
- [ ] Responsive проверки (mobile/tablet/desktop)

### Phase 4: Reporting (Week 4)
- [ ] Dashboard с результатами сканирования
- [ ] Детальные отчеты по каждой проблеме
- [ ] Приоритизация issues (Critical/High/Medium/Low)
- [ ] Export отчетов в PDF

## 📊 Success Metrics for MVP
- Может сканировать 10+ Webflow сайтов
- Находит минимум 5 типов проблем
- Генерирует понятные отчеты
- Работает стабильно 24/7

## 🔄 Post-MVP Features
- AI-powered анализ с OpenAI
- Интеграция с Slack/Discord
- Scheduled сканирование
- Webflow Designer Extension
- Performance monitoring
- SEO анализ

## 🏗️ Technical Foundation (Ready for Scale)
Используем архитектуру из `/docs/backend/`:
- **Worker Threads** - готовы для параллельного сканирования
- **Browser Pool** - эффективное управление ресурсами
- **Memory Management** - стабильность под нагрузкой

## Timeline
- **MVP Release**: 4 недели от текущей даты
- **Beta Testing**: Неделя 5-6
- **Public Launch**: Неделя 7-8