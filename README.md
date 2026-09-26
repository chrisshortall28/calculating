# Podium

Offline web app for running roller skating competitions. **Calculators** set up events,
skaters, dances and judges, then enter judges' marks on the day. Podium ranks each event
using majority-of-placings rules (White / CIPA system) and produces judge sheets and
results as PDFs.

- Runs entirely in the browser (installable PWA). Data lives in IndexedDB on the device,
  and there is no server.
- **Export file** (on each competition) saves a `.pod` backup (JSON inside), and **Import** restores it (older `.json` backups still import).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # scoring engine, mark parser, grid navigation, import/export
npm run typecheck
npm run build      # production build + service worker in dist/
npm run build:pages && npm run preview:pages   # the GitHub Pages build, at http://localhost:4173/calculating/
npm run generate-icons                         # regenerate PNG icons after changing public/favicon.svg
```

## Deployment and installing

Every push to `main` runs the tests and deploys to GitHub Pages
(`.github/workflows/deploy.yml`): **https://chrisshortall28.github.io/calculating/**

One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

To install on the competition laptop, open the URL while online in Chrome or Edge and use
**Install Podium** (the install icon in the address bar). The app then works fully offline.
When a new version is deployed, the app shows "Update available" the next time it starts
online; nothing changes unless the Calculator clicks Reload.

To release a new version, bump `version` in `package.json` (shown in the status bar) and add an
entry to `src/app/changelog.ts` (shown in the "What's New?" popup when the version is clicked).

## Layout

| Path | What |
| --- | --- |
| `src/scoring/` | **Pure scoring engine**, with no React or DB code. `calculateEvent()` turns marks into placings and explanations. |
| `src/marks/` | Mark parsing (`57` → 5.7) and the keyboard-driven mark-entry grid. |
| `src/domain/` | Types, segments (compulsory dances and the free dance's A/B marks), entry display helpers. |
| `src/db/` | Dexie schema and repository functions, which cascade deletes of marks. |
| `src/io/` | Competition file export/import (versioned, validated with zod). |
| `src/pdf/` | Judge sheets and results PDFs (pdfmake, lazy-loaded). |
| `src/features/` | Screens: home, competitions, events, rosters, scoring, results. |

## Scoring rules (initial approximation, to be checked against the CIPA rulebook)

1. **Judge ordinals**: for each dance, each judge's marks are ranked (1 = best). The free
   dance uses A+B, and a tie is split by the B mark. Any remaining tie shares the better ordinal.
2. **Majority**: for place *n*, find the entries that a majority of judges (⌊judges/2⌋+1)
   placed *n*th or better, widening the column until at least one qualifies.
3. **Tie-breaks**, applied in order when several qualify together (`src/scoring/tieBreaks.ts`):
   greater majority → lower sum of the majority places → higher total points. If entries are
   still tied, they share the place.
4. **Combining dances**: lowest sum of dance places wins. Ties go to the better free dance place,
   then higher total points.

Rules are data plus pure functions (`ScoringConfig`), so they can be reordered or replaced
without touching the UI. Add worked examples from the rulebook to
`src/scoring/scoring.test.ts`.

## Licence

Podium is free to use, copy, modify and share for any purpose, under the [BSD Zero Clause
License](LICENSE). The open-source packages it is built on keep their own (permissive) licences;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
