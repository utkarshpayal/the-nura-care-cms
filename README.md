# The Nura — App CMS

A web portal for staff to change what the Nura mobile app shows, without shipping an app release.

| Page | What it controls |
|---|---|
| **Overview** | Status at a glance: what's hidden or moved, live banners, CTR, maintenance, update prompts |
| **Screens & features** | Set each feature's **launch state** (Coming soon with a Notify me sheet, Rolling out, Live, Paused with an alternative action, plus testers who always get it and optional go-live / resume times), previewed as "everyone else" or "has access". Drag any feature between **Home, Profile and the three hubs**, reorder, restyle (size, colour, text, badge), hide it, and target it (everyone / signed-in / premium / free, Android / iPhone / web, app-version range). Add your own **link tiles** that open a website, **another app** (WhatsApp, YouTube, Instagram, Play Store… with a fallback link), or any in-app screen |
| **Launches** | Every feature or link tile that's **Coming soon**, **Rolling out** (a sticky % of users, optionally only a segment / platform / version, with a BETA label) or **Paused**. One-click Launch, Pause, Resume and rollout steps, Notify me waitlist counts with CSV export, and warnings (a live banner pointing at a locked screen, a passed go-live time, a long pause) |
| **Home layout** | Order and visibility of the Home sections, including the promo slots and Shortcuts |
| **Banners & ads** | Promo cards on Home, hubs and Profile, plus a once-per-device **pop-up**. Scheduling, priority, audience, image upload, and views / taps / CTR |
| **Theme** | App colours for light and dark mode, with presets and contrast warnings |
| **App settings** | **Maintenance mode** (blocks the app) and **update prompts** (force below a minimum version, suggest below the latest) with store links |
| **History** | Every publish is saved, and any section can be restored in one click |

Launch states are designed in [docs/launch-states.md](docs/launch-states.md), which also holds the wire contract with the backend and the app.

Every page previews its changes on a phone mock-up before you publish. Saved changes reach users the next time the app refreshes its config: on launch, when it returns to the foreground, or on pull-to-refresh on Home.

Backend: [period-buddy-be](https://github.com/utkarshpayal/period-buddy-be) (`/api/cms/*` for this portal, `/api/app-config` for the app). App: [period-buddy](https://github.com/utkarshpayal/period-buddy) (`lib/appConfig.ts`).

## Access

Sign in with an Admin Workspace staff account.

- **View** needs `cms.read`, which App Admins and up have.
- **Publish** needs `cms.manage`, which App Super Admins and Super Admins have.

Every change is recorded in the Admin Workspace audit log. If two people edit the same section, the second save is refused ("reload and try again") instead of overwriting the first.

## Quick start

Requirements: Node.js 20 and npm.

```bash
npm install
cp .env.example .env      # set VITE_API_BASE_URL
npm run dev               # http://localhost:5174
```

| Key | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend URL, e.g. `http://localhost:5000` or `https://www.backend.thenura.care` |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc --noEmit`) and production build into `dist/`; also run in CI |
| `npm run preview` | Serve the built `dist/` |

## Project structure

```
src/
├── main.tsx, App.tsx      Entry, auth gate, routes
├── lib/api.ts             Backend client + types
├── lib/store.tsx          Auth + loaded CMS config (React context)
├── lib/catalog.ts         Labels, the app's palette (for previews), presets, destinations
├── components/ui.tsx      Layout, save bar, toasts, inputs
├── components/editors.tsx Audience, tap-action and icon editors
├── components/AppPreview.tsx  Phone previews of Home, hubs, Profile, banners, pop-up
├── lib/launch.ts          Launch states: labels, validation, recipes, route → feature matching
├── components/LaunchEditor.tsx  The Launch fieldset in a feature / link tile editor
└── pages/                 One file per page
```

## Deployment

Static site, same as the Admin Website. `vercel.json` rewrites every path to `index.html`.

- Set `VITE_API_BASE_URL` in the host's environment.
- Add this site's origin to the backend's `ALLOWED_ORIGINS`, or the browser will block its API calls.
