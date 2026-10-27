<!--
Title: <type>(<scope>): <summary>   type = feat | fix | refactor | perf | docs | chore | test | ci | revert
       imperative, lowercase, no trailing period, ≤ 72 chars. Release PRs (staging → main): "release: <yyyy-mm-dd> — <theme>"
Feature PRs target `staging`. Flow: https://github.com/utkarshpayal/period-buddy/blob/main/docs/WORKFLOW.md
Delete what doesn't apply.
-->

## Summary

<!-- What and why, in 1–3 sentences. -->

## Changes

-

## Impact

<!-- "None" where nothing applies. -->

- **Backend changes needed / merged first:**
- **Config shape changed** (also in the app's `lib/appConfig.ts` and the backend's `constants/appCatalog.js`?):
- **New or changed env vars** (Vercel, every environment):

## How to test

1.

## Checklist

- [ ] Targets `staging` (or is a `staging` → `main` release / hotfix)
- [ ] `npm run build` passes
- [ ] Tested on `staging.cms.thenura.care` and checked in a staging app build
- [ ] No secrets, `.env*` or credentials committed
