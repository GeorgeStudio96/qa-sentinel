# Vercel CLI Commands

## Основные команды

```bash
# Локальная разработка
npx vercel dev

# Деплой в production
npx vercel deploy --prod

# Деплой preview
npx vercel deploy

# Авторизация
npx vercel login

# Выйти из аккаунта
npx vercel logout

# Показать информацию о проекте
npx vercel inspect

# Управление переменными окружения
npx vercel env pull              # скачать .env.local
npx vercel env add               # добавить переменную
npx vercel env rm                # удалить переменную
npx vercel env ls                # список переменных

# Логи
npx vercel logs <deployment-url>

# Список деплоев
npx vercel list

# Удалить деплой
npx vercel remove <deployment-url>

# Связать проект
npx vercel link

# Информация о команде
npx vercel --help
```
