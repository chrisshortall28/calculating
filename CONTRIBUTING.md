# Contributing to Podium

Thanks for taking an interest in Podium. It's a small project maintained by one person, and its
scoring has to follow the CIPA manual exactly, so I'm keeping contributions simple:

## What helps most

- **Bug reports.** Use the bug report form. If it involves a particular competition, attach an
  exported `.pod` file with fictional names (never real skaters' details).
- **Scoring queries.** If a placing looks wrong against the
  [2009 CIPA manual](public/2009%20-%20The%20CIPA%20System%20of%20Scoring.pdf), use the scoring query
  form and say which rule you believe applies. Scoring follows the manual; where the manual is
  ambiguous I'll ask rather than guess.
- **Ideas.** Use the feature request form and describe the problem you hit at a competition, not just
  the change you'd like.

## Code pull requests

I'm not looking for code pull requests at the moment. Please open an issue first and wait for a
reply; unsolicited PRs may be closed without review. If we agree a change is wanted, the notes below
apply.

## Development notes

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run typecheck  # tsc -b
npm run format     # prettier
```

- The README's [Development](README.md#development) section and `CLAUDE.md` describe the layout.
- Scoring changes need worked cases in `src/scoring/scoring.test.ts`, and the README's "Scoring
  rules" section must be kept in step.
- A change to the stored data model needs a matching change to the import/export schema in
  `src/io/competitionFile.ts` and a Dexie version bump in `src/db/db.ts`.
- Mark entry must stay fast: no extra steps or confirmations.
- Run `npm run format`, `npm run typecheck` and `npm test` before opening a PR; CI runs the same.

## Licence

Podium is released under the [0BSD licence](LICENSE). By contributing you agree your contribution is
under the same terms. The CIPA manual is CIPA's document and isn't covered by that licence.

## Conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
