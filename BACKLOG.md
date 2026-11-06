# Backlog

Shared backlog for both repos (`The-Raspberry-SPY-frontend` and `The-Raspberry-SPY-backend`). Tags: **[FE]** frontend, **[BE]** backend. Priorities: P0 do first, P1 next, P2 nice to have. Tick items off and move decisions into `AGENTS.md` when they change how the project works.

## Suggested order

1. ✅ P0 B1 (socket auth) and B2 (offline handling)
2. ✅ E4 (run both apps without a Raspberry) – unblocks local development and testing of everything below
3. ✅ Portfolio restructure (F1) – everything else (UI, SEO) builds on the new page structure
4. ✅ SEO (F3)
5. **Next:** B3 (backend hardening: password hashing, rate limiting, protect `GET /greetings`, melody validation) – still open, and it matters now that the site is public – then the design pass (F2)
6. Remaining P1/P2 items

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

### B3. Basic backend hardening [BE]

- [ ] Hash passwords in `resources/users.json` (bcrypt/argon2) and compare with a constant-time check.
- [ ] Rate-limit `POST /login` and `POST /greetings` (Flask-Limiter; Cloudflare WAF rate-limit rule as a second layer). Add max length to greeting text.
- [ ] `GET /greetings` is public and returns every greeting ever sent – protect it with `@jwt_required` or remove it.
- [ ] Validate `melody` in `POST /alarms/play` (currently raises on unknown names).
- [ ] Consider a refresh-token flow or silent re-login instead of the 30 min hard logout + `alert()` warning.

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

### F2. Better UI/UX [FE]

- [ ] Design tokens: colors, spacing, typography as CSS custom properties in `styles.scss`; dark mode (`prefers-color-scheme`) and a toggle.
- [ ] Redesign the shared components (button, inputs, cards, tabs) once, reuse everywhere; keep the current header/tabs look for the authorized area (requirement).
- [ ] Replace `alert()` (session expiry, greeting sent/failed) with toasts; session-expiry modal with "stay signed in" (needs refresh, see B3).
- [ ] Login: loading state, inline errors, show/hide password, `autocomplete` attributes, Enter to submit, error text distinguishing wrong credentials vs backend offline.
- [ ] Live stream page: clear camera on/off state, loading/buffering/error states, fullscreen, d-pad + keyboard arrows, touch-friendly controls, visible connection status, privacy hint when the camera is on.
- [ ] Alarm manager: clearer weekly grid, save confirmation + dirty state, unsaved-changes guard, melody preview feedback.
- [ ] Stats: replace the hover/click dropdown with a dashboard page (CPU, temp, RAM, BLE climate with history/sparkline, "last updated N s ago", stale-data warning).
- [ ] Accessibility: semantic landmarks, focus states, labels, color contrast, `prefers-reduced-motion` (the slide-in animations), keyboard navigation of the tabs. Target Lighthouse a11y >= 95.
- [ ] Skeleton/loading states; consistent empty and error states (ties in with B2).
- [ ] Mobile pass on every page (the layout was just made mobile-friendly – keep that working).

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
- [ ] To reach >= 90 under the default mobile simulation: shrink the initial JavaScript, e.g. `@defer` the greeting form (drops `@angular/forms` and the form code from the first load), check what else lands in the shared chunk (FontAwesome, rxjs, router), and drop unused polyfills. Re-measure with `lighthouse https://filipwisniewski.pl` after deploying.
- [ ] Re-run Lighthouse against production after the first deploy (real TLS, HTTP/2, caching headers from GitHub Pages).

---

## P1 – engineering health

### E1. Tests and CI [FE][BE]

- [ ] FE: the test setup is broken, so CI's test step has never run (lint failed first). `ng test` uses the legacy `@angular-devkit/build-angular:karma` builder without the `main` entry it needs, so Karma starts but finds 0 specs, and `karma.conf.js` lists `kjhtml` as a framework (it is only a reporter) -> `No provider for "framework:kjhtml"`. Verified workaround: switch the `test` target to `@angular/build:unit-test` with `runner: "karma"`, `buildTarget: "::development"`, `tsConfig: "tsconfig.spec.json"` and `browsers: ["ChromeHeadless"]` (it discovers `*.spec.ts` by itself; custom launchers from `karma.conf.js` are not picked up, so CI needs `ChromeHeadless` with `--no-sandbox` via a `karmaConfig`, or Vitest instead – see the stack discussion). With it, 14 specs run: 2 pre-existing failures remain – `HeaderComponent` (no router providers) and `AlarmComponent` (no form passed).
- [ ] FE: add specs for `AuthService` (expiry/logout), `authGuard`, the new interceptor and `BackendStatusService`, alarm manager; currently only header, login, video-stream and alarm have specs.
- [ ] FE: `ci.yml` also runs `npm run build`; make `deploy.yml` depend on a green CI (or merge them); add Dependabot for npm + GitHub Actions.
- [ ] BE: add `pytest` with the hardware layer behind an interface/fakes so `alarm_manager`, controllers (Flask test client) and JWT/CORS behavior can be tested without a Pi; run `ruff` + tests in GitHub Actions.

### E2. Frontend cleanups [FE]

- [ ] Add an `HttpInterceptorFn` that attaches the bearer token and handles 401 (logout) – remove the per-call `Authorization` headers in `raspberry.api.ts`.
- [ ] `Stats` subscribes inside an `effect()` and never unsubscribes; move to `toSignal`/`takeUntilDestroyed` and share the socket streams via the service.
- [ ] Dev ergonomics: `npm start` is hardcoded to `192.168.1.105`; make the dev host configurable (proxy config or env), and document how to run against the Pi (`EXTRA_ALLOWED_ORIGINS` on the backend).
- [ ] Unify file naming (`*.component.ts` vs plain names) and selectors; update README (still has old structure/links).
- [ ] Don't pass the JWT in a query string longer than necessary: investigate MediaMTX `authHTTP`/short-lived stream tokens or cookie-based auth for HLS (the long-lived token currently appears in URLs and could end up in logs).

### E3. Backend cleanups & ops [BE]

- [ ] Replace hardcoded `/home/fwisn/Documents/camera-app/...` paths with a single config module (env vars with sensible defaults); fix the relative `./resources/greetings.json` path.
- [ ] Remove the committed virtualenv (`bin/`, `lib64`, `pyvenv.cfg`) from git and ignore it; align Python version (`pyproject.toml` says py313, the venv is 3.11).
- [ ] Run Flask as a `systemd` service (auto start on boot, restart on failure, `journalctl` logs) alongside `cloudflared` and MediaMTX; document it in `configs/CONFIGS.MD`; add a deploy script (`git pull` + restart).
- [ ] Make the BLE thread robust (a malformed packet raises in `__parse_response` and should not break the loop), and expose "stale" data (>N min old) to the UI.
- [ ] Replace `os.system('... sudo tee ...')` for the ACT LED with a udev/group-permission approach or `gpiozero`/sysfs write without sudo.
- [ ] Finish or remove the draft Arduino Uno R4 websocket manager (`websocket_manager.py`); `send()` is currently broken (`connected_device.send` is not awaited).
- [ ] Remove dead commented-out code in `gpio.py`; `logging` instead of `print`.
- [ ] Move greetings/alarms JSON writes behind a lock / atomic write (concurrent requests can corrupt the file).

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
- [ ] Add the mock server and a few Playwright flows to CI (login, alarms, offline banner) – ties in with E1. The flow was verified manually with a headless-Chrome script (login, wrong password, stats, camera, alarms, offline banner and recovery) against both the mock server and the fake-mode backend.

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
- [ ] **E2E tests**: Playwright against a mocked API for the main flows (login, alarms, offline banner).
- [ ] **Status page**: public `status` section on the portfolio fed by `/health` (online/offline, uptime).
