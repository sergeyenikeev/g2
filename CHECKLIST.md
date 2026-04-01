# QA Checklist

- [ ] Desktop: drag-and-drop placement feels responsive
- [ ] Mobile: drag-and-drop and tap-to-place both work
- [ ] Pause menu: resume/restart/settings return correctly
- [ ] Tutorial: all 3 guided steps complete successfully
- [ ] Tutorial completion persists after refresh and the CTA changes to replay state
- [ ] GameOver transitions to Results screen
- [ ] Saves persist after page refresh (best score, tokens, settings, themes)
- [ ] AdError/adblock shows "Ad unavailable" and game continues
- [ ] Midgame ads only appear on Results or mode switch
- [ ] Reward granted only after `adFinished`
- [ ] Continue cooldown respected across rounds
- [ ] Daily seed matches the date and is deterministic
