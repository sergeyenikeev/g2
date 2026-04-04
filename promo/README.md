# Promo Assets

- `promo/metadata.json`: общие метаданные и полный набор полей для карточки Yandex Games.
- `promo/screenshots/`: текущие медиа-черновики и архив старых выгрузок.
- `promo/promo-images/`: placeholder cover and thumbnail SVGs.

Для текстов Яндекс Игр опираемся на `promo/metadata.json` и `docs/yandex_games_release.md`.
Автоматическая проверка лимитов и обязательных полей выполняется тестом `tests/yandex-metadata.test.ts`.
