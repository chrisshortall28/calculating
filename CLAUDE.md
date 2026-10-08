# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Podium: an offline, client-only PWA (Vite + React + TypeScript, Mantine UI, Dexie/IndexedDB, pdfmake)
that roller skating competition **Calculators** use to set up events and key in judges' marks
(0.0–10.0, one decimal, stored as integer tenths). It scores each event by the **CIPA system of
scoring** and produces judge sheets and results PDFs. There is no server; data lives only on the
device, with `.pod` file export/import for backup and transfer.

## Commands

```bash
npm run dev                  # dev server, http://localhost:5173 (file watching uses polling — see vite.config.ts)
npm test                     # vitest run (all tests)
npx vitest run src/scoring   # one folder or file
npx vitest run -t "rule 3"   # tests whose name matches
npm run typecheck            # tsc -b
npm run format               # prettier --write src (singleQuote, printWidth 110, trailing commas)
npm run build:pages && npm run preview:pages   # the GitHub Pages build at http://localhost:4173/calculating/
```

There is no linter beyond `tsc` and Prettier. Tests default to the `node` environment; component
tests opt into jsdom with a `// @vitest-environment jsdom` first line (see `src/marks/MarkGrid.test.tsx`).
Every push to `main` type-checks, runs the tests and, if they pass, deploys to GitHub Pages
(`.github/workflows/deploy.yml`); other branches and pull requests are only checked (`test.yml`). Pages
serves the app from the `/calculating/` sub-path — build asset URLs from
`import.meta.env.BASE_URL`, never a leading `/`.

## Architecture

**Data flow.** `src/db/db.ts` is the Dexie schema (competitions → dances, events, skaters, judges;
events → entries, marks). An event's `discipline` is `dance` (compulsory dances + free dance) or
`figures` (Figures & Free: up to 4 compulsory figures from the built-in catalogue in
`src/domain/figures.ts`, each left/right/unspecified, plus short and/or long programmes, with
per-event `factors` in hundredths). Marks are keyed by `[eventId, segmentKey, judgeId, entryId]`,
where a `SegmentKey` is `cd:<danceId>`, `fd:A` / `fd:B`, `cf:<figureId>:<L|R|->`, `sp:A` / `sp:B` or
`lp:A` / `lp:B` (`src/domain/types.ts`; `src/domain/segments.ts` builds an event's segments,
`eventMarkKeys` and `eventTieBreakMarks`). All writes go through `src/db/repo.ts`,
which cascades deletes and touches the competition's `updatedAt`. Components read with
`useLiveQuery` hooks in `src/app/data.ts`, so writes re-render automatically — there is no other
state store.

**Scoring engine (`src/scoring/`).** Pure functions with no React or DB imports.
`calculateEvent({ entryIds, judgeIds, segments, mark, tieBreakMarks })` is the single entry point, used both by
the UI (`src/features/scoring/useEventResult.ts`) and, outside React, by the PDFs
(`src/pdf/loadEvent.ts`). It implements the 2009 CIPA manual
(`public/2009 - The CIPA System of Scoring.pdf`, rules on pages 4–13):
judge sums over the whole event (each segment × its `factor`; sums are integers in thousandths,
`SUM_PER_POINT`) → table of victories (rules 2–3, equal sums split by `tieBreakMarks` in order: the
free dance B mark; long then short programme B; none with figures) → majority victories (rule 4) →
placing (rule 5) → ties broken by 6A/6B, 7B (once per tie-break mark), 7C, 7A, then shared (8). A rule that separates tied entries places all of them in its order; only entries
still level go to the next rule. The result carries the explanation data (`steps` with each rule's
values, `judgeTies`, the victories table), and `src/scoring/rules.ts` turns it into text
(`explainStep`, `explainJudgeTie`) and labels (`ruleLabel`: 6B shows as "6B (S.M.V.)"). The README's
"Scoring rules" section is the prose version — keep the two in step.

**Where results appear.** The Results tab (`src/features/results/`) and the `standard` and
`withMarks` results PDF styles (`src/pdf/documents.ts`) must show how every tied place was
resolved: the rule number in a Rule column (blank for rule 5), with fuller explanations in the app
and in the with-marks PDF. The `guest` style shows placings only — no scores, rules or rule key. The Scoring tab shows no event result (CIPA has no per-dance places; per-judge dance rankings in the
grid are display-only).

**PDFs.** pdfmake is lazy-loaded (`src/pdf/pdfmake.ts`). `printJudgeSheets` / `printResults` in
`src/pdf/actions.ts` must be called directly from a click handler so the PDF tab opens before any
`await`. Document builders in `documents.ts` are pure and tested by flattening the content tree
to text (`src/pdf/documents.test.ts`).

**Mark entry.** `src/marks/MarkGrid.tsx` is a keyboard-driven grid (`gridNav.ts` for movement,
`parseMark.ts` for shorthand such as `57` → 5.7, `10` → 1.0, `100` → 10.0). Entry speed is the key UX
requirement; don't add steps or confirmations to mark entry.

**Import/export.** `src/io/competitionFile.ts` defines a versioned, zod-validated file format
(`FORMAT_VERSION`). A change to the stored data model needs a matching schema (and possibly a
format version) change there, plus a Dexie version bump in `db.ts`.

**Offline.** `vite-plugin-pwa` precaches everything, including PDFs in `public/`
(`workbox.globPatterns` in `vite.config.ts`); updates wait for the user to click Reload.

## Conventions

- Scoring semantics follow the CIPA manual; where it is ambiguous, ask the user rather than
  choosing a rule interpretation. Add worked cases to `src/scoring/scoring.test.ts`.
- Releasing: bump `version` in `package.json` and add an entry to `src/app/changelog.ts`
  ("What's New?" popup).
- The CIPA manual in `public/` is CIPA's document and not under Podium's 0BSD licence; link to it
  rather than copying its text into the app.
