# Backlog

Shared backlog for both repos (`The-Raspberry-SPY-frontend` and `The-Raspberry-SPY-backend`). Tags: **[FE]** frontend, **[BE]** backend. Priorities: P0 do first, P1 next, P2 nice to have. Tick items off and move decisions into `AGENTS.md` when they change how the project works.

## Suggested order

1. ✅ P0 B1 (socket auth) and B2 (offline handling)
2. ✅ E4 (run both apps without a Raspberry) – unblocks local development and testing of everything below
3. ✅ Portfolio restructure (F1) – everything else (UI, SEO) builds on the new page structure
4. ✅ SEO (F3)
5. ✅ B3 (backend hardening)
6. ✅ Design pass (F2)
7. ✅ E1 (tests and CI)
8. ✅ E2 frontend cleanups (mostly), Vitest, Playwright + axe
9. **Now:** E5 backend FastAPI migration (side by side), then E3 cleanups on the new code, then P2 ideas

---

## P0 – before anything else

### B1. Authenticate Socket.IO [BE][FE] ✅ implemented

The site is public, but Socket.IO used to have no auth: anyone could connect and emit `message` to move the servos or change the camera light. Now:

- [x] BE: the JWT is required in the connection handshake (`auth: { token }`), verified with the RS256 public key; otherwise the connection is refused with `unauthorized`. The token expiry is tracked per session, and `message` events from an expired session disconnect the client.
- [x] Decision: **everything on the socket is behind login**, including stats (`system_stats_update`, `ble_update`). The public portfolio opens no websocket.
- [x] FE: `SocketService` is created with `autoConnect: false`, passes the current token (also on reconnects), connects/disconnects with the token signal, logs out on `unauthorized`, and its `emit` is a no-op while disconnected.
- [x] FE: header `Stats` renders only when logged in; stats components unsubscribe on destroy.
- Follow-up: connected sockets keep receiving the 5 s stats broadcast until the client disconnects (the frontend disconnects on logout/expiry). If that matters, move authenticated sessions into a Socket.IO room and `emit(..., to=room)` from `main.py`.
- Follow-up (B2): surface socket `connect_error` / `disconnect` in the backend status banner.

### B2. Handle "Raspberry is probably switched off" [FE][BE] ✅ implemented (portfolio part pending)

- [x] BE: `GET /health` (no auth) returns `{"status": "ok"}`; reachable at `/flask/health` through nginx.
- [x] FE: `BackendStatusService` (`checking | online | offline` signal) pings `/health` on start, with a 5 s timeout, and while offline repeats every 15 s until the Pi is back. The Socket.IO connect, connect error and unexpected disconnect events trigger a health re-check (a deliberate disconnect such as logout does not).
- [x] FE: `backendStatusInterceptor` marks the backend offline on network errors (status 0) and on 502, 503, 504, 521-524 and 530 (Cloudflare when the tunnel is down), and online on any successful API response. 401 and other 4xx are not treated as offline.
- [x] FE: global `backend-status-banner` with "Retry now"; login shows the offline message instead of "Wrong credentials" and disables submit; greetings and alarms disable submit, and alarms reload automatically after the Pi comes back; the stream page disables "Camera ON" while offline.
- [x] FE: `<video>` errors show a message and a Retry button, and trigger a health check to tell "Pi offline" from "stream not available".
- [x] FE: the portfolio page works with the backend down and shows a live "Pi online/offline" badge in the Raspberry SPY section (done with F1).
- [x] FE: the control pad and brightness slider are disabled with an explanation while offline or reconnecting (done in F2).
- [ ] FE: replace the remaining `alert()` calls with toasts (F2).

### B3. Basic backend hardening [BE][FE] ✅ implemented (token refresh pending)

- [x] Passwords in `users.json` are salted scrypt hashes (werkzeug) compared in constant time; unknown usernames burn a dummy hash check so timing does not reveal valid names. An old plain-text file is migrated automatically on startup; `scripts/manage_users.py` lists/adds/changes users (minimum 10 characters).
- [x] Rate limiting with Flask-Limiter (in memory, keyed by `CF-Connecting-IP`): failed `POST /login` attempts 5/min and 20/h, `POST /greetings` 3/min and 20/h; the 429 answer is JSON and carries the CORS header, so the UI can tell "too many attempts" from "the Raspberry is off". Verified over real HTTP, including that other visitors and successful logins are not affected.
- [x] Greetings: text limited to 500 characters (also `maxlength` in the form), whitespace-only and non-JSON bodies rejected, only the latest 1000 are kept, writes are locked and atomic. `GET /greetings` now requires a JWT.
- [x] `POST /alarms/play` validates the melody (400 instead of an exception); request bodies are capped at 64 KiB; JSON endpoints no longer crash on non-JSON bodies.
- [x] Bug found on the way: saving alarms through `POST /alarms` never reloaded the scheduler, so the new times only applied after a Flask restart. It now reloads.
- [x] Frontend: login shows distinct messages for wrong credentials, too many attempts, offline and other errors; the greeting form shows a "too fast" message on 429; the mock server mirrors the new contract (`GET /greetings` needs a token, 500-character limit; `failWith: 429` simulates the limit).
- [ ] **Manual:** add the Cloudflare rate-limiting rule described in `configs/CONFIGS.MD` as a second layer.
- [x] Refresh tokens: httpOnly, Secure, SameSite=Strict cookie (7 days, random, only hashes stored in `resources/refresh_tokens.json`), `POST /refresh` rotates it (30 s grace for tabs refreshing together), `POST /logout` revokes it. The UI renews the 30 minute access token 60 s before it expires, restores a session after the tab was closed, and the socket reconnects with the new token. The access token stays short-lived (30 min) because it also goes into the HLS URL. `/refresh` is rate limited (30/min per visitor) and `scripts/manage_users.py add` on an existing user revokes that user's sessions. Open: a video that plays longer than 30 min keeps its old URL token (unverified whether MediaMTX re-checks it for segments).
- [x] ~~The JWT in the HLS URL query string~~: the stream now uses a 2 minute stream-only token. The login JWT still lives in `localStorage` (E2).
- [ ] Rate limits survive restarts only with a persistent store (Redis/file); not needed for a single Pi unless the process restarts often.

---

## P1 – requested features

### F1. Portfolio restructure [FE] ✅ implemented (content to be reviewed)

Turn `/` (About me) into a personal **portfolio**, and keep the existing header + tabs design only for authorized users.

**Information architecture (proposal)**

```
/                  public portfolio (own minimal top bar: About · Experience · Projects · Contact; NO app header, NO stats, NO socket)
/login             public, simple standalone page (linked from the portfolio footer and from the Raspberry SPY project card)
/app/video         authorized – existing header + tabs
/app/alarm         authorized
/app/stats         authorized (replaces /mobile-stats)
```

- Public tabs that exist today and where they go: **About me** -> becomes `/` itself; **Greet me** -> embedded as a "Say hi" widget in the Raspberry SPY project section and/or contact section (hidden/disabled when the backend is offline, see B2); **Login** -> small "Sign in" link in the portfolio footer/nav plus a button on the Raspberry SPY card ("Open the control panel").
- Authorized shell: current `Header` + `MobileNav` + `Stats`, wrapped in a layout route (`/app` with `authGuard` on the parent) so the portfolio never renders them.
- Keep redirects for old URLs (`/video`, `/alarm`, `/greetings`, `/mobile-stats`) so existing bookmarks keep working.
- Lazy-load the `/app/*` routes so the portfolio bundle stays small.
- [x] Layout routes + route reshuffle: `/` portfolio, `/login`, guarded lazy `/app/*` shell, redirects for the old URLs, wildcard to `/`. (`AuthService.logout()` still goes to `/login`.)
- [x] New portfolio page with its own fixed nav and anchors (hero, about, skills, projects with the Raspberry SPY featured, beyond code, contact), responsive down to phone width. The public page opens no websocket and loads no socket.io code.
- [x] Stale repo links fixed. "Greet me" is an embedded widget in the Raspberry SPY section; "Sign in" is in the nav, the project card and the footer.
- [x] The hardcoded "24 year old" text is gone.
- [x] Raspberry SPY section shows a live online/offline badge (re-checked every 30 s) and keeps working when the backend is down.
- [ ] Review the draft copy (`portfolio.data.ts`, `portfolio.html`): it only uses facts from the GitHub profile, but the wording, the project selection and the order are a first proposal.
- [x] `me.jpg` is served as WebP 400/800 with `srcset` (done in F3; AVIF would save little more).
- [ ] Add screenshots/GIFs for the other projects (Gadget, Connect Messenger, Macau): needs images from Filip.
- [x] The login page got the card layout in F2.

**Content, based on https://github.com/Filip1159** (verify and edit wording – nothing below is invented text for publication, just material found on the profile)

- Headline: Software Engineer at **Ocado Technology** (since 2022), Wrocław University of Science and Technology graduate, private programming tutor, electronics enthusiast. Location on profile: Trzebnica, Poland.
- Professional stack (from the profile README): Java, Spring, AWS, Gradle, Docker, PostgreSQL, GraphQL, Terraform, TypeScript, React, Redux, Vite, Material UI; uses Claude and Playwright.
- Personal/hobby stack: C, C++, Arduino, Raspberry Pi, Python, PyTorch, Flask, Angular, Vue; ESP32, STM32; Autodesk Fusion + Bambu Lab (3D printing).
- Featured projects (public, non-fork repos):
    - **The Raspberry SPY** (this project): Pi 5 camera with HLS stream, pan/tilt servos, alarm clock, LCD + encoder UI, BLE climate monitor. Angular + Flask + MediaMTX + nginx + Cloudflare Tunnel. Link the Makerworld 3D model and photos from `img/`.
    - **Gadget** – 2-wheeled ESP32 exploring robot: `Gadget-firmware` (Arduino Nano ESP32, per-wheel PID on FreeRTOS, 10 VL53L0X distance sensors, WebSocket control, OTA) and `Gadget-UI` (browser control panel with live canvas).
    - **BLE-Climate-Monitor** – ultra low power temp/humidity sensor (ATmega328P, HM-10 BLE, DHT22, high-side switching, deep sleep); feeds the Raspberry SPY stats.
    - **Connect Messenger** (`-frontend` Angular, `-backend` Java) – real-time chat with groups, photos, emoji reactions.
    - **Macau card game** – Angular card game vs a bot, three difficulty levels.
    - **Boardgame-search** – Java MinMax / alpha-beta library with othello and chess (JavaFX) on top.
    - Smaller embedded work: `Snake-EX2-AVR`, `Raspberry-Pico-Paint`, `STM32-NRF-lib`, `MAX-3-SAT-optimizer` (evolutionary algorithm), `openaigym-playground`.
- Links already used on the site: GitHub, LinkedIn, Chess.com, Duolingo.
- Sections: hero (photo, one-liner, CTA buttons), About, Experience/skills, Projects (cards with stack tags + repo/demo links, Raspberry SPY featured), Hobbies (3D printing, chess, languages), Contact.
- [ ] **Open questions for Filip** (answered provisionally so far): contact channel = LinkedIn + GitHub only (no e-mail); no CV download; employer shown by name only as on the GitHub profile; featured projects = Raspberry SPY plus the six cards; English only.

### F2. Better UI/UX [FE] ✅ implemented (polish pending)

Verified in headless Chrome (light and dark, desktop and 390 px phone), with the axe accessibility engine reporting no violations on any page, and 38 unit tests.

- [x] Design tokens as CSS variables in `styles.scss` (colors, radius, shadow, focus ring) with a **dark mode**: follows the OS, plus a toggle (portfolio nav, login, header) whose choice is stored and applied before the first paint.
- [x] One set of shared components/classes (`.button` variants, `.card`, `.field`, `.chip`, `.notice`, `.spinner`, `.skeleton`) replaces the per-page blue/orange styles; the red header and tabs keep their look (active tab underline added).
- [x] `alert()` is gone: `ToastService` + `<toasts>` (greeting sent/failed, alarms saved, melody played, session expires in 15 s / expired).
- [x] Login: card layout, labels, show/hide password, `autocomplete`, Enter submits, submitting state, errors in a `role=alert` region that separate wrong credentials / too many attempts / offline / other.
- [x] Live stream: explicit camera states (off / connecting / live / error) with overlays, LIVE chip, camera on/off, fixed press-and-hold buttons (pointer events; the old mouse+touch handlers started two timers on touch devices), arrow keys + `C`, controls and slider disabled with an explanation when the Raspberry is offline or the socket is reconnecting, labelled slider with percentage.
- [x] Alarms: card per day with an on/off switch, native time input, melody select and play button; loading skeleton, error state with retry (auto-reload when the Pi is back), unsaved-changes bar with Save/Discard, confirmation before navigating away and before closing the tab.
- [x] Stats: the header dropdown is replaced by the `/app/stats` dashboard for all screen sizes: CPU, temperature (warm/hot hints), memory with meters, climate card, sparklines with 60 samples of history, Live/Reconnecting chip, "updated N s ago", warnings for stale data and a silent BLE sensor.
- [x] Accessibility: landmarks and `main` ids with skip links, `aria-current` on the active tab, labelled icon buttons, live regions for statuses, visible focus, `prefers-reduced-motion`. Lighthouse accessibility 100 on the portfolio.
- [x] Mobile pass on every page (compact header with theme toggle and sign out, bottom navigation, save bar above it).
- [x] Session expiry modal: not needed anymore, the session renews itself (see B3); the expiry notice only appears when the refresh cookie is gone.
- [x] Stats history: the backend keeps the last 120 samples (10 min, in memory) and serves them at `GET /stats/history` (JWT); `StatsService` seeds the sparklines with them, so a reload no longer empties the charts (mock server, contract test, unit and E2E tests included). Not persisted across a backend restart.
- [ ] Stats: longer history (SQLite, see P2 uptime/history) and thresholds for the sensor battery once the battery type is known.
- [x] Stream: "Buffering..." overlay while a live stream stalls (`waiting` event), a Snapshot button (saves the current frame as PNG; toast when the browser refuses because of CORS) and a Fullscreen button for the frame with its overlays. Not verified against the real HLS stream: if MediaMTX does not send CORS headers for the video the snapshot shows the error toast.
- [x] Portfolio polish: sections fade in on scroll with a pure-CSS scroll-driven animation (`animation-timeline: view()`, only where supported and not with `prefers-reduced-motion`; nothing to hydrate).
- [ ] Portfolio polish still open: project screenshots (need images from Filip) and a light/dark preview image for social cards (platforms show one static `og-image.jpg`, so this is probably not worth it).
- [x] ~~Visual regression screenshots~~ dropped (decision: not worth the baseline maintenance; axe covers both themes).

### F3. SEO [FE] ✅ implemented (manual submission and polish pending)

The site was a client-rendered SPA on GitHub Pages; the `404.html` trick made Pages answer HTTP 404 for every non-root URL. Now:

- [x] `index.html`: title, meta description, canonical, `theme-color`, Open Graph + Twitter card tags with a 1200x630 preview image, favicon set (`.ico`, svg, 32 px png, apple-touch-icon), `site.webmanifest` with 192/512 icons.
- [x] Per-route titles (route `title`) and `noindex, nofollow` on `/login` and `/app/*` through `SeoService` (route `data: { noindex: true }`). Only `/` is indexable, so no per-route descriptions are needed yet.
- [x] The portfolio is pre-rendered at build time (`@angular/ssr`, static output, hydration): crawlers get the full HTML with a real 200. `index.csr.html` is copied to `404.html` for `/login` and `/app/*` only.
- [x] `public/robots.txt` (disallows `/app/` and `/login`, links the sitemap) and `public/sitemap.xml`.
- [ ] **Manual:** add `https://filipwisniewski.pl` to Google Search Console and Bing Webmaster Tools, verify the domain (DNS TXT record in Cloudflare) and submit the sitemap.
- [x] Structured data: JSON-LD `WebSite` + `Person` (name, job title, employer, university, GitHub/LinkedIn as `sameAs`) in `index.html`. Also nine `SoftwareSourceCode` entries (repository, language, description, author) for the featured projects.
- [x] Performance: Roboto self-hosted (no Google Fonts requests), photos as WebP + JPEG fallback with `srcset`/`sizes`, explicit width/height, `fetchpriority="high"` on the hero image, lazy images below the fold, lazy `/app` routes, health check deferred to idle time, stylesheet budget raised to 4/8 kB.
- [x] Semantic HTML: one `h1`, ordered headings, alt texts, links with distinct accessible names.
- [x] One canonical host: apex domain (GitHub Pages redirects `www`).
- **Lighthouse (local, production build):** desktop performance 97, accessibility 100, best practices 96\*, SEO 100. Mobile with real network throttling: performance 100 (FCP 0.8 s, LCP 1.9 s). Mobile with Lighthouse's default _simulated_ slow-4G: performance 75, accessibility 100, SEO 100 – the simulator penalizes the ~366 kB initial JS chunk (observed FCP/LCP on this machine are 265 ms). \*The best-practices deduction comes only from the local test: the page on `localhost` cannot call the real API because of CORS.
- [x] Initial JavaScript cut from 455 kB (126 kB transferred) to 342 kB (98 kB): the login page is lazy-loaded, the greeting form is behind `@defer (on viewport)`, and the portfolio plus theme toggle draw their icons with a tiny SVG `Icon` component (FontAwesome icon data, no `fontawesome-svg-core`/`angular-fontawesome` runtime in the first load; the signed-in area still uses `<fa-icon>`). Lighthouse mobile (default simulated slow 4G, served with gzip like GitHub Pages) now scores 91 (FCP 2.0 s, LCP 3.3 s, TBT 0); note that an uncompressed local server scores ~75. The remaining first-load weight is Angular itself (core + router).
- [ ] Re-run Lighthouse against production after the first deploy (real TLS, HTTP/2, caching headers from GitHub Pages).

---

## P1 – engineering health

### E1. Tests and CI [FE][BE] ✅ implemented (E2E and thresholds pending)

- [x] FE: the test runner works. `ng test` now uses `@angular/build:unit-test` with the Karma runner and `runnerConfig: karma.conf.js` (fixed: no `kjhtml`, a `ChromeHeadlessCI` launcher with `--no-sandbox`); `npm run test:ci` runs everything once with a coverage summary. The old `build-angular:karma` target never found a single spec.
- [x] FE: 92 specs (was 4, two of them failing), 86% line coverage: `AuthService` (token expiry, warning toast, logout), `authGuard`, `RaspberryApi`, backend status service + interceptor, stats/theme/toast/SEO services, route table (guard, legacy redirects, noindex, titles), login (every error path), greetings, portfolio, stream page (keyboard steering, disabled controls, error state), alarm manager (dirty/discard/save/failed save), alarm card, toasts, theme toggle.
- [x] FE: one pipeline in `ci.yml`: lint, tests with coverage artifact, production build with pre-rendering, `scripts/check-build.mjs` (fails when the portfolio is not pre-rendered or CNAME/robots/sitemap/meta tags are missing), then the Pages deploy **only if everything passed** (`deploy.yml` removed). Dependabot for npm (Angular packages grouped) and Actions.
- [x] BE: pytest suite (65 tests: API, JWT/CORS, socket auth, security, hardware fakes, scheduler) and a CI workflow with ruff, pytest and a coverage report (79%, the Pi-only `hardware/raspberry.py` is excluded); Dependabot for pip and Actions.
- **Bugs the new tests found and fixed:**
    - The scheduler ignored the `enabled` flag, so alarms switched **off** still rang.
    - An empty alarm list (or none enabled) crashed `AlarmManager` at import, which would have stopped the whole backend from starting. No thread waits now when nothing is enabled; entries without the flag keep ringing.
    - `Greetings`'s counter and Send button did not refresh after programmatic changes (zoneless change detection); it now reads a signal.
    - The key handler of the stream page crashed on events without a target.
- [x] First CI run on GitHub passed (verify 54 s, e2e 54 s, deploy 15 s).
- [x] FE: `SocketService` is tested (token-driven connect, handshake auth, `unauthorized` logout, offline probing, emit guard; the socket comes from an injectable `SOCKET_FACTORY`) and `karma.conf.js` enforces coverage thresholds (80% statements/lines, 70% branches, 72% functions; now 86/89/73/75). Open: BE threshold, tests for `mock-server`.
- [x] FE: Playwright E2E suite (28 test runs: 14 desktop flows, axe on every page in light and dark on desktop and a Pixel 7 phone, phone layout checks; ~16 s, `npm run e2e`) against the mock server: portfolio offline, theme persistence, login/logout/guard, wrong password, 429, session reload, stats over the socket, alarm save/discard, camera controls, offline banner and recovery. Own `e2e` job in CI; deploy waits for it. The axe run found a real contrast problem (inactive bottom-nav labels in the light theme), fixed.
- [x] Contract test (`npm run contract`, `scripts/contract-test.mjs`): 11 checks of the REST and Socket.IO contract (status codes, error body shapes `{msg}` / `{error}`, JWT claims, alarm/greeting validation, socket handshake, stats events). Passes against `mock-server` and the FastAPI backend in fake mode. Not in CI yet: it needs both repos checked out.
- [x] Karma/Jasmine replaced by Vitest + jsdom (`runner: vitest` in `angular.json`): the suite runs in ~2 s without a browser; `karma*`, `jasmine*` and `@angular-devkit/build-angular` are gone (the app builds with `@angular/build`). Coverage thresholds moved to `coverageThresholds` in `angular.json` (v8 numbers: 82% statements, 80% lines, 86% branches, 83% functions).
- [x] BE: CI runs the suite on Python 3.11 and 3.13 (both pass locally), and `tests/test_raspberry_hardware.py` covers `hardware/raspberry.py` (92%) with mocked `gpiozero`/`RPLCD`/`bleak`/`rpi_hardware_pwm`; the coverage `omit` is gone.

### E2. Frontend cleanups [FE]

- [x] `authInterceptor` attaches the bearer token and signs the user out on 401 (with a toast); `RaspberryApi` no longer takes tokens (spec added).
- [x] Stats subscriptions live in the root `StatsService` (one subscription per event for the app's lifetime, signals for the page); the old `effect()` subscriptions are gone.
- [x] `npm start` serves on localhost (no hardcoded host); running against the Pi is documented in `AGENTS.md`. Still open: the Pi's LAN IP stays in `environment.ts`.
- [x] File and class naming unified: no more `*.component.*` files or `…Component` classes (`alarm.ts` exports `AlarmCard`). Selectors left as they are (mix of `app-*` and plain) on purpose.
- [x] README: current features, development commands, CI/deploy notes.
- [x] Don't pass the login JWT in a query string: done with the 2 minute stream token (`POST /stream-token`).

### E3. Backend cleanups & ops [BE]

- [x] Hardcoded paths: all of them live in `app/config.py` now (env overridable, done with E4); no `/home/fwisn` or relative data paths are left.
- [x] The committed virtualenv is gone: untracked and gitignored (`bin/`, `lib64`, `pyvenv.cfg`), the Pi runs from `.venv` (`scripts/setup_venv.sh`), ruff targets py311 (Pi 3.11.2, CI 3.11).
- [x] The backend runs as a `systemd` service: `configs/raspberry-spy.service` (template), `scripts/install_service.sh` (fills in user/checkout/python, enables, starts; `--print` to preview) and `scripts/deploy.sh` (pull, install changed requirements, restart, wait for `/health`), documented in `configs/CONFIGS.MD`. Not run on the Pi yet (the unit was only rendered here). `cloudflared` already is a service; nginx is enabled on boot.
- [x] MediaMTX runs as a `systemd` service too: `configs/mediamtx.service` and `scripts/install_mediamtx_service.sh` (copies `configs/mediamtx.yml` to `/mediamtx`, installs and restarts the unit; `deploy.sh` reminds you when the config changed). Not run on the Pi yet.
- [x] `AlarmManager.reload()` no longer deadlocks when a reload coincides with an alarm ringing: reloads are serialized by their own lock, the old thread is joined **outside** the lock that guards the schedule, and every scheduler thread has its own stop event (regression test `test_reloading_while_an_alarm_is_ringing_does_not_deadlock`, verified to fail on the old code). Matters most for the FastAPI version, where a stuck reload would hold a worker thread of the pool.
- [x] BLE robustness: `app/climate.py` parses packets without raising (format and plausible ranges checked, bad packets logged, previous values kept), the scan loop catches everything (adapter off, bluez restart) and retries after 5 s with `logging` instead of `print`. `ble_update` has a new `stale` flag (no reading yet or older than `CLIMATE_STALE_SECONDS`, default 300); the UI does not use it yet. Verified with mocked bleak, not on the real sensor.
- [x] ACT LED without sudo: direct sysfs writes (`app/hardware/sysfs_led.py`), permission via `configs/99-act-led.rules` (udev, group `gpio`); without it the LED is left alone with one log warning. **Manual on the Pi:** install the rule (steps in `configs/CONFIGS.MD`); not run on real hardware yet.
- [x] Arduino websocket manager: kept but **off by default** (`ARDUINO_WEBSOCKET=1` enables it; it listens on all interfaces without authentication), `send()` is awaited and thread-safe sending exists, `logging` instead of `print`. Still only logs what the Arduino sends: remove it if the Uno R4 idea is dead.
- [x] No dead code left in `app/gpio/`; no `print` calls in the app.
- [x] Greetings and alarms JSON writes (HTTP) are locked and atomic (`app/json_store.py`); `AlarmManager.save_day` (LCD) still writes directly.

### E5. Backend: move from Flask to FastAPI [BE] ✅ done (follow-ups open)

Decision: rewrite the backend with FastAPI in the same repo, keeping the API contract unchanged so the frontend needs no change.

- [x] Side-by-side implementation in `app/api/` (REST routers, RS256 JWT dependency, rate limits with the `limits` library, Socket.IO through python-socketio's ASGI app, lifespan that starts the hardware), entry point `main_fastapi.py`, shared validation in `app/validation.py` (also used by Flask), 57 new tests (122 total) that mirror the Flask tests, smoke-tested with the real JavaScript socket.io client (handshake auth, controls, stats broadcast).
- [x] Cutover prepared: `python main.py` is the FastAPI app (the Flask version stays as `main_flask.py` for rollback), nginx serves `/api` and the old `/flask` alias, the frontend calls `/api`, docs updated (`configs/CONFIGS.MD` has the Pi steps). Deploy order: backend + nginx on the Pi first, then the frontend.
- [ ] Verify on the Raspberry for real (`git pull`, `pip install -r requirements-raspberry.txt`, `python main.py`): nothing hardware-related could be exercised off the Pi (uvicorn + LCD thread + GPIO + BLE thread together, `asyncio.to_thread` for servos).
- [x] Flask removed (`main_flask.py`, `app/server.py`, `app/controller/`, `app/rate_limit.py`, Flask requirements, Flask-only tests, the `/flask` nginx alias): 89 tests, `requirements.txt` now lists only direct dependencies. Manual: add `/api/login` and `/api/greetings` to the Cloudflare rate-limiting rule if not done, and copy the new `configs/default` to the Pi (drops the `/flask` alias; not urgent).
- [x] Contract test: the same script (`npm run contract` in the frontend repo) passes against the FastAPI backend (fake mode) and `mock-server`.
- [x] Import-time singletons are gone: `get_services()` (`app/services.py`) creates `MelodyPlayer`, `AlarmManager` and `ServosController` lazily (the lifespan at startup); `AlarmManager(player, alarms_file)` takes its dependencies, so tests build isolated instances.
- [ ] Use FastAPI's strengths after the cutover: typed Pydantic models + OpenAPI as the contract (generate the Angular API client or `openapi.yaml` for the mock), `/docs` behind login, async-friendly stats history (E3/P2). Note: Pydantic validation would change error bodies from 400 `{'error'}` to 422; decide together with the frontend.
- [x] systemd unit for uvicorn (E3); `/docs` is off by default on the Pi (`API_DOCS` defaults to 0 outside fake mode).

### E4. Run both apps without a Raspberry [BE][FE] ✅ implemented (optional parts pending)

Fresh clone on any machine: the backend runs with simulated hardware and the UI runs against a mock server (or against that backend).

**Backend: hardware independence**

- [x] Hardware abstraction (`app/hardware/interfaces.py`): PWM channel, light, LCD, encoder, button, buzzer (`play_tone`), status LED, climate sensor. Business logic (`alarm_manager`, `navigation`, `melody_player`, `servos_controller`, controllers) depends only on these.
- [x] Real implementations in `app/hardware/raspberry.py` (gpiozero, RPLCD, rpi_hardware_pwm, bleak, sysfs LED), simulated ones in `app/hardware/fake.py` (state kept in memory, LCD buffer, random-walk climate/CPU values).
- [x] One composition root, `get_hardware()`: `--fake` argument, `HARDWARE=raspberry|fake`, or auto-detection of a Raspberry; Pi-only libraries are imported only in raspberry mode. The LCD/encoder loop moved to `app/local_interface.py` and starts explicitly from `main.py`, no longer as an import side effect.
- [x] Dependencies split: `requirements.txt` (core), `requirements-raspberry.txt` (core + hardware), `requirements-dev.txt` (core + pytest + ruff). `websockets` was missing from the old file and is now listed.
- [x] `app/config.py`: data dir, file paths and port (env overridable); fake mode defaults to the gitignored `.dev-data/`. Removes the hardcoded `/home/fwisn/...` paths (E3) – on the Pi the default is `<checkout>/resources`, set `DATA_DIR` if that differs.
- [x] `scripts/dev_setup.py` generates the RS256 key pair, `users.json` (demo / demo), alarms and greetings.
- [x] No `sudo`/`os.system` outside the Raspberry implementation; CPU temperature falls back to a simulated value.
- [x] Tests (`tests/`, 24 tests: API, JWT/CORS, socket auth, fake hardware, LCD navigation) and a backend GitHub Actions workflow (ruff + pytest, Python 3.11, core requirements only).
- [x] Camera/HLS for local dev: `docker-compose.dev.yml` + `configs/mediamtx.dev.yml` (MediaMTX with the JWT check against the local backend's JWKS + an ffmpeg test pattern published to `cam1`). **Not run** (no Docker daemon was available when it was written).
- [x] Container for the singletons: see E5 (`get_services()`).
- [ ] Verify on Windows (paths, `Timer`, signals); only macOS/Linux were exercised.
- [ ] Pi: run the new code on the real hardware once (nothing in `app/hardware/raspberry.py` could be executed here), then update the deploy notes if needed.

**Frontend: mocked backend**

- [x] `mock-server/server.js` (Express + Socket.IO, dev dependencies): `/health`, `/login` (demo / demo, HS256 JWT with a real `exp`), `/alarms`, `/alarms/play`, `/greetings`, Socket.IO handshake auth with `unauthorized`, 5 s `system_stats_update`/`ble_update` broadcasts, logging of control events.
- [x] Angular `mock` configuration (`environment.mock.ts`, `angular.json`), `npm run start:mock` (mock server + `ng serve`) and `npm run start:ui` (UI only, for the real backend in fake mode). Fixing the hardcoded LAN IP in `npm start` stays with E2.
- [x] Stream page in mock mode shows a generated test pattern (lazy-loaded `mock-camera.ts`) instead of HLS.
- [x] Failure simulation through `POST /__mock/config` (`offline`, `latencyMs`, `failWith`), documented in `AGENTS.md`; `offline` drops sockets abruptly like a dead Pi.
- [x] Contract test runs against the mock server and the real backend (fake mode), see E1.
- [ ] Contract in one place: `openapi.yaml` for REST plus a socket events section (FastAPI can generate it).
- [x] Mock server and Playwright flows run in CI (E1). The flow was verified manually with a headless-Chrome script (login, wrong password, stats, camera, alarms, offline banner and recovery) against both the mock server and the fake-mode backend.

**Acceptance criteria – verified:** `pip install -r requirements.txt` + `python scripts/dev_setup.py` + `python main.py --fake` starts the backend on a laptop; `npm ci && npm run start:mock` starts the UI, and login, alarms, stats, camera controls and the offline simulation work; the UI also works against the fake-mode backend. Behavior on the real Pi should be unchanged but is unverified until the next deploy.

---

## P2 – ideas

- [ ] **PWA**: installable app for the control panel (manifest + service worker; do not cache API/stream).
- [ ] **Uptime/history**: store CPU/temperature/climate samples (SQLite) and show charts; "Pi last seen" timestamp for the portfolio badge.
- [ ] **Notifications**: web push or Telegram message when an alarm fires, the Pi temperature is high, or the sensor battery is low.
- [ ] **Cloudflare Access / Turnstile**: put the login behind Turnstile (bot protection) or Cloudflare Access for the control panel instead of rolling auth only on the Pi.
- [x] **Camera stream settings** [FE][BE]: the "Stream settings" card on `/app/video` (resolution, FPS, bitrate, flips, brightness, contrast, saturation, sharpness, exposure, white balance). The backend stores them (`camera.json`) and patches them into MediaMTX through its localhost-only Control API; `cam1` now uses MediaMTX's native `rpiCamera` source instead of the `rpicam-vid | ffmpeg` pipeline. A change restarts the stream for a few seconds and the player reconnects. **Manual, on the Pi:** deploy (`scripts/deploy.sh` copies `mediamtx.yml` and restarts MediaMTX), then check `journalctl -u mediamtx` for the `rpiCamera` source starting (no leftover `rpicam-vid` may hold the camera). Not verified on the real camera: the native source on the Pi 5 (software H.264 there; `rpiCameraCodec: auto`), the latency compared to the old pipeline, and that the camera light/servos are unaffected. Latency: keyframes every 0.5 s (`rpiCameraIDRPeriod` = fps/2) and 500 ms HLS segments, played with hls.js (low-latency mode, live sync 2 s, max 6 s, up to 1.1x catch-up) instead of the native player; hls.js adds the current JWT to every request, so a stream running longer than 30 minutes no longer depends on the token of the first URL. Not verified on the real stream: the CORS headers for hls.js (the player falls back to native playback when it fails before the first frame) and the live-sync numbers. Open: focus (`rpiCameraAfMode`/`LensPosition` for the camera v3), `sourceOnDemand` to save CPU while nobody watches, a "stream restarting" state pushed over the socket instead of the fixed 4 s wait.
- [ ] **Stream improvements** [FE][BE] (ideas after the hls.js/latency work, roughly in this order):
    - [x] MediaMTX `logLevel: info`: at `debug` the journal held every HTTP request with all headers (cookies, the JWT in the URL, visitor IPs). Pasting such a log into a public repo leaked a refresh cookie and an IP once; keep logs out of the repos (`log.txt` is ignored now).
    - [x] Short-lived **stream-only tokens**: `POST /stream-token` (JWT required) returns a ~2 minute token with only `read cam1`; `hls-player.ts` already asks for the token per request, so it only needed a refresh timer (`StreamTokenService`). The login token is gone from URLs and logs; the stream token is read-only, 2 minutes, and refused by the API and the socket (`scope: stream`). Open: the login token still carries `mediamtx_permissions` (publish and read cam1) so older cached UIs keep working: drop it from `prepare_token` in a later release, then the B3/E3 items on the JWT in URLs are fully closed.
    - [ ] **On-demand source** (`sourceOnDemand: yes` for `cam1`, MediaMTX starts the camera and x264 only while somebody watches): less CPU and heat; the first connect takes several seconds, so the "connecting" state needs a longer timeout.
    - [ ] Stop the player when the **tab is hidden** (`visibilitychange`) and start it again when it is shown; pairs with the on-demand source.
    - [ ] A **"stream restarting" state** pushed over the socket after a settings change instead of the fixed 4 s wait in `restartStream()`.
    - [ ] **Focus** for the camera v3: `rpiCameraAfMode` (continuous/manual) and `rpiCameraLensPosition` as settings; a fixed mount often wants manual focus.
    - [ ] Show the **real latency** and dropped frames (hls.js `latency`, `droppedFrames`) on the stream page, so tuning `liveSyncDuration` (now 2 s, delay ~2 s) can be measured.
    - [ ] **Presets** (night, low bandwidth, sharp) that set several camera settings at once; frontend values on top of `PUT /camera/settings`.
    - [ ] **Night mode**: exposure `long` and a brighter camera light after dark (needs a decision: schedule or frame brightness).
    - [ ] Phones: check fullscreen and the controls in landscape.
- [ ] **Camera extras**: snapshot button, short clip recording, motion detection event feed (the original "home monitoring" idea).
- [ ] **Multi-user roles**: admin vs read-only viewer; per-user stream permission in the JWT `mediamtx_permissions`.
- [ ] **Blog / project write-ups** section on the portfolio (Markdown content, prerendered) – also good for SEO.
- [ ] **i18n**: Polish + English.
- [ ] **Status page**: public `status` section on the portfolio fed by `/health` (online/offline, uptime).
