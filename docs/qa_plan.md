# План обеспечения качества (QA)

## Контекст
- Проект: LumeLines: Daily Blocks (generic / Yandex / VK Play / Rustore, офлайн, Canvas2D)
- Ключевые риски: реклама, сохранения, управление на тач-устройствах

## Текущее состояние
- Юнит-тесты: актуальный прогон должен быть зелёным; сейчас в наборе 55 тестов, включая tutorial flow, нормализацию прогресса и tracking-события bridge.
- Сборка: `npm run build` должна выполняться без ошибок для целевого режима.
- Открытые дефекты см. `docs/defects.md`.

## Основные риски качества
- Реальные колбэки Yandex / VK Play / Rustore wrapper могут вести себя иначе, чем mock.
- Поведение drag-and-drop на мобильных (особенно в браузерах iOS/Android).
- Потеря pointer-состояния при сворачивании вкладки или системном прерывании жеста.
- Проверка кулдаунов rewarded при длительных сессиях.
- Визуальные артефакты при изменении размера окна.

## Рекомендации по тестам
- Смоук: Tutorial, Play, Daily, Themes, Settings, Pause/Resume.
- Проверка Tab/Shift+Tab: фокус не должен уходить в скрытые экраны.
- Проверка сохранений после перезагрузки страницы.
- Rewarded: Continue и Double Tokens (reward выдаётся только после adFinished).
- Midgame: только на Results или при смене режима.
- AdError/adblock: показать "Ad unavailable" и не ломать геймплей.

## Чек-лист перед релизом
- Использовать `CHECKLIST.md` + `docs/release_checklist.md`.

## Инструменты и метрики
- Vitest (юнит-тесты).
- Логи событий в консоли (INFO/WARN/ERROR).
- Tracked events через `PlatformBridge.track` для run/ad/reward/economy сценариев.
- Dev overlay (FPS/seed/combo/next pieces).

## Следующие действия QA
- Пройти ручной чек-лист на desktop и mobile.
- Проверить интеграцию Yandex / VK Play / Rustore в реальном окружении.
- Обновить промо-скриншоты на реальные.
