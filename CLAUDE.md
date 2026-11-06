@AGENTS.md

## Claude Code notes

- Verify changes with `npm run lint`, `npm run test:ci` and, for template/type/route changes, `npm run build && npm run check:build` before reporting done (this is what CI's `verify` job runs; `npm run e2e` is the other CI job and needs Playwright's Chromium).
- Do not commit or push unless asked. Pushing to `master` redeploys the live site via GitHub Actions.
- No Raspberry is needed for development: `npm run start:mock` runs the UI against `mock-server/`, or run the real backend with simulated hardware (`python main.py --fake`) and `npm run start:ui`. Browser checks can be scripted with headless Chrome (puppeteer-core, kept outside the repo). Only the live deployment (`https://api.filipwisniewski.pl`) needs the real Pi – use `curl` there or ask the user to test.
- Before starting a feature, check `BACKLOG.md` – it holds the agreed scope and decisions.
