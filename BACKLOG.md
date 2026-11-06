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
- [ ] FE: the control pad and brightness slider still look active while offline (their socket events are dropped silently) – disable them in F2.
- [ ] FE: replace the remaining `alert()` calls with toasts (F2).

### B3. Basic backend hardening [BE][FE] ✅ implemented (token refresh pending)

- [x] Passwords in `users.json` are salted scrypt hashes (werkzeug) compared in constant time; unknown usernames burn a dummy hash check so timing does not reveal valid names. An old plain-text file is migrated automatically on startup; `scripts/manage_users.py` lists/adds/changes users (minimum 10 characters).
- [x] Rate limiting with Flask-Limiter (in memory, keyed by `CF-Connecting-IP`): failed `POST /login` attempts 5/min and 20/h, `POST /greetings` 3/min and 20/h; the 429 answer is JSON and carries the CORS header, so the UI can tell "too many attempts" from "the Raspberry is off". Verified over real HTTP, including that other visitors and successful logins are not affected.
- [x] Greetings: text limited to 500 characters (also `maxlength` in the form), whitespace-only and non-JSON bodies rejected, only the latest 1000 are kept, writes are locked and atomic. `GET /greetings` now requires a JWT.
- [x] `POST /alarms/play` validates the melody (400 instead of an exception); request bodies are capped at 64 KiB; JSON endpoints no longer crash on non-JSON bodies.
- [x] Bug found on the way: saving alarms through `POST /alarms` never reloaded the scheduler, so the new times only applied after a Flask restart. It now reloads.
- [x] Frontend: login shows distinct messages for wrong credentials, too many attempts, offline and other errors; the greeting form shows a "too fast" message on 429; the mock server mirrors the new contract (`GET /greetings` needs a token, 500-character limit; `failWith: 429` simulates the limit).
- [ ] **Manual:** add the Cloudflare rate-limiting rule described in `configs/CONFIGS.MD` as a second layer.
- [ ] Refresh-token flow or silent re-login instead of the hard 30 minute logout and `alert()` warning (design needed: refresh tokens in an httpOnly cookie vs. a longer-lived access token; also affects the stream URL token).
- [ ] The JWT lives in `localStorage` and in the HLS URL query string (E2); consider short-lived stream-only tokens.
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
- Authorized shell: current `HeaderComponent` + `MobileNavComponent` + `Stats`, wrapped in a layout route (`/app` with `authGuard` on the parent) so the portfolio never renders them.
- Keep redirects for old URLs (`/video`, `/alarm`, `/greetings`, `/mobile-stats`) so existing bookmarks keep working.
- Lazy-load the `/app/*` routes so the portfolio bundle stays small.
- [x] Layout routes + route reshuffle: `/` portfolio, `/login`, guarded lazy `/app/*` shell, redirects for the old URLs, wildcard to `/`. (`AuthService.logout()` still goes to `/login`.)
- [x] New portfolio page with its own fixed nav and anchors (hero, about, skills, projects with the Raspberry SPY featured, beyond code, contact), responsive down to phone width. The public page opens no websocket and loads no socket.io code.
- [x] Stale repo links fixed. "Greet me" is an embedded widget in the Raspberry SPY section; "Sign in" is in the nav, the project card and the footer.
- [x] The hardcoded "24 year old" text is gone.
- [x] Raspberry SPY section shows a live online/offline badge (re-checked every 30 s) and keeps working when the backend is down.
- [ ] Review the draft copy (`portfolio.data.ts`, `portfolio.html`): it only uses facts from the GitHub profile, but the wording, the project selection and the order are a first proposal.
- [ ] Add screenshots/GIFs for the other projects (Gadget, Connect Messenger, Macau) and optimize `public/img/me.jpg` further (WebP/AVIF, `srcset`) – part of F3.
- [ ] The login page is still a plain full-height page with the old styling – redesign in F2.

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
- [ ] Session expiry modal with "stay signed in": needs the token refresh from B3 (for now a warning toast and an expiry notice).
- [ ] Stats: persist the history on the Raspberry (`/stats/history`) so the charts survive a page reload; thresholds for the sensor battery once the battery type is known.
- [ ] Stream: a real "buffering" state for HLS stalls, a snapshot button, fullscreen button of our own (the native controls offer it).
- [ ] Portfolio polish: project screenshots, subtle section transitions (respecting reduced motion), a light/dark preview image for social cards.
- [ ] Visual regression: add Playwright screenshots of the main screens in both themes to CI (ties in with E1/E4).

### F3. SEO [FE] ✅ implemented (manual submission and polish pending)

The site was a client-rendered SPA on GitHub Pages; the `404.html` trick made Pages answer HTTP 404 for every non-root URL. Now:

- [x] `index.html`: title, meta description, canonical, `theme-color`, Open Graph + Twitter card tags with a 1200x630 preview image, favicon set (`.ico`, svg, 32 px png, apple-touch-icon), `site.webmanifest` with 192/512 icons.
- [x] Per-route titles (route `title`) and `noindex, nofollow` on `/login` and `/app/*` through `SeoService` (route `data: { noindex: true }`). Only `/` is indexable, so no per-route descriptions are needed yet.
- [x] The portfolio is pre-rendered at build time (`@angular/ssr`, static output, hydration): crawlers get the full HTML with a real 200. `index.csr.html` is copied to `404.html` for `/login` and `/app/*` only.
- [x] `public/robots.txt` (disallows `/app/` and `/login`, links the sitemap) and `public/sitemap.xml`.
- [ ] **Manual:** add `https://filipwisniewski.pl` to Google Search Console and Bing Webmaster Tools, verify the domain (DNS TXT record in Cloudflare) and submit the sitemap.
- [x] Structured data: JSON-LD `WebSite` + `Person` (name, job title, employer, university, GitHub/LinkedIn as `sameAs`) in `index.html`. Not done: `SoftwareSourceCode`/`CreativeWork` entries for the featured projects.
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
    - `GreetingsComponent`'s counter and Send button did not refresh after programmatic changes (zoneless change detection); it now reads a signal.
    - The key handler of the stream page crashed on events without a target.
- [x] First CI run on GitHub passed (verify 54 s, e2e 54 s, deploy 15 s).
- [x] FE: `SocketService` is tested (token-driven connect, handshake auth, `unauthorized` logout, offline probing, emit guard; the socket comes from an injectable `SOCKET_FACTORY`) and `karma.conf.js` enforces coverage thresholds (80% statements/lines, 70% branches, 72% functions; now 86/89/73/75). Open: BE threshold, tests for `mock-server`.
- [x] FE: Playwright E2E suite (28 test runs: 14 desktop flows, axe on every page in light and dark on desktop and a Pixel 7 phone, phone layout checks; ~16 s, `npm run e2e`) against the mock server: portfolio offline, theme persistence, login/logout/guard, wrong password, 429, session reload, stats over the socket, alarm save/discard, camera controls, offline banner and recovery. Own `e2e` job in CI; deploy waits for it. The axe run found a real contrast problem (inactive bottom-nav labels in the light theme), fixed. Open: screenshot comparisons (need baselines generated on the CI runner).
- [ ] Contract test between `mock-server` and the real backend in fake mode (see E4).
- [x] Karma/Jasmine replaced by Vitest + jsdom (`runner: vitest` in `angular.json`): the suite runs in ~2 s without a browser; `karma*`, `jasmine*` and `@angular-devkit/build-angular` are gone (the app builds with `@angular/build`). Coverage thresholds moved to `coverageThresholds` in `angular.json` (v8 numbers: 82% statements, 80% lines, 86% branches, 83% functions).
- [ ] BE: run the suite on Python 3.13 as well as 3.11, and add tests that mock `gpiozero`/`RPLCD` to cover `hardware/raspberry.py`.

### E2. Frontend cleanups [FE]

- [x] `authInterceptor` attaches the bearer token and signs the user out on 401 (with a toast); `RaspberryApi` no longer takes tokens (spec added).
- [x] Stats subscriptions live in the root `StatsService` (one subscription per event for the app's lifetime, signals for the page); the old `effect()` subscriptions are gone.
- [x] `npm start` serves on localhost (no hardcoded host); running against the Pi is documented in `AGENTS.md`. Still open: the Pi's LAN IP stays in `environment.ts`.
- [ ] Unify file naming (`*.component.ts` vs plain names) and selectors; update README (still has old structure/links).
- [ ] Don't pass the JWT in a query string longer than necessary: investigate MediaMTX `authHTTP`/short-lived stream tokens or cookie-based auth for HLS (the long-lived token currently appears in URLs and could end up in logs).

### E3. Backend cleanups & ops [BE]

- [ ] Replace hardcoded `/home/fwisn/Documents/camera-app/...` paths with a single config module (env vars with sensible defaults); fix the relative `./resources/greetings.json` path.
- [x] The committed virtualenv is gone: untracked and gitignored (`bin/`, `lib64`, `pyvenv.cfg`), the Pi runs from `.venv` (`scripts/setup_venv.sh`), ruff targets py311 (Pi 3.11.2, CI 3.11).
- [x] The backend runs as a `systemd` service: `configs/raspberry-spy.service` (template), `scripts/install_service.sh` (fills in user/checkout/python, enables, starts; `--print` to preview) and `scripts/deploy.sh` (pull, install changed requirements, restart, wait for `/health`), documented in `configs/CONFIGS.MD`. Not run on the Pi yet (the unit was only rendered here). `cloudflared` already is a service; nginx is enabled on boot.
- [x] MediaMTX runs as a `systemd` service too: `configs/mediamtx.service` and `scripts/install_mediamtx_service.sh` (copies `configs/mediamtx.yml` to `/mediamtx`, installs and restarts the unit; `deploy.sh` reminds you when the config changed). Not run on the Pi yet.
- [x] `AlarmManager.reload()` no longer deadlocks when a reload coincides with an alarm ringing: reloads are serialized by their own lock, the old thread is joined **outside** the lock that guards the schedule, and every scheduler thread has its own stop event (regression test `test_reloading_while_an_alarm_is_ringing_does_not_deadlock`, verified to fail on the old code). Matters most for the FastAPI version, where a stuck reload would hold a worker thread of the pool.
- [ ] Make the BLE thread robust (a malformed packet raises in `__parse_response` and should not break the loop), and expose "stale" data (>N min old) to the UI.
- [ ] Replace `os.system('... sudo tee ...')` for the ACT LED with a udev/group-permission approach or `gpiozero`/sysfs write without sudo.
- [ ] Finish or remove the draft Arduino Uno R4 websocket manager (`websocket_manager.py`); `send()` is currently broken (`connected_device.send` is not awaited).
- [ ] Remove dead commented-out code in `gpio.py`; `logging` instead of `print`.
- [x] Greetings and alarms JSON writes (HTTP) are locked and atomic (`app/json_store.py`); `AlarmManager.save_day` (LCD) still writes directly.

### E5. Backend: move from Flask to FastAPI [BE] ✅ done (follow-ups open)

Decision: rewrite the backend with FastAPI in the same repo, keeping the API contract unchanged so the frontend needs no change.

- [x] Side-by-side implementation in `app/api/` (REST routers, RS256 JWT dependency, rate limits with the `limits` library, Socket.IO through python-socketio's ASGI app, lifespan that starts the hardware), entry point `main_fastapi.py`, shared validation in `app/validation.py` (also used by Flask), 57 new tests (122 total) that mirror the Flask tests, smoke-tested with the real JavaScript socket.io client (handshake auth, controls, stats broadcast).
- [x] Cutover prepared: `python main.py` is the FastAPI app (the Flask version stays as `main_flask.py` for rollback), nginx serves `/api` and the old `/flask` alias, the frontend calls `/api`, docs updated (`configs/CONFIGS.MD` has the Pi steps). Deploy order: backend + nginx on the Pi first, then the frontend.
- [ ] Verify on the Raspberry for real (`git pull`, `pip install -r requirements-raspberry.txt`, `python main.py`): nothing hardware-related could be exercised off the Pi (uvicorn + LCD thread + GPIO + BLE thread together, `asyncio.to_thread` for servos).
- [x] Flask removed (`main_flask.py`, `app/server.py`, `app/controller/`, `app/rate_limit.py`, Flask requirements, Flask-only tests, the `/flask` nginx alias): 89 tests, `requirements.txt` now lists only direct dependencies. Manual: add `/api/login` and `/api/greetings` to the Cloudflare rate-limiting rule if not done, and copy the new `configs/default` to the Pi (drops the `/flask` alias; not urgent).
- [ ] Contract test (see E4): run the same request script against the FastAPI backend (fake mode) and `mock-server`.
- [ ] Move the import-time singletons (`alarm_manager`, `melody_player`, `servos_controller`) into the FastAPI lifespan / dependency injection, so the E3 deadlock fix and test isolation get easier.
- [ ] Use FastAPI's strengths after the cutover: typed Pydantic models + OpenAPI as the contract (generate the Angular API client or `openapi.yaml` for the mock), `/docs` behind login, async-friendly stats history (E3/P2). Note: Pydantic validation would change error bodies from 400 `{'error'}` to 422; decide together with the frontend.
- [ ] systemd unit for uvicorn (E3) and `API_DOCS=0` in production (default on the Pi).

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
- [ ] Camera/HLS for local dev with a real picture: `docker-compose.dev.yml` with MediaMTX + an ffmpeg test source publishing to `cam1`, with `authJWTJWKS` pointing at the local Flask. (Without it the UI uses the generated test pattern.)
- [ ] Replace the remaining import-time singletons (`alarm_manager`, `melody_player`, `servos_controller`) with a small container created in `main.py`, so tests can build isolated instances.
- [ ] Verify on Windows (paths, `Timer`, signals); only macOS/Linux were exercised.
- [ ] Pi: run the new code on the real hardware once (nothing in `app/hardware/raspberry.py` could be executed here), then update the deploy notes if needed.

**Frontend: mocked backend**

- [x] `mock-server/server.js` (Express + Socket.IO, dev dependencies): `/health`, `/login` (demo / demo, HS256 JWT with a real `exp`), `/alarms`, `/alarms/play`, `/greetings`, Socket.IO handshake auth with `unauthorized`, 5 s `system_stats_update`/`ble_update` broadcasts, logging of control events.
- [x] Angular `mock` configuration (`environment.mock.ts`, `angular.json`), `npm run start:mock` (mock server + `ng serve`) and `npm run start:ui` (UI only, for the real backend in fake mode). Fixing the hardcoded LAN IP in `npm start` stays with E2.
- [x] Stream page in mock mode shows a generated test pattern (lazy-loaded `mock-camera.ts`) instead of HLS.
- [x] Failure simulation through `POST /__mock/config` (`offline`, `latencyMs`, `failWith`), documented in `AGENTS.md`; `offline` drops sockets abruptly like a dead Pi.
- [ ] Contract in one place: `openapi.yaml` for REST plus a socket events section, and a contract test that runs the mock server and the real backend (fake mode) against the same requests.
- [x] Mock server and Playwright flows run in CI (E1). The flow was verified manually with a headless-Chrome script (login, wrong password, stats, camera, alarms, offline banner and recovery) against both the mock server and the fake-mode backend.

**Acceptance criteria – verified:** `pip install -r requirements.txt` + `python scripts/dev_setup.py` + `python main.py --fake` starts the backend on a laptop; `npm ci && npm run start:mock` starts the UI, and login, alarms, stats, camera controls and the offline simulation work; the UI also works against the fake-mode backend. Behavior on the real Pi should be unchanged but is unverified until the next deploy.

---

## P2 – ideas

- [ ] **PWA**: installable app for the control panel (manifest + service worker; do not cache API/stream).
- [ ] **Uptime/history**: store CPU/temperature/climate samples (SQLite) and show charts; "Pi last seen" timestamp for the portfolio badge.
- [ ] **Notifications**: web push or Telegram message when an alarm fires, the Pi temperature is high, or the sensor battery is low.
- [ ] **Cloudflare Access / Turnstile**: put the login behind Turnstile (bot protection) or Cloudflare Access for the control panel instead of rolling auth only on the Pi.
- [ ] **Camera extras**: snapshot button, short clip recording, motion detection event feed (the original "home monitoring" idea).
- [ ] **Multi-user roles**: admin vs read-only viewer; per-user stream permission in the JWT `mediamtx_permissions`.
- [ ] **Blog / project write-ups** section on the portfolio (Markdown content, prerendered) – also good for SEO.
- [ ] **i18n**: Polish + English.
- [ ] **Status page**: public `status` section on the portfolio fed by `/health` (online/offline, uptime).
