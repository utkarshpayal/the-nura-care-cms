# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules (all Nura repos)

The full flow is in [docs/WORKFLOW.md](https://github.com/utkarshpayal/period-buddy/blob/main/docs/WORKFLOW.md) in the app repo. The guard hook in `.claude/hooks/guard.mjs` enforces the 🔒 rules.

1. **Branch first:** `git switch -c <type>/<name> origin/staging` (`feat`, `fix`, `chore`, `docs`, `refactor`). 🔒 No commits on `main`.
2. 🔒 **Never push to `main` or force-push `main`/`staging`.** Push your branch only when asked, then a PR goes to `staging`. `main` changes only through a reviewed `staging` → `main` release PR, or a hotfix PR (branch from `origin/main`, then merge `main` back into `staging`).
3. **Leave other people's uncommitted changes alone.** Don't commit, stash, reset or discard them; use a `git worktree` from `origin/staging` instead.
4. 🔒 **Secrets:** never read, print, copy or commit `.env*` (except `.env.example`), keystores or credentials, or read secret values from AWS. Name the key and let the person set the value. A new env var goes in `.env.example` and in every environment (prod and staging).
5. 🔒 **Production is opt-in:** read-only checks are fine. Changing AWS, Vercel, EAS production or live data needs the person's explicit go-ahead, and the hook asks each time. Do it on staging first.
6. **Verify before done:** run `npm run build` (type-check + build), the same checks CI runs. Report failures with their output.
7. **Docs in the same change:** keep this file, the API docs and the cross-repo contracts (WORKFLOW.md §7) in sync with the code.
8. **Stay in scope**, and list other problems you spot instead of fixing them unasked. Work inline: no subagents unless asked.
9. **Commits and PR titles:** `<type>(<scope>): <summary>`, imperative, lowercase, ≤ 72 characters. Fill in the PR template.

## This repo: App CMS

Staff portal that changes what the mobile app shows without a release (feature tiles, launch states, screen layouts, banners, theme, maintenance and update prompts), at `cms.thenura.care` (staging: `staging.cms.thenura.care`). React 18 · TypeScript · Vite 6. Frontend only, over `period-buddy-be`'s `/api/cms/*`; the app reads the result from `/api/app-config`. How it fits the system: [ARCHITECTURE.md](https://github.com/utkarshpayal/period-buddy/blob/main/docs/ARCHITECTURE.md). Detail: `README.md`, `docs/launch-states.md` (the wire contract with the backend and app).

```bash
npm install
npm run dev       # http://localhost:5174
npm run build     # tsc --noEmit + vite build; this is the CI check
```

- **Backend:** `src/lib/api.ts`. `VITE_API_BASE_URL` wins if set; otherwise `VITE_APP_ENV` (`prod` | `stage`) picks `https://www.backend.thenura.care` / `https://stage.backend.thenura.care`, and on Vercel it defaults from `VERCEL_ENV` (Production → prod, Preview → stage; see `vite.config.ts`). Any non-prod backend shows a Staging / Local / Custom backend pill in the header.
- **Layout:** `src/lib/api.ts` (client and types), `src/lib/store.tsx` (auth and loaded config), `src/lib/catalog.ts` (labels, palette, presets), `src/lib/launch.ts`, `src/components/AppPreview.tsx` (phone previews), `src/pages/` (one per page).
- **Contract:** the config shape is shared with the app (`period-buddy` `lib/appConfig.ts`, `FEATURE_REGISTRY`) and the backend (`constants/appCatalog.js`). A new feature key or field must land in all three, and unknown keys are ignored by the other side.
- **Access:** `cms.read` views, `cms.manage` publishes. Saves are optimistic-locked: a stale edit is refused, never merged.
- **PWA:** bump `CACHE` in `public/sw.js` to force installed copies to refresh.
- **Deploy:** Vercel; `main` → production, `staging` → staging. Each site's origin must be in the matching backend's `ALLOWED_ORIGINS`.
