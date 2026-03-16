# Сборка и запуск LumeLines: Daily Blocks

## Требования
- Node.js 20+
- npm 10+

Проверка:
```powershell
node -v
npm -v
```

## Установка зависимостей
```powershell
npm install
```

Если PowerShell блокирует `npm.ps1`, используйте `npm.cmd`:
```powershell
npm.cmd run test
npm.cmd run lint
```

## Локальный запуск
Базовый режим:
```powershell
npm run dev:generic
```

Платформенные режимы:
```powershell
npm run dev:crazygames
npm run dev:poki
npm run dev:yandex
npm run dev:vkplay
npm run dev:rustore
npm run dev:newgrounds
npm run dev:itchio
```

## Сборка
Быстрая дефолтная сборка:
```powershell
npm run build
```

Все платформы:
```powershell
npm run build:all
```

Явные таргеты:
```powershell
npm run build:generic
npm run build:crazygames
npm run build:poki
npm run build:yandex
npm run build:vkplay
npm run build:rustore
npm run build:newgrounds
npm run build:itchio
```

Сборка с моками для всех платформ:
```powershell
npm run build:all:mock
```

Артефакты попадают в `dist/<platform>`.

## Проверки качества перед релизом
```powershell
npm run lint
npm run test
npm run build
```

## Моки платформенных SDK
- Переменная: `VITE_USE_PLATFORM_MOCK`.
- `1` или `true` включает мок-адаптеры.
- Если переменная не задана: в dev по умолчанию используются моки, в production build - реальные адаптеры.

Пример (PowerShell):
```powershell
$env:VITE_USE_PLATFORM_MOCK = "1"
npm run dev:yandex
Remove-Item Env:VITE_USE_PLATFORM_MOCK -ErrorAction SilentlyContinue
```

## Если `npm` не запускается
- Убедитесь, что Node.js установлен и доступен в `PATH`.
- Если проблема только в PowerShell policy, используйте `npm.cmd`.
- После изменения `PATH` перезапустите терминал.
