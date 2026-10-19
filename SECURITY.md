# Security Policy

## What Podium is

Podium is an offline, client-only web app. There is no server, no account system and no network
service: competition data lives in the browser's IndexedDB on your own device, and the only thing
that leaves it is a `.pod` file you export yourself. Security issues are therefore most likely to be
things like:

- a crafted `.pod` (or older `.json`) file that, when imported, runs script, corrupts data or
  crashes the app
- cross-site scripting through names or other text that ends up in the app or in a generated PDF
- a problem with the service worker or cached files that serves tampered content
- a vulnerable dependency that is actually reachable from the app

Scoring mistakes (wrong placings) are important but are not security issues: please use the
[scoring query](https://github.com/chrisshortall28/calculating/issues/new/choose) issue form instead.

## Supported versions

Only the latest release, as deployed at <https://chrisshortall28.github.io/calculating/>, is
supported. Fixes go out as a new release; the app offers a Reload button when an update is ready.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

1. Preferred: use GitHub's
   [private vulnerability reporting](https://github.com/chrisshortall28/calculating/security/advisories/new)
   ("Report a vulnerability" on the repository's Security tab).
2. Otherwise email chrisshortall28@gmail.com with "Podium security" in the subject.

Please include what you found, the steps or file needed to reproduce it, the browser and Podium
version (shown in the What's New popup), and what you think the impact is. Don't include real
skaters' personal data; use the demo competition in `examples/` where you can.

## What to expect

This is a small, volunteer-run project. I aim to acknowledge a report within about a week, to tell
you whether I can reproduce it, and to release a fix as soon as is practical. I'm happy to credit
you in the release notes unless you'd rather stay anonymous. Please give me reasonable time to fix
the problem before disclosing it publicly.
