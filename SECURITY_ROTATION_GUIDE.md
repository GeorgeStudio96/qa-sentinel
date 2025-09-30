# 🔐 Инструкция по Ротации Секретов

## ⚠️ КРИТИЧНО: Немедленные Действия

Следующие секреты были скомпрометированы и требуют немедленной ротации:

1. ✅ Supabase Service Role Key
2. ✅ Supabase Access Token
3. ✅ OpenAI API Key
4. ✅ Webflow Client Secret

---

## 📋 План Ротации

### 1. Supabase Keys

#### А. Service Role Key

**Где найти:**
1. Перейдите в [Supabase Dashboard](https://app.supabase.com)
2. Выберите проект: `uxoajdeybfnrxckemqnp`
3. Settings → API
4. Найдите раздел "Project API keys"

**Что делать:**
```bash
# ⚠️ СТАРЫЙ КЛЮЧ (скомпрометирован):
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...Q8V61OjcevU5...

# 1. В Supabase Dashboard нажмите "Reset service_role key"
# 2. Скопируйте новый ключ
# 3. Обновите .env.local:
SUPABASE_SERVICE_ROLE_KEY=новый_ключ_здесь
```

**Последствия ротации:**
- ✅ Безопасно: автоматически инвалидирует старый ключ
- ⚠️ Требует обновления во всех environments (local, Vercel)

---

#### Б. Supabase Access Token (CLI)

**Где найти:**
1. [Supabase Account Settings](https://app.supabase.com/account/tokens)
2. Вкладка "Access Tokens"

**Что делать:**
```bash
# ⚠️ СТАРЫЙ TOKEN (скомпрометирован):
# SUPABASE_ACCESS_TOKEN=sbp_8aec25c8dc6eafe1e19c724fd00b744bacdbf12e

# 1. В Supabase Account → Access Tokens
# 2. Найдите токен "qa-sentinel" (или создайте новый)
# 3. Нажмите "Revoke" на старый токен
# 4. Создайте новый: "Generate new token"
# 5. Обновите .env.local:
SUPABASE_ACCESS_TOKEN=новый_токен_здесь
```

**Для чего используется:**
- Локальные миграции через Supabase CLI
- CI/CD pipelines (если настроены)

---

### 2. OpenAI API Key

**Где найти:**
1. [OpenAI Platform](https://platform.openai.com/api-keys)
2. Раздел "API keys"

**Что делать:**
```bash
# ⚠️ СТАРЫЙ КЛЮЧ (скомпрометирован):
# OPENAI_API_KEY=sk-proj-hSV1J96d_phdl...

# 1. В OpenAI Platform → API keys
# 2. Найдите ключ "qa-sentinel" (или аналогичный)
# 3. Нажмите "Revoke key"
# 4. Создайте новый: "Create new secret key"
# 5. Обновите .env.local:
OPENAI_API_KEY=sk-proj-новый_ключ_здесь
```

**Проверка использования:**
```bash
# Проверьте usage на старом ключе перед ротацией:
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer YOUR_OLD_KEY"
```

---

### 3. Webflow OAuth Credentials

**Где найти:**
1. [Webflow Developers](https://developers.webflow.com/apps)
2. Ваше приложение: "QA Sentinel"

**Что делать:**
```bash
# ⚠️ СТАРЫЕ CREDENTIALS (скомпрометированы):
# WEBFLOW_CLIENT_ID=0a5d4e7bf6fe3425a3a2a99b94df3e0d9e9e966be3d62e3ab50ab47c6121e265
# WEBFLOW_CLIENT_SECRET=9ead052688f1b5e4a4154d55acb308a7e294a4b04087858fae01a538eeef815b

# 1. В Webflow Developers → Apps → QA Sentinel
# 2. Settings → OAuth
# 3. Нажмите "Regenerate Secret"
# 4. Скопируйте новые credentials
# 5. Обновите .env.local:
WEBFLOW_CLIENT_ID=новый_client_id
WEBFLOW_CLIENT_SECRET=новый_secret
```

**⚠️ ВАЖНО:**
После ротации все пользователи должны переподключить Webflow (OAuth tokens станут невалидными).

**Миграция пользователей:**
```sql
-- В Supabase SQL Editor:
-- Пометить все существующие connections как недействительные
UPDATE webflow_connections 
SET is_active = false 
WHERE updated_at < NOW();
```

---

## 🔄 Пошаговый Процесс Ротации

### Шаг 1: Подготовка
```bash
# 1. Остановите все running processes
pkill -f "npm run dev"
pkill -f "npm run api:dev"

# 2. Создайте backup текущего .env.local
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
```

### Шаг 2: Ротация Supabase
1. Откройте [Supabase Dashboard](https://app.supabase.com/project/uxoajdeybfnrxckemqnp/settings/api)
2. Reset service_role key
3. Обновите [Supabase Account Tokens](https://app.supabase.com/account/tokens)
4. Скопируйте новые значения в `.env.local`

### Шаг 3: Ротация OpenAI
1. Откройте [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Revoke старый ключ
3. Create new secret key с именем: `qa-sentinel-$(date +%Y%m%d)`
4. Скопируйте в `.env.local`

### Шаг 4: Ротация Webflow
1. Откройте [Webflow Apps](https://developers.webflow.com/apps)
2. Найдите "QA Sentinel"
3. Regenerate secret
4. Скопируйте в `.env.local`
5. Обновите таблицу connections (SQL выше)

### Шаг 5: Обновление Vercel Environment Variables
```bash
# Если проект задеплоен на Vercel:
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

vercel env rm OPENAI_API_KEY production
vercel env add OPENAI_API_KEY production

vercel env rm WEBFLOW_CLIENT_SECRET production
vercel env add WEBFLOW_CLIENT_SECRET production

# Redeploy для применения изменений
vercel --prod
```

### Шаг 6: Проверка
```bash
# 1. Запустите локально
npm run dev

# 2. Проверьте логин
# Откройте: http://localhost:3000/login

# 3. Проверьте Webflow connection
# Откройте: http://localhost:3000/dashboard
# Нажмите: "Connect Webflow"

# 4. Проверьте логи на ошибки
tail -f .next/server.log
```

---

## ✅ Чеклист После Ротации

- [ ] Все секреты обновлены в `.env.local`
- [ ] Старые ключи отозваны в соответствующих сервисах
- [ ] Vercel environment variables обновлены
- [ ] Проект перезапущен локально
- [ ] OAuth flow работает с новыми credentials
- [ ] Supabase queries выполняются успешно
- [ ] OpenAI API calls работают (если используется)
- [ ] `.env.local.backup.*` файлы безопасно удалены через 48 часов

---

## 🚨 Мониторинг После Ротации

### Проверка Supabase
```bash
# Test Supabase connection
curl https://uxoajdeybfnrxckemqnp.supabase.co/rest/v1/sites \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

### Проверка OpenAI
```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Проверка Webflow OAuth
```bash
# Test OAuth redirect
curl -I "http://localhost:3000/api/auth/webflow/authorize"
# Должен вернуть 302 redirect
```

---

## 📝 Дополнительные Рекомендации

### 1. Git History Cleanup (Опционально)
```bash
# ⚠️ ОПАСНО: Переписывает историю Git
# Используйте только если .env.local был закоммичен

# Установите BFG Repo Cleaner
brew install bfg

# Удалите .env.local из всей истории
bfg --delete-files .env.local

# Принудительный push (требует force)
git push --force
```

### 2. Настройка Pre-commit Hook
```bash
# Предотвращает случайный коммит секретов
cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
if git diff --cached --name-only | grep -q "^.env.local$"; then
  echo "ERROR: Attempting to commit .env.local!"
  echo "This file contains secrets and should never be committed."
  exit 1
fi
HOOK

chmod +x .git/hooks/pre-commit
```

### 3. Secret Scanning (GitHub)
Если используете GitHub:
1. Settings → Security → Secret scanning
2. Enable "Push protection"
3. Включает автоматическое обнаружение leaked secrets

---

## 📞 Контакты При Проблемах

- **Supabase Support:** support@supabase.io
- **OpenAI Support:** https://help.openai.com
- **Webflow Support:** https://university.webflow.com/support

---

**Создано:** 2025-09-30  
**Статус:** ⚠️ ТРЕБУЕТСЯ НЕМЕДЛЕННАЯ РОТАЦИЯ
