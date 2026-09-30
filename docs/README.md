# Documentation — App CMS (`the-nura-care-cms`)

This repo's docs live in this folder; [`../README.md`](../README.md) stays at
the root and covers what each page controls, access, setup and deployment.

| Doc | What's in it |
|---|---|
| [../README.md](../README.md) | Every CMS page and what it controls, who can sign in, setup, scripts, project structure, deployment. |
| [launch-states.md](launch-states.md) | Launch states (Coming soon, Rolling out, Live, Paused) and the wire contract between the CMS, the API (`/api/cms/*`, `/api/app-config`) and the app (`lib/appConfig.ts`). |
| [idea-tests.md](idea-tests.md) | Ideas tested for the CMS and what came of them. |

## Who can sign in

Any Admin Workspace staff account can try, but only these roles get in:

| Role | Access |
|---|---|
| Super Admin (`admin`) | Edit + publish (`cms.manage`) |
| App Super Admin (`app_super_admin`) | Edit + publish (`cms.manage`) |
| App Admin (`app_admin`) | View only (`cms.read`) |
| Content, clinical and doctor roles, app users | No access |

Staff sign-in security (two-step sign-in, cookie sessions) is described in the
API's [SECURITY.md](https://github.com/utkarshpayal/period-buddy-be/blob/main/docs/SECURITY.md).

## All Nura repos

| Repo | What | Its docs |
|---|---|---|
| [period-buddy](https://github.com/utkarshpayal/period-buddy) (`The-Nura-App`) | Mobile app | [docs/](https://github.com/utkarshpayal/period-buddy/tree/main/docs), including the system [ARCHITECTURE.md](https://github.com/utkarshpayal/period-buddy/blob/main/docs/ARCHITECTURE.md) |
| [period-buddy-be](https://github.com/utkarshpayal/period-buddy-be) (`The-Nura-Backend`) | API | [docs/](https://github.com/utkarshpayal/period-buddy-be/tree/main/docs), including [SECURITY.md](https://github.com/utkarshpayal/period-buddy-be/blob/main/docs/SECURITY.md) and [INFRASTRUCTURE.md](https://github.com/utkarshpayal/period-buddy-be/blob/main/docs/INFRASTRUCTURE.md) |
| [period-buddy-content](https://github.com/utkarshpayal/period-buddy-content) (`The-Nura-Admin-Website`) | Admin Workspace, clinician portal | [docs/](https://github.com/utkarshpayal/period-buddy-content/tree/main/docs) |
| [the-nura-care-cms](https://github.com/utkarshpayal/the-nura-care-cms) (`The-Nura-CMS`) | App CMS | this folder |
| [The-Nura-website](https://github.com/utkarshpayal/The-Nura-website) (`The-Nura-Marketing-Website`) | Marketing site | [docs/](https://github.com/utkarshpayal/The-Nura-website/tree/main/docs) |
