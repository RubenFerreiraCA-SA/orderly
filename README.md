# Orderly

A personal life operating system — turn messy thoughts into the next 3 useful actions.

## Run locally

```bash
pnpm install
pnpm start
```

Open [http://localhost:4200](http://localhost:4200).

## Build

```bash
pnpm run build
```

## Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Add a **Web app** and copy the config object
3. Paste the values into `src/environments/environment.ts` (and `environment.prod.ts` for production builds)
4. Enable **Authentication → Google**
5. Create a **Firestore** database
6. Install the Firebase CLI and link the project:

```bash
npm install -g firebase-tools
firebase login
firebase use --add    # select your project — this writes .firebaserc
```

7. Deploy security rules:

```bash
pnpm run firebase:deploy:rules
```

8. Restart the dev server, open **Settings**, and sign in with Google

On first sign-in, your account is seeded with the demo actions, goals, and brain dumps. After that, all changes sync to Firestore under `users/{uid}/`.

## AI setup (Gemini 2.0 Flash Lite)

Orderly uses **Gemini 2.0 Flash Lite** via Firebase Cloud Functions — Google's lowest-cost capable model for structured JSON tasks. Typical cost: fractions of a cent per brain dump.

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Store it as a Firebase secret (never in the Angular app):

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

3. Install function dependencies and deploy:

```bash
cd functions && npm install && cd ..
pnpm run firebase:deploy:functions
```

4. Sign in to the app — brain dump, daily plan, and weekly review will use Gemini automatically

If Cloud Functions are unavailable, Orderly falls back to the local parser.

### Deploy hosting (optional)

```bash
pnpm run build
firebase deploy --only hosting
```

## MVP features

- **Dashboard** — Today's Top 3, quick capture, active goals, focus area
- **Brain Dump** — Capture raw thoughts or full annual plans; process with Gemini AI
- **Daily Plan** — AI-generated Top 3 from goals and open actions
- **Actions** — Filter, group, mark done/park, promote to Top 3
- **Goals** — View goals grouped by life domain
- **Weekly Review** — Wins, stalled items, focus areas for next week

## Architecture

```
src/app/
  core/
    firebase/     # Firestore path helpers
    models/       # Shared TypeScript interfaces
    data/         # Mock seed data (first-login bootstrap)
    services/     # Auth, brain dump, goals, actions, AI planning
    guards/       # Auth guards
  layout/         # App shell, sidebar, topbar
  pages/          # Route-level page components
  shared/         # Reusable UI components
src/environments/ # Firebase config
```

Services use Angular signals. When Firebase is configured, data persists to Firestore per user. Without config, the app falls back to in-memory mock data.

## Tech stack

- Angular 19 (standalone components, signals)
- Firebase (Auth + Firestore + Cloud Functions via `@angular/fire`)
- Gemini 2.0 Flash Lite (via Cloud Functions)
- TypeScript
- SCSS
- PWA-ready manifest (service worker not yet configured)

## Product principle

> What matters now, and what can safely wait?

Not a guilt-driven productivity app — a calm personal command centre.
