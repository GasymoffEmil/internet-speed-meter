# speedtest

Консольный скрипт для замера скорости скачивания: делает серию последовательных запросов к указанному
адресу и печатает среднее время запроса, объём скачанных данных и скорость.

## Требования

- Node.js ≥ 24 — TypeScript запускается напрямую через встроенный type stripping, сборка не нужна.

## Разработка

```sh
npm install
npm test             # тесты
npm run lint         # ESLint с проверкой типов
npm run typecheck    # tsc --noEmit
npm run format       # Prettier
npm run check        # всё вышеперечисленное
```
