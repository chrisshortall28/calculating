## What and why

<!-- Link the issue this addresses (e.g. "Closes #123"). Please open an issue and agree the change before sending a PR. -->

## Checklist

- [ ] `npm run format`, `npm run typecheck` and `npm test` pass
- [ ] Scoring changes cite the CIPA manual rule and add worked cases to `src/scoring/scoring.test.ts`; the README "Scoring rules" section is updated
- [ ] Data-model changes update `src/io/competitionFile.ts` and bump the Dexie version in `src/db/db.ts`
- [ ] Mark entry gets no extra steps or confirmations
- [ ] User-visible changes have a `src/app/changelog.ts` entry (and a `package.json` version bump if releasing)
- [ ] Screenshots included for UI changes
- [ ] I've used fictional data only, and agree my contribution is under the [0BSD licence](../LICENSE)
