# Printagram Mail Agent — инструкция для Claude Code

## Контекст проекта

Агент мониторинга входящей почты Gmail для компании Printagram (Malta).
Работает как Node.js приложение на Hostinger Business Web Hosting.
Категоризирует входящие письма через Claude API и отправляет уведомления в Telegram.

**Владелец:** Eduard Martirosyan, Managing Director, Valentina@Malta Ltd (Printagram)

---

## Стек технологий

- **Runtime:** Node.js 20.x (ESM modules, `"type": "module"`)
- **Framework:** Express.js (webhook сервер)
- **Gmail:** OAuth2 + Gmail API v1 + Google Pub/Sub (push notifications)
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Storage:** Supabase (PostgreSQL) — категории + логирование
- **Notifications:** Telegram Bot API
- **Deploy:** Hostinger Business Web Hosting → Node.js Web App (hPanel)
- **CI/CD:** GitHub integration через hPanel

---

## Структура проекта

```
printagram-mail-agent/
├── src/
│   ├── server.js          # Entry point, Express app
│   ├── webhook.js         # Gmail Pub/Sub webhook handler
│   ├── gmail.js           # Gmail API client (fetch message)
│   ├── categorize.js      # Claude API категоризация (динамический промпт)
│   ├── notify.js          # Telegram уведомления
│   ├── supabase.js        # Supabase client + логирование
│   ├── categories.js      # Загрузка категорий из Supabase + кэш
│   └── gmail-watch.js     # Gmail watch setup + renewal
├── scripts/
│   ├── setup-watch.js     # Одноразовый скрипт: настройка Gmail watch
│   ├── get-token.js       # Одноразовый скрипт: OAuth2 получение refresh_token
│   └── seed-categories.js # Одноразовый скрипт: заполнить email_categories
├── .env.example
├── package.json
└── CLAUDE.md              # Этот файл
```

---

## Переменные окружения (.env / hPanel Environment Variables)

```env
# Google OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=          # Получить через scripts/get-token.js один раз
GOOGLE_USER_EMAIL=             # Gmail адрес который мониторим

# Google Pub/Sub
GOOGLE_PUBSUB_PROJECT_ID=      # GCP project id (напр. printagram-mail-agent)
GOOGLE_PUBSUB_TOPIC=           # projects/xxx/topics/gmail-notifications

# Anthropic
ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=              # Личный chat_id Эдуарда

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=

# App
PORT=3000                      # Hostinger подставит свой PORT автоматически
WEBHOOK_SECRET=                # Случайная строка для верификации webhook
CATEGORIES_CACHE_TTL=3600000   # Кэш категорий в мс (по умолчанию 1 час)
```

---

## Supabase схема

### Таблица: email_categories

Категории хранятся в БД и загружаются динамически — без хардкода в коде.
Максимальное количество активных категорий: **10-12** (ограничение точности Claude).

```sql
CREATE TABLE email_categories (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label_ru TEXT NOT NULL,
  description TEXT NOT NULL,    -- используется в промпте Claude
  emoji TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Базовые категории (seed)
INSERT INTO email_categories (code, label_ru, description, emoji, sort_order) VALUES
  ('price_request', 'Запрос цены',    'Клиент спрашивает цену, прайс-лист, стоимость продуктов или услуг', '💰', 1),
  ('order',         'Заказ',          'Новый заказ, уточнение по заказу, изменение или статус заказа',      '📦', 2),
  ('payment',       'Оплата',         'Квитанция об оплате, invoice, подтверждение платежа',                '✅', 3),
  ('complaint',     'Жалоба',         'Проблема с заказом, жалоба, недовольство качеством или сроками',    '⚠️', 4),
  ('spam_promo',    'Спам/Реклама',   'Маркетинговые рассылки, реклама, spam',                             '🗑', 5),
  ('general',       'Общее',          'Всё остальное что не попадает в другие категории',                   '📨', 6);
```

### Таблица: email_log

```sql
CREATE TABLE email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  from_email TEXT,
  from_name TEXT,
  subject TEXT,
  snippet TEXT,
  category TEXT NOT NULL REFERENCES email_categories(code),
  summary TEXT,
  confidence NUMERIC(3,2),
  language TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_log_category ON email_log(category);
CREATE INDEX idx_email_log_received_at ON email_log(received_at DESC);
CREATE INDEX idx_email_log_gmail_message_id ON email_log(gmail_message_id);
```

---

## Динамические категории — логика

Файл `src/categories.js` отвечает за загрузку и кэширование категорий:

```javascript
// src/categories.js
import { supabase } from './supabase.js';

let cache = null;
let cacheTime = 0;
const TTL = parseInt(process.env.CATEGORIES_CACHE_TTL) || 3600000;

export async function getActiveCategories() {
  const now = Date.now();
  if (cache && (now - cacheTime) < TTL) return cache;

  const { data, error } = await supabase
    .from('email_categories')
    .select('code, label_ru, description, emoji')
    .eq('active', true)
    .order('sort_order');

  if (error) throw error;
  cache = data;
  cacheTime = now;
  return cache;
}

export function buildCategoriesPrompt(categories) {
  return categories
    .map(c => `- ${c.code}: ${c.description}`)
    .join('\n');
}
```

Промпт для Claude генерируется динамически при каждом запросе (из кэша):

```javascript
// src/categorize.js
import { getActiveCategories, buildCategoriesPrompt } from './categories.js';

export async function categorizeEmail({ from, subject, snippet }) {
  const categories = await getActiveCategories();
  const categoriesList = buildCategoriesPrompt(categories);
  const validCodes = categories.map(c => c.code);

  const systemPrompt = `Ты — агент категоризации входящей почты для компании Printagram (Мальта).
Printagram — типографская и рекламная компания.
Анализируй письма и возвращай ТОЛЬКО JSON без markdown и без пояснений.

Доступные категории:
${categoriesList}

Формат ответа:
{
  "category": "<один из кодов выше>",
  "summary": "<краткое резюме на русском, 1 строка, до 100 символов>",
  "confidence": <число от 0 до 1>,
  "language": "<язык письма: en, ru, mt, it, другой>"
}`;

  // ... вызов Anthropic API
}
```

---

## Telegram уведомление — формат

```
📧 Новое письмо

👤 От: Maria Borg <maria@example.com>
📌 Тема: Price list for business cards
🏷 Категория: 💰 Запрос цены
📝 Резюме: Клиент спрашивает цену на визитки 500шт

⏰ 14:32 · 26 Mar 2026
```

Emoji берётся из поля `emoji` таблицы `email_categories` по коду категории.

---

## Логика работы (поток данных)

```
1. Gmail получает письмо
2. Gmail → Pub/Sub топик (push уведомление с historyId)
3. Pub/Sub → POST /webhook/gmail на наш сервер
4. webhook.js извлекает historyId из payload
5. gmail.js → Gmail API: получить полное письмо (subject, from, snippet)
6. supabase.js → проверить gmail_message_id на дубликат
7. categories.js → загрузить активные категории (из кэша)
8. categorize.js → Claude API: определить категорию + резюме
9. notify.js → Telegram: отправить уведомление
10. supabase.js → записать в email_log
```

---

## Gmail Watch — важные детали

- Watch истекает через **7 дней**
- Renewal через `setInterval` при старте сервера каждые 6 дней
- Renewal вызывает `gmail.users.watch()` заново с теми же параметрами
- Webhook всегда возвращает **200 OK** даже при ошибке (иначе Pub/Sub retry loop)

---

## Обработка ошибок

- Webhook: всегда `res.status(200).send('OK')` в начале, потом обработка
- Дубликаты: проверять `gmail_message_id` в `email_log` перед обработкой
- Ошибки категоризации: fallback категория `general`
- Логировать все ошибки через `console.error` (Hostinger пишет в лог)

---

## Deploy на Hostinger

1. Push в GitHub репозиторий
2. hPanel → Websites → Node.js Apps → Import Git Repository
3. Start command: `node src/server.js`
4. Node.js version: `20.x`
5. Все переменные из `.env.example` добавить в hPanel → Environment Variables
6. После первого деплоя выполнить локально:
   - `node scripts/get-token.js` → получить refresh_token → добавить в hPanel env
   - `node scripts/seed-categories.js` → заполнить email_categories в Supabase
   - `node scripts/setup-watch.js` → активировать Gmail watch

---

## OAuth2 первоначальная авторизация

`scripts/get-token.js` — локальный Express на порту 3001:
1. Запустить скрипт локально: `node scripts/get-token.js`
2. Открыть в браузере выведенный Google OAuth2 URL
3. Авторизоваться → скрипт поймает code через redirect
4. Обменять на `access_token` + `refresh_token`
5. Вывести `refresh_token` в консоль → скопировать в `.env` / hPanel

---

## Файловые соглашения

- Все файлы: ESM (`import/export`), без CommonJS
- Комментарии в коде: на английском
- Конфиг: через `process.env` напрямую, без config-библиотек
- Никаких `console.log` в production — только `console.error` для ошибок
- Версии зависимостей: фиксированные (без `^`)

---

## Фазы разработки

### Фаза 1 (текущая) — MVP
- [x] Архитектура и документация
- [ ] `scripts/get-token.js` — OAuth2 получение refresh_token
- [ ] `src/server.js` — Express сервер + webhook endpoint
- [ ] `src/supabase.js` — клиент + проверка дубликатов + логирование
- [ ] `src/categories.js` — загрузка категорий из Supabase + кэш
- [ ] `src/gmail.js` — fetch message по historyId
- [ ] `src/categorize.js` — Claude API с динамическим промптом
- [ ] `src/notify.js` — Telegram уведомление
- [ ] `scripts/seed-categories.js` — seed базовых категорий
- [ ] `scripts/setup-watch.js` — активация Gmail watch
- [ ] Deploy на Hostinger

### Фаза 2 — Автоматизация
- [ ] Автоответы на `price_request` (шаблоны)
- [ ] Создание задач при `order`
- [ ] Не уведомлять при `spam_promo`
- [ ] Веб-дашборд статистики категорий

### Фаза 3 — Интеграция
- [ ] Интеграция с основной Supabase базой Printagram
- [ ] Связь с заказами (поиск по email клиента)

---

## Полезные ссылки

- [Gmail API Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Google Cloud Pub/Sub](https://cloud.google.com/pubsub/docs/overview)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Hostinger Node.js Apps](https://support.hostinger.com/en/articles/nodejs-apps)
