# Defects

## Open

| ID | Severity | Area | Description | Workaround | Status |
| --- | --- | --- | --- | --- | --- |
| D-001 | Medium | SDK QA | Локально невозможно полностью эмулировать реальные callback-последовательности внешних SDK (CrazyGames/Poki/Yandex/VK Play). | Проверять rewarded/midgame в целевой среде портала перед релизом. | Open |
| D-002 | Low | Tooling | В некоторых Windows PowerShell окружениях `npm` не запускается из-за блокировки `npm.ps1` политикой выполнения. | Использовать `npm.cmd` или скорректировать Execution Policy для текущей среды. | Open |

## Fixed

| ID | Severity | Area | Description | Fixed in |
| --- | --- | --- | --- | --- |
| F-001 | High | Results UX | Кнопка `Continue` была всегда скрыта на экране результатов, поэтому rewarded-continue был недоступен. | 2026-02-23 |
| F-002 | Medium | Rewards | Возможна гонка при повторном вызове `finalizeRun()` до завершения async-сохранения, из-за чего токены могли начислиться дважды. | 2026-02-23 |
| F-003 | Medium | Yandex Ads | Rewarded в Yandex мог считаться успешным даже без фактической награды, если игрок закрывал рекламу до `onRewarded`. | 2026-02-23 |
| F-004 | Medium | Accessibility / UI | Неактивные экраны оставались фокусируемыми через Tab, а быстрые toast-сообщения могли скрываться раньше времени из-за пересекающихся таймеров. | 2026-03-16 |
