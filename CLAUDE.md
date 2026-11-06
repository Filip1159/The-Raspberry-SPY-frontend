@AGENTS.md

## Claude Code notes

- Verify changes with `npm run lint` (and `npm run build` for template/type changes) before reporting done. Karma needs Chrome, so run tests only if asked.
- Do not commit or push unless asked. Pushing to `master` redeploys the live site via GitHub Actions.
- No Raspberry is needed for development: `npm run start:mock` runs the UI against `mock-server/`, or run the real backend with simulated hardware (`python main.py --fake`) and `npm run start:ui`. Browser checks can be scripted with headless Chrome (puppeteer-core, kept outside the repo). Only the live deployment (`https://api.filipwisniewski.pl`) needs the real Pi – use `curl` there or ask the user to test.
- Before starting a feature, check `BACKLOG.md` – it holds the agreed scope and decisions.
