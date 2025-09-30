# План реализации функции реальной отправки форм

## Обзор

Добавление возможности **реальной отправки форм** (не только валидация) с тестовыми данными для пользователей, которые хотят протестировать полный цикл работы формы.

## Ключевые требования

1. **Опциональная функция** - включается через чекбокс
2. **Два типа пресетов данных:**
   - Простой: test, test@test.com
   - Реалистичный: John Doe, john.doe@example.com
3. **Генератор** для 5 реалистичных пресетов
4. **Ответственность пользователя** - он понимает, что создаются реальные заявки
5. **Обработка лимитов Webflow** - автоматическая пауза на 60 секунд при HTTP 429

## Технические детали

### Webflow Rate Limits
- **Starter/Basic:** 60 запросов/мин
- **CMS/Business:** 120 запросов/мин
- **Превышение:** HTTP 429 + заголовок Retry-After (обычно 60 секунд)
- **Важно:** Реальные отправки форм через браузер НЕ считаются как API-запросы! (только обнаружение форм использует API)

## Структура базы данных

### Таблица `form_test_scenarios`

```sql
CREATE TABLE form_test_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_type TEXT NOT NULL CHECK (preset_type IN ('simple', 'realistic')),
  preset_name TEXT NOT NULL,
  preset_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preset_name)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_form_test_scenarios_user_id ON form_test_scenarios(user_id);
CREATE INDEX idx_form_test_scenarios_active ON form_test_scenarios(user_id, is_active);

-- RLS политики
ALTER TABLE form_test_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scenarios"
  ON form_test_scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios"
  ON form_test_scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON form_test_scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON form_test_scenarios FOR DELETE
  USING (auth.uid() = user_id);
```

### Пресеты данных

#### Простой пресет:
- Имя: Test
- Фамилия: User
- Email: test@test.com
- Телефон: 1234567890
- Компания: Test Company
- Сообщение: Test message

#### Реалистичные пресеты (5 штук):

1. **John Doe - Tech Startup**
   - Email: john.doe@techstartup.com
   - Phone: +1 (555) 123-4567
   - Company: TechStartup Inc
   - Message: "Hi, I'm interested in learning more about your product. Could we schedule a demo?"

2. **Sarah Smith - Marketing Agency**
   - Email: sarah.smith@marketingpro.com
   - Phone: +1 (555) 234-5678
   - Company: Marketing Pro Agency
   - Message: "We're looking for a solution to improve our client engagement. Can you help?"

3. **Michael Chen - E-commerce**
   - Email: michael.chen@ecommerce-shop.com
   - Phone: +1 (555) 345-6789
   - Company: E-Commerce Shop
   - Message: "Looking to integrate your service with our online store. What are the pricing options?"

4. **Emily Johnson - Healthcare**
   - Email: emily.johnson@healthcareplus.com
   - Phone: +1 (555) 456-7890
   - Company: HealthCare Plus
   - Message: "Our clinic needs a HIPAA-compliant solution. Do you offer this?"

5. **David Rodriguez - Real Estate**
   - Email: david.rodriguez@realestatepro.com
   - Phone: +1 (555) 567-8901
   - Company: Real Estate Pro
   - Message: "I represent multiple properties and need a scalable solution. Let's talk!"

## Шаги реализации

### 1. Создать миграцию базы данных
- Создать таблицу `form_test_scenarios` в Supabase
- Настроить RLS политики
- Добавить индексы для оптимизации

### 2. Реализовать RealisticDataGenerator
- Файл: `lib/modules/form-testing/RealisticDataGenerator.ts`
- Класс с методами:
  - `getSimplePresets()` - возвращает 1 простой пресет
  - `getRealisticPresets()` - возвращает 5 реалистичных пресетов
  - `getAllPresets()` - возвращает все пресеты
  - `getPresetByName(name)` - получить пресет по имени

### 3. Реализовать RealSubmissionTester
- Файл: `lib/modules/form-testing/RealSubmissionTester.ts`
- Класс с методами:
  - `submitForm(page, formSelector, testData)` - отправить форму с реальными данными
  - `findMatchingValue(fieldHint, testData)` - умное определение какое значение использовать для поля
- Логика заполнения полей:
  - Проверка по name атрибуту
  - Проверка по id атрибуту
  - Проверка по placeholder
  - Проверка по type
  - Умное определение email, phone, name полей
- Скриншоты до и после отправки

### 4. Реализовать RateLimitHandler
- Файл: `lib/modules/form-testing/RateLimitHandler.ts`
- Класс с методами:
  - `checkRateLimits(headers)` - проверить заголовки X-RateLimit-*
  - `handleRateLimitError(retryAfter, callback)` - обработать HTTP 429
  - `checkIfPaused()` - проверить статус паузы
  - `shouldThrottle(rateLimitInfo)` - нужно ли замедлиться
  - `calculateThrottleDelay(rateLimitInfo)` - вычислить задержку
- Автоматическая пауза на 60 секунд при HTTP 429
- Дружелюбное сообщение: "⏸️ Пауза: соблюдение лимитов Webflow (60с)..."

### 5. Создать API маршруты
- Файл: `lib/api/routes/test-scenarios.ts`
- Эндпоинты:
  - `GET /api/test-scenarios/settings` - получить все пресеты пользователя
  - `POST /api/test-scenarios/settings` - создать/обновить пресет
  - `POST /api/test-scenarios/generate` - сгенерировать пресеты по умолчанию (6 штук)

### 6. Интегрировать с FormTestingOrchestrator
- Файл: `lib/modules/form-testing/FormTestingOrchestrator.ts`
- Добавить поддержку параметра `realSubmission` в интерфейсе `FormTestRequest`
- Добавить экземпляры `RealSubmissionTester` и `RateLimitHandler` в конструктор
- После обычного тестирования формы:
  - Загрузить пресет по имени
  - Заполнить форму данными из пресета
  - Кликнуть Submit
  - Сохранить результат отправки в `result.submissionResult`

### 7. Обновить UI test-forms-v2
- Файл: `app/test-forms-v2/page.tsx`
- Добавить состояния:
  - `realSubmissionEnabled` - включена ли реальная отправка
  - `selectedPreset` - выбранный пресет
  - `presets` - список доступных пресетов
- Загрузить пресеты при монтировании:
  - Если пресетов нет, сгенерировать по умолчанию
- UI элементы:
  - Чекбокс "Реальная отправка форм (создаются реальные заявки)"
  - Dropdown для выбора пресета
  - Предупреждение: "⚠️ Внимание: будут созданы реальные заявки в Webflow"
- Передать параметры `realSubmission` в запрос `/api/form-testing/start`

### 8. Создать страницу /test-scenarios
- Файл: `app/test-scenarios/page.tsx`
- UI для просмотра всех пресетов пользователя
- Кнопка "Сгенерировать пресеты по умолчанию"
- Отображение:
  - Название пресета
  - Тип (simple/realistic)
  - JSON с данными

## Итоговая схема работы

1. Пользователь открывает `/test-forms-v2`
2. Включает чекбокс "Реальная отправка форм"
3. Выбирает пресет из списка (Simple Test 1, John Doe, etc.)
4. Нажимает "Start Advanced Testing"
5. Система:
   - Обнаруживает все формы (Webflow API)
   - Тестирует валидацию (обычный режим)
   - Если включена реальная отправка:
     - Загружает данные из выбранного пресета
     - Заполняет форму реальными данными
     - Кликает Submit
     - Проверяет успешность отправки
   - Обрабатывает HTTP 429 с автоматической паузой на 60с
   - Показывает дружелюбное сообщение при rate limit
6. Пользователь видит результаты включая информацию об отправленных данных

## Безопасность и ограничения

- ✅ **Согласие пользователя** - через чекбокс с предупреждением
- ✅ **RLS политики** - только владелец может видеть свои пресеты
- ✅ **Обработка лимитов** - автоматическая пауза на 429 ошибку
- ✅ **Скриншоты** - до и после отправки для доказательства
- ✅ **Ответственность** - пользователь знает, что создаются реальные заявки

## Следующие шаги

1. Создать миграцию базы данных
2. Реализовать RealisticDataGenerator
3. Реализовать RealSubmissionTester
4. Реализовать RateLimitHandler
5. Создать API маршруты
6. Интегрировать с FormTestingOrchestrator
7. Обновить UI test-forms-v2
8. Создать страницу /test-scenarios