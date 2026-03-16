# DevOps automation

## Цель
Автоматизировать минимальный пайплайн качества для статической браузерной игры без backend.

## Базовый CI pipeline
Рекомендуемые шаги:
1. Checkout репозитория.
2. Установка Node.js LTS.
3. `npm ci`
4. `npm run lint`
5. `npm run test`
6. `npm run build:generic` или матрица платформенных сборок.
7. Публикация `dist/<target>` как artifact.

## Пример GitHub Actions
```yaml
name: ci
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build:generic
      - uses: actions/upload-artifact@v4
        with:
          name: dist-generic
          path: dist/generic
```

## Рекомендации
- Для релизов добавить job-матрицу `build:<platform>`.
- Падение `lint`, `test` или `build` должно блокировать merge и release.
- Изменения в процессе доставки фиксировать в `CHANGELOG.md`.
