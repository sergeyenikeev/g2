# PORTING GUIDE

## Обзор
Игра выбирает платформенный адаптер по `VITE_PLATFORM` и направляет все SDK-вызовы через `PlatformBridge` в `src/platform/bridge.ts`.

Поддерживаемые платформы:
- crazygames
- poki
- yandex
- vkplay
- rustore
- generic

## Как добавить новую платформу
1) Создайте `src/platform/<platform>/adapter.ts` и реализуйте контракт адаптера.
2) Зарегистрируйте адаптер в `src/platform/factory.ts`.
3) Добавьте `.env.<platform>` с `VITE_PLATFORM=<platform>`.
4) Добавьте `dev:<platform>` и `build:<platform>` в `package.json`.
5) Обновите `SDK_INTEGRATION_MATRIX.md` и `PLATFORM_CHECKLIST.md`.

## Методы PlatformBridge (обязательное поведение)
- `init()` -> инициализация SDK (ошибка/исключение при отсутствии SDK).
- `loadingStart()` / `loadingStop()` -> сигнал загрузки.
- `gameplayStart()` / `gameplayStop()` -> сигнал игрового процесса.
- `showAd(type, ctx)` -> показ рекламы и вызовы:
  - `ctx.pause()` при старте рекламы
  - `ctx.grantReward()` при выдаче награды (rewarded)
  - `ctx.resume()` при завершении/ошибке
- `canShowRewardedNow(kind)` -> общие кулдауны (rewarded 90с + continue 10м).
- `markContinueUsed()` -> ставит cooldown continue и сохраняет `rewardCooldownUntil`.
- `storageGet` / `storageSet` -> использовать SDK-хранилище, иначе localStorage.
- `track(eventName, payload)` -> аналитика (или логирование).

## Подключение SDK-скриптов
Рекомендуемое место для подключения SDK: `C:\Users\s\Documents\g2\index.html`.
`index.html` автоматически подключает SDK для CrazyGames / Yandex / Poki / VK Play, если `VITE_USE_PLATFORM_MOCK=0` и выбран соответствующий `VITE_PLATFORM`.
Если вы используете собственный загрузчик, добавьте SDK-скрипты вручную по шагам ниже.

### CrazyGames (автоматически)
`index.html` сам добавляет SDK, если `VITE_PLATFORM=crazygames`.

### Poki (автоматически)
`index.html` сам добавляет SDK, если `VITE_PLATFORM=poki`.
Если нужно подключить вручную, используйте:

```html
<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>
```

2) Адаптер ожидает `window.PokiSDK` с методами:
- `init()`
- `gameLoadingStart()` / `gameLoadingFinished()`
- `gameplayStart()` / `gameplayStop()`
- `commercialBreak()` и `rewardedBreak()`

3) Проверьте в песочнице Poki, что промисы корректно резолвятся и коллбеки вызываются.

### Yandex Games (автоматически)
`index.html` сам добавляет SDK, если `VITE_PLATFORM=yandex`.
Если нужно подключить вручную, используйте:

```html
<script src="https://yandex.ru/games/sdk/v2"></script>
```

2) Адаптер ожидает:
- `window.YaGames.init()` -> `ysdk`
- `ysdk.adv.showFullscreenAdv(...)` и `ysdk.adv.showRewardedVideo(...)`
- `ysdk.getStorage()` (или `ysdk.storage`)
- `ysdk.features.LoadingAPI.ready()` и `ysdk.features.GameplayAPI.start/stop()` если доступны
 - `ysdk.environment.i18n.lang` (язык пользователя для авто-выбора)

3) Проверьте в песочнице Yandex Games: реклама, сохранения, жизненный цикл.

### VK Play (автоматически)
`index.html` сам добавляет SDK, если `VITE_PLATFORM=vkplay` (и вызывает `VKWebAppInit` после загрузки).
Если нужно подключить вручную, используйте:

```html
<script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
```

2) Инициализируйте bridge:

```html
<script>
  if (window.vkBridge && window.vkBridge.send) {
    window.vkBridge.send("VKWebAppInit");
  }
</script>
```

3) Адаптер ожидает `window.vkBridge` / `window.VKBridge` / `window.VKPlayBridge` с `send()` и использует:
- `VKWebAppShowNativeAds` с `ad_format: "interstitial" | "reward"`

4) Проверьте превью VK Play: рекламные коллбеки и выдачу награды.

## Проверка и preview

### Локальный preview (dev)
1) Запуск нужной платформы:
   - `npm run dev:generic`
   - `npm run dev:crazygames`
   - `npm run dev:poki`
   - `npm run dev:yandex`
   - `npm run dev:vkplay`
   - `npm run dev:rustore`
   - `npm run dev:itchio`
   - `npm run dev:newgrounds`
2) Включение моков для локальной проверки рекламы/SDK:
   - PowerShell: `$env:VITE_USE_PLATFORM_MOCK="1"; npm run dev:yandex`
   - CMD: `set VITE_USE_PLATFORM_MOCK=1` → `npm run dev:yandex`
   - Чтобы выключить: `Remove-Item Env:VITE_USE_PLATFORM_MOCK` (PowerShell) или `set VITE_USE_PLATFORM_MOCK=0` (CMD).
3) Проверка именно production-билда:
   - `npm run build:<platform>`
   - `npm run preview -- --mode <platform>` (preview берет `dist/<platform>`)
   - Альтернатива без Vite: `cd dist/<platform>` и `python -m http.server 8080`

### Preview в порталах
- CrazyGames: Developer Portal → Game Versions → Upload ZIP → Preview/Play (песочница).
- Poki: Partner Portal → Game/Builds → Upload ZIP → Preview/Sandbox.
- Yandex Games: console.yandex.ru → Игры → Игра → Версии → Песочница/Предпросмотр → Запустить.
- VK Play: vkplay.ru/developers → Игра → Версии/Сборки → Превью/Тест.
- Generic: локальный dev или статический сервер из `dist/generic`.

Примечание: в портальном preview доступны реальные SDK-события. Локально используйте моки, если нет доступа к SDK.

### Yandex: как проверить загрузку JS/CSS в черновике
1) В консоли Yandex Games откройте версию игры → нажмите **"Открыть черновик с debug панель"**.
2) В открывшемся окне нажмите **F12** (или **Ctrl+Shift+I**) → откроется DevTools.
3) Перейдите во вкладку **Network**:
   - включите **Disable cache**
   - включите **Preserve log**
4) Обновите страницу (F5 / Ctrl+R).
5) В фильтре введите `index-` и убедитесь, что загружаются:
   - `./index-*.js` со статусом **200**
   - `./index-*.css` со статусом **200**
6) Если видите **404/blocked**, значит ассеты не доступны в черновике (обычно: загружен не тот ZIP или версия не обновилась).

Быстрая проверка через Console:
```js
Array.from(document.querySelectorAll('script[src],link[rel="stylesheet"][href]'))
  .map((el) => el.getAttribute('src') || el.getAttribute('href'));
```
Сравните имена `index-*.js` и `index-*.css` с файлами из `dist/yandex`.

## Чеклист интеграции
- SDK-скрипт загружен до `/src/main.ts`.
- Глобальный объект SDK соответствует ожиданиям адаптера.
- Реклама вызывает pause/resume, награда выдаётся только при успехе.
- Сохранения работают (SDK storage или fallback localStorage).
- Билд загружен из `dist/<platform>`.

## Публикация по платформам

### Общая подготовка релизного билда
1) Отключите мок платформы (см. скрипты ниже) и соберите нужный билд: `npm run build:<platform>`.
2) Убедитесь, что `index.html` лежит в корне `C:\Users\s\Documents\g2\dist\<platform>`.
3) Упакуйте **содержимое** папки `dist\<platform>` в ZIP (в архиве должен быть `index.html` в корне, а не вложенная папка).
4) Используйте метаданные из `C:\Users\s\Documents\g2\promo\metadata.json` и скриншоты из `C:\Users\s\Documents\g2\promo\screenshots`.
5) Прогоните смоук‑тест: запуск, результаты, continue/double tokens, сохранения после перезапуска.

### CrazyGames
Ссылка для входа: <https://developer.crazygames.com/>

Шаги:
1) Войдите в Developer Portal и откройте раздел игр (обычно "Games" -> "Add Game").
2) Выберите тип проекта: HTML5.
3) Заполните карточку:
   - Title: **LumeLines: Daily Blocks**
   - Tagline: **Place. Clear. Glow — every day.**
   - Description: из `promo/metadata.json`
   - Tags: `block`, `puzzle`, `daily`, `relaxing`, `casual`, `grid`, `lines`
   - Category/Genre: Puzzle (или ближайший эквивалент)
   - Orientation: Portrait
   - Controls: Mouse + Touch
   - Monetization: Ads (interstitial + rewarded)
4) Загрузите ZIP с содержимым `C:\Users\s\Documents\g2\dist\crazygames`.
5) Проверьте превью/песочницу: запуск, пауза/результаты, rewarded continue/double.
6) Сохраните и отправьте на публикацию.

### Poki
Ссылка для входа: <https://developers.poki.com/>

Шаги:
1) Войдите в партнёрский портал Poki (доступ обычно выдаётся после партнёрства).
2) Создайте новую игру (Add Game / New Game / Upload Game).
3) Укажите параметры:
   - Title: **LumeLines: Daily Blocks**
   - Description: из `promo/metadata.json`
   - Genre/Category: Puzzle / Casual
   - Orientation: Portrait
   - Controls: Mouse + Touch
4) Убедитесь, что SDK Poki подключён (см. раздел "Подключение SDK-скриптов").
5) Загрузите ZIP с содержимым `C:\Users\s\Documents\g2\dist\poki`.
6) Проверьте превью: midgame/rewarded показы, пауза/мьют музыки, сохранения.
7) Отправьте билд на модерацию/публикацию.

### Yandex Games
Ссылка на документацию: <https://developer.yandex.ru/games/>
Ссылка на консоль: <https://console.yandex.ru/> 
Исправленная ссылка: https://games.yandex.ru/console

Шаги:
1) Откройте консоль разработчика и создайте новый проект в разделе Яндекс Игры.
2) Выберите тип: HTML5 (браузерная игра).
3) Заполните карточку:
   - Название: **LumeLines: Daily Blocks**
   - Короткое описание/слоган: **Place. Clear. Glow — every day.**
   - Полное описание: из `promo/metadata.json`
   - Категория: Puzzle / Casual
   - Ориентация: Portrait
   - Управление: мышь и сенсор
4) Убедитесь, что SDK Yandex подключён (см. "Подключение SDK-скриптов").
5) Загрузите ZIP с содержимым `C:\Users\s\Documents\g2\dist\yandex`.
6) Протестируйте превью/песочницу: реклама, сохранения, continue/double.
7) Отправьте на публикацию после прохождения проверки.

Дополнительно для модерации Yandex:
- Название "LumeLines: Daily Blocks" должно совпадать в игре, текстовых полях и на всех промо-материалах (ru/en), включая обложки/видео/гиф.
- Все локализуемые материалы должны соответствовать языку черновика (ru/en).
- SDK обязан быть подключен: `YaGames.init()` вызван, `LoadingAPI.ready()` и `GameplayAPI.start/stop()` вызываются по жизненному циклу.
- Язык определяется только через SDK (`ysdk.environment.i18n.lang`), без ручного выбора в игре.
- При переключении вкладки звук/музыка должны останавливаться.
- В игровом поле не должно быть выделения текста или контекстного меню.
- Возрастной рейтинг: 6+.

### VK Play
Ссылка для входа: <https://vkplay.ru/developers>

Шаги:
1) Войдите в кабинет разработчика VK Play и создайте новую игру.
2) Выберите тип проекта: Web/HTML5.
3) Заполните карточку:
   - Title: **LumeLines: Daily Blocks**
   - Tagline/Short description: **Place. Clear. Glow — every day.**
   - Description: из `promo/metadata.json`
   - Категория: Puzzle / Casual
   - Ориентация: Portrait
   - Управление: мышь и сенсор
4) Убедитесь, что подключён VK Bridge (см. "Подключение SDK-скриптов").
5) Загрузите ZIP с содержимым `C:\Users\s\Documents\g2\dist\vkplay`.
6) Проверьте превью: interstitial/rewarded, отсутствие ошибок при отказе рекламы.
7) Отправьте билд на публикацию.

### Rustore (Android / WebView)
Rustore принимает Android-приложения, поэтому веб-игру пакуем в лёгкий WebView-хост, который показывает `dist/rustore`. Соберите его через `npm run build:rustore`, а затем перенесите папку `C:\Users\s\Documents\g2\dist\rustore` в Android-проект; `scripts/build-release.*` автоматически архивируют его как `lumelines-rustore.zip`.

Нативный слой должен реализовать контракт `window.RustoreBridge` (см. `src/platform/rustore/adapter.ts`) с методами `showAd`, `storageGet`/`storageSet`, `track` и `getLanguage`, чтобы можно было прокидывать rewarded continue/double-токены, аналитические события и сохранённые данные. Детали упаковки, требований к ориентации и вариантах монетизации описаны в `docs/rustore_android.md`.

Если мост не отвечает, игра продолжит работу через `localStorage`, но без доступа к нативным объявлениям и синхронизации токенов. На Android можно подключить AdMob/Unity Ads/другие SDK и переадресовать события через Bridge, чтобы сохранить текущую экономику монетизации (ads, rewarded, continue cooldown).

### Generic (itch.io / Newgrounds / self-host)
Основные ссылки:
- itch.io: <https://itch.io/>
- Newgrounds: <https://www.newgrounds.com/>

itch.io ????:
1) ??????? ? ??????? -> Dashboard -> Upload new project.
2) Project type: HTML.
3) ???????? "This file will be played in the browser".
4) ???????? flat-??????: `npm run build:itchio`.
5) ????????? ZIP ? ?????????? `C:\Users\s\Documents\g2\dist\itchio` (??? `C:\Users\s\Documents\g2\dist\lumelines-itchio.zip`).
6) ????????? Title/Description/Tags ?? `promo/metadata.json`.

Newgrounds ????:
1) ???????? flat-?????? (assets ? ?????): `npm run build:newgrounds`.
2) ??????? ? ??????? -> Submit Game (HTML5/Browser).
3) ????????? ZIP ? ?????????? `C:\Users\s\Documents\g2\dist\newgrounds` (??? `C:\Users\s\Documents\g2\dist\lumelines-newgrounds.zip`).
4) ????????? Title/Description/Tags ?? `promo/metadata.json`.

Self-host шаги:
1) Разместите содержимое `C:\Users\s\Documents\g2\dist\generic` на статическом хостинге.
2) Убедитесь, что `index.html` открывается из корня и ресурсы грузятся по относительным путям.

## Скрипты сборки

### Скрипт: отключение мока перед билдом (PowerShell)
Файл: `C:\Users\s\Documents\g2\scripts\build-release.ps1`

Назначение: отключает мок (`VITE_USE_PLATFORM_MOCK=0`), собирает билд и упаковывает ZIP.

```powershell
param(
  [ValidateSet("generic","crazygames","poki","yandex","vkplay","rustore","newgrounds","itchio")]
  [string]$Platform = "generic"
)

$ErrorActionPreference = "Stop"
$root = "C:\Users\s\Documents\g2"
Set-Location $root

$env:VITE_USE_PLATFORM_MOCK = "0"

Write-Host "Building platform: $Platform"
npm run "build:$Platform"

$dist = Join-Path $root "dist\$Platform"
$zip = Join-Path $root "dist\lumelines-$Platform.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip

Remove-Item Env:VITE_USE_PLATFORM_MOCK -ErrorAction SilentlyContinue
```

### Скрипт: сборка всех платформ без моков (CMD)
Файл: `C:\Users\s\Documents\g2\scripts\build-release.cmd`

```bat
@echo off
setlocal enabledelayedexpansion
set "ROOT=C:\Users\s\Documents\g2"
cd /d "%ROOT%" || exit /b 1

set "VITE_USE_PLATFORM_MOCK=0"

for %%P in (generic crazygames poki yandex vkplay rustore newgrounds itchio) do (
  echo === Building %%P ===
  call npm run build:%%P
  if errorlevel 1 exit /b 1
  powershell -NoProfile -Command "Compress-Archive -Path '%ROOT%\dist\%%P\*' -DestinationPath '%ROOT%\dist\lumelines-%%P.zip' -Force"
  if errorlevel 1 exit /b 1
)

endlocal
```

Запуск: `C:\Users\s\Documents\g2\scripts\build-release.cmd`

### Скрипт: тестовые сборки с моками (CMD)
Файл: `C:\Users\s\Documents\g2\scripts\build-mock.cmd`

```bat
@echo off
setlocal enabledelayedexpansion
set "ROOT=C:\Users\s\Documents\g2"
cd /d "%ROOT%" || exit /b 1

set "VITE_USE_PLATFORM_MOCK=1"

for %%P in (generic crazygames poki yandex vkplay rustore newgrounds itchio) do (
  echo === Building %%P (mock) ===
  call npm run build:%%P
  if errorlevel 1 exit /b 1
  powershell -NoProfile -Command "Compress-Archive -Path '%ROOT%\dist\%%P\*' -DestinationPath '%ROOT%\dist\lumelines-%%P-mock.zip' -Force"
  if errorlevel 1 exit /b 1
)

endlocal
```

Запуск: `C:\Users\s\Documents\g2\scripts\build-mock.cmd`

## Локализация
- В игре два языка: русский и английский.
- По умолчанию: для Yandex/VK/Mail.ru — русский, для остальных — английский.
- Если платформа не из RU-набора, язык выбирается автоматически по языку браузера.
- Если доступен Yandex SDK, язык берется из `ysdk.environment.i18n.lang` и используется как дефолт при первом запуске.
- На Yandex настройка языка в UI скрыта: язык всегда берется из SDK.
- Пользователь может переключить язык в настройках: Settings -> Language.

## Тексты для Yandex Games (ru/en)
Источник: `C:\Users\s\Documents\g2\promo\metadata.json` (блок `yandex`).

Короткое описание (ru):
Расслабляющая головоломка: ставьте фигуры, очищайте линии, собирайте комбо.

Короткое описание (en):
Relaxing block puzzle: place shapes, clear lines, build combos.

Полное описание (ru):
Размещайте три фигуры на поле 10x10, очищайте строки и столбцы, разгоняйте комбо и зарабатывайте токены. Ежедневный режим дает одинаковый сид для всех игроков. Токены тратятся на новые светящиеся темы. Игра офлайн, прогресс сохраняется локально.

Полное описание (en):
Place three shapes on a 10x10 board, clear rows and columns, build combos, and earn tokens. Daily Challenge uses the same seed for everyone. Spend tokens on new glowing themes. Offline play with local saves.

Описание для SEO (ru, до 160 символов):
LumeLines: Daily Blocks - расслабляющая головоломка с блоками. Ставьте фигуры, очищайте линии, собирайте комбо и открывайте темы.

Описание для SEO (en, до 160 символов):
LumeLines: Daily Blocks is a relaxing block puzzle. Place shapes, clear lines, build combos, and unlock new themes.

Об игре (ru, до 1000 символов):
Медитативная блок-головоломка с мягким свечением и быстрыми партиями. Размещайте три фигуры, очищайте строки и столбцы, растите множитель комбо и зарабатывайте токены. Ежедневный режим использует общий сид для всех игроков. Токены тратятся на новые светящиеся темы. Игра работает офлайн, прогресс сохраняется локально.

Об игре (en, до 1000 символов):
A calm block puzzle with soft glow and quick runs. Place three shapes, clear rows and columns, build combo multiplier, and earn tokens. Daily Challenge uses a shared seed for all players. Spend tokens on new glowing themes. Offline play with local saves.

Как играть (ru, до 1000 символов):
Перетаскивайте фигуры на поле 10x10 (или ставьте касанием в режиме Tap to place). Соберите линии по горизонтали или вертикали, чтобы очистить их и получить очки. Чем больше линий за ход, тем выше комбо. Когда фигуры больше не помещаются, раунд заканчивается. Наградная реклама доступна по кнопке для продолжения или удвоения токенов.

Как играть (en, до 1000 символов):
Drag shapes onto the 10x10 board (or tap to place in Tap to place mode). Clear full rows or columns to score points. The more lines you clear per move, the higher the combo. When no shapes can fit, the run ends. Rewarded ads are optional and let you continue or double tokens.
