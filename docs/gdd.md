One-page GDD (CrazyGames) — “BlockBuster Puzzle: Daily” (референс: BlockBuster Puzzle на CrazyGames, но с daily seed + комбо-метром)
0) Цель и ограничения

Цель: сделать “вечнозелёный” block-puzzle для органики CrazyGames: быстрое понимание, короткая сессия, высокая повторяемость, без серверов, без постоянного контента/ивентов.
Команда/срок: 1 разработчик, 2–6 недель MVP.
Платформа: Web (desktop+mobile) на CrazyGames.

1) High concept

Классический wood/block puzzle: игрок размещает фигуры на поле 10×10, очищает линии, собирает комбо и набирает рекорд.
Удержание без лайв-опса: Daily Challenge (seed дня) + косметические темы за достижения (локально).

Сессия: 3–7 минут.
Управление: drag-and-drop / tap-to-place (моб.).
Чёткая “первая минута”: без сложных правил, без текста (иконки + подсветки).

2) Core loop

Start (Play / Daily) →

Показ 3 фигур →

Плейсмент → очистка линий → комбо-множитель →

Конец раунда (нет ходов) →

Экран результатов: рекорд/награды/прогресс →

“Ещё раз” / Daily.

3) Механики (минимум контента)

Поле: 10×10.
Фигуры: 12–18 базовых (включая 1×1, линии, L/T/квадраты).
Генератор фигур: псевдослучайный с “анти-зажимом” (не выдавать 3 неподходящие подряд).
Скоринг:

+N за блоки + бонус за линии

Combo meter: серии очисток подряд увеличивают множитель (например x1 → x1.25 → x1.5…); сброс, если ход без очистки.

Happy moment: при “супер-очистке”/рекорде — вызвать celebration (confetti). 
CrazyGames

Daily Challenge: фиксированный seed на день, одна попытка “лучший результат дня” (локально).

4) Прогрессия без сервера (save)

Что сохраняем: лучший рекорд, лучший daily сегодня, количество сыгранных раундов, открытые темы, таймер доступности rewarded-бонуса.
Хранилище: использовать CrazyGames Data module (авто-fallback в LocalStorage для гостя; синхронизация у залогиненных). 
CrazyGames

Ключи: bestScore, themesUnlocked, dailyBest_YYYYMMDD, rewardCooldownUntil, runsCount.

5) Экраны (UI минимум)

Boot/Loading (полоса загрузки)

Main Menu: Play, Daily, Themes, Settings (звук, вибро/хаптик off)

Gameplay: поле, 3 фигуры, кнопка Pause

Pause: Resume, Restart, Settings

Game Over / Results: score, best, CTA “Play again”, опционально Rewarded offer

Themes (простой список 4–8 тем)

6) Монетизация (IAA, без IAP)

Только SDK CrazyGames (сторонние сети нельзя). 
CrazyGames

Midgame (Interstitial)

Точка показа: только после завершения раунда (Results) или между режимами (Play↔Daily).
Правило: не на кнопках навигации (например “меню/настройки”). 
CrazyGames

Частота: можно запрашивать в каждой “логичной паузе”; SDK сам ограничивает (max 1 раз ~в 3 минуты) и игнорирует слишком ранние запросы. 
CrazyGames

Rewarded

Оффер (строго опционально):

Continue 1 раз за раунд (поставить 3 “спасательных” 1×1 блоков или заменить набор фигур)

или “Double coins” (если есть мягкая валюта для тем)

Требования: reward-кнопка в понятном месте, равноправный “Continue without ad”, не слишком часто (таймер/кулдаун), не на активном gameplay-экране, не цеплять несколько ads за 1 награду. 
CrazyGames

Banner (по желанию, не в MVP)

Если добавлять — только на экранах, открытых >5 сек (Menu/Themes/Results) и не перекрывать UI; не во время игры. 
CrazyGames

7) CrazyGames SDK: точки вызова (обязательная карта)
Инициализация/лайфцикл

На старте загрузки: CrazyGames.SDK.game.loadingStart() 
CrazyGames

На loading screen: await CrazyGames.SDK.init() (особенно если используете Data module). 
CrazyGames

Когда всё готово: CrazyGames.SDK.game.loadingStop() 
CrazyGames

При входе в реальный геймплей (первый ход/старт раунда): gameplayStart() 
CrazyGames

При уходе в меню/пауза/экраны вне игры: gameplayStop(); при возврате — снова gameplayStart() 
CrazyGames

Реклама (видео)

Запрос: CrazyGames.SDK.ad.requestAd("midgame"|"rewarded", callbacks) 
CrazyGames

Callbacks:

adStarted: поставить паузу + замьютить звук

adFinished: вернуть звук/игру; для rewarded — выдать награду здесь

adError: корректно продолжить без награды (unfilled/adblock/other). 
CrazyGames
+1

Adblock

На Menu один раз: await CrazyGames.SDK.ad.hasAdblock() 
CrazyGames

Если adblock: игра полностью играбельна, но можно отключить “extra” (например, 1–2 косметики) — нельзя блокировать игру/пенализировать. 
CrazyGames

Особое событие

На рекорд/супер-комбо: CrazyGames.SDK.game.happytime() (редко). 
CrazyGames

Важно для QA/Basic Launch: если реклама отключена, игра должна вести себя нормально (не фризиться, rewarded-кнопки не должны быть “пустыми”). 
CrazyGames

8) Контент/арт-скоуп (минимум)

1 тайлсет (клетка, подсветка), 18 фигур (можно рисовать процедурно/векторно)

4 темы (цвета фона/клетки/фигур)

6 звуков (place, clear, combo, fail, button, reward)

9) MVP acceptance criteria (чёткие “готово”)

TTI (time-to-interact) < 5–8 сек на среднем устройстве

DnD и tap-place работают на mobile

Save/load через Data module, без потери прогресса 
CrazyGames

Midgame показывается только в Results; Rewarded — только с явного согласия и с кулдауном 
CrazyGames
+1

При adError игра не ломается; без рекламы игра полностью проходима 
CrazyGames
+1