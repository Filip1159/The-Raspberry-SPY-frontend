@AGENTS.md

## Claude Code notes

- Verify changes with `npm run lint` (and `npm run build` for template/type changes) before reporting done. Karma needs Chrome, so run tests only if asked.
- Do not commit or push unless asked. Pushing to `master` redeploys the live site via GitHub Actions.
- The backend can't run on a dev laptop (it imports Raspberry Pi GPIO libraries), so end-to-end checks against the live API are done with `curl` on `https://api.filipwisniewski.pl` or by asking the user to test in the browser.
- Before starting a feature, check `BACKLOG.md` – it holds the agreed scope and decisions.
