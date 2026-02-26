# Checkers Studio (TypeScript)

Веб-приложение для игры в шашки:
- человек против компьютера;
- 3 уровня сложности ИИ;
- редактор произвольной позиции перед стартом партии и моделирования сценариев с любого хода.

## Быстрый запуск

Для глобального лидерборда и telemetry запускайте встроенный backend:

```bash
npm install
npm run build
npm run serve
```

После этого откройте:

```text
http://localhost:8000
```

## Разработка на TypeScript

Исходники находятся в `src/app.ts`.

```bash
npm install
npm run build
```

После сборки `tsc` обновляет `dist/app.js`.
Для локального теста без backend можно использовать `npm run serve:static`.

## Что реализовано

- обязательное взятие;
- продолжение серии взятий одной фигурой;
- превращение в дамку;
- режимы игры: `человек vs компьютер` и `человек vs человек`;
- варианты правил: `классика` и `поддавки`;
- переключение цвета снизу (белые/чёрные);
- усиленный ИИ с уровнями `easy / medium / hard`;
- режим подсказки хода (подсветка фигуры и цели, стрелка);
- глобальная таблица лидеров для партий `vs компьютер` через backend API;
- scoring: результат + скорость + сложность, штраф за подсказки;
- игровой таймер для белых и чёрных;
- нумерация клеток (координаты доски);
- редактор позиции:
  - выставление фигур (включая дамок),
  - выбор чьего хода,
  - старт с выставленной позиции.

## Deployment Checklist

- `npm run build` проходит без ошибок.
- В head добавлены базовые SEO-мета-теги (description, og, twitter, canonical, JSON-LD).
- Для production backend задайте переменные:
  - `SITE_URL=https://your-real-domain.com`
  - `SESSION_SECRET=<long-random-secret>`
  - `ADMIN_TOKEN=<optional-admin-access-token>` (рекомендуется для закрытия `/admin`)
- Sitemap и robots обслуживаются сервером:
  - `https://your-real-domain.com/sitemap.xml`
  - `https://your-real-domain.com/robots.txt`

## Search Console

1. Добавьте property домена в Google Search Console.
2. Пройдите верификацию домена.
3. В разделе `Sitemaps` отправьте `https://your-real-domain.com/sitemap.xml`.
4. Отправьте URL главной страницы на переобход через URL Inspection.

## Backend anti-cheat и ranking

- Глобальный лидерборд хранится на сервере (`data/leaderboard.json`), не в браузере.
- Серверная подпись сессии (`HMAC`) + серверный расчёт очков.
- Защиты:
  - игры из редактора позиции не ранжируются;
  - минимальный порог по времени партии и числу ходов;
  - ограничение на число подсказок;
  - одна финализация на сессию;
  - учитывается лучший результат на имя.

## Telemetry

Сервер пишет telemetry-события в `data/telemetry.ndjson`:
- `game_start`
- `game_finish`
- `setup_open`
- `setup_apply`
- `setup_cancel`
- `hint_request`

## Admin Dashboard (Telemetry)

- HTML dashboard: `GET /admin`
- JSON summary: `GET /api/admin/telemetry-summary?days=14`
- Метрики: daily games, win rate, setup usage, setup/hint activity.
- Период регулируется query-параметром `days` (1..120).
- Если задан `ADMIN_TOKEN`, доступ к `/admin` и `/api/admin/telemetry-summary` только с:
  - `?token=<ADMIN_TOKEN>` или
  - заголовком `x-admin-token: <ADMIN_TOKEN>` или
  - `Authorization: Bearer <ADMIN_TOKEN>`.
