# Backlog

Shared backlog for both repos (`The-Raspberry-SPY-frontend` and `The-Raspberry-SPY-backend`). Tags: **[FE]** frontend, **[BE]** backend. Priorities: P0 do first, P1 next, P2 nice to have. Tick items off and move decisions into `AGENTS.md` when they change how the project works.

## Suggested order

1. P0 security + resilience: B1, B2 (small, protects the live site)
2. E4 (run both apps without a Raspberry) – unblocks local development and testing of everything below (B2 offline states, E1 tests, F1/F2 UI work against a mocked API)
3. Portfolio restructure (F1) – everything else (UI, SEO) builds on the new page structure
4. SEO (F3) and design pass (F2) together with the portfolio, since they touch the same pages
5. Remaining P1/P2 items

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
- [ ] FE: the portfolio page must work fully when the backend is down; its Raspberry SPY section should show a live "Pi online/offline" badge instead of failing (builds on the new `BackendStatusService`, depends on F1).
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

### F1. Portfolio restructure [FE]

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
- [ ] Layout routes + route reshuffle, update `AuthService.logout()` / `authGuard` redirects.
- [ ] New portfolio page + nav, responsive.
- [ ] Fix stale repo links (`raspberry-backend`, `raspberry-ui` -> `The-Raspberry-SPY-backend` / `-frontend`).
- [ ] Remove the hardcoded "24 year old" text.

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
- [ ] **Open questions for Filip:** public contact channel (email/LinkedIn only?), CV download (PDF) yes/no, which employer details are OK to show, which projects to feature/hide, English only or also Polish.

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

### F3. SEO [FE]

The site is a client-rendered SPA on GitHub Pages. Deep links currently work through a `404.html` copy of `index.html`, which makes Pages answer **HTTP 404** for every non-root URL – bad for crawlers.

- [ ] `index.html`: real `<title>`, meta description, `<link rel="canonical">`, `theme-color`, Open Graph + Twitter card tags, social preview image (1200x630), favicon set (PNG sizes, apple-touch-icon, `site.webmanifest`).
- [ ] Per-route titles/meta via Angular `Title`/`Meta` (route `title` + a small `SeoService`), `noindex` on `/login` and `/app/*`.
- [ ] Pre-render the public pages at build time (Angular SSG via `@angular/ssr` / prerender in the application builder) so crawlers get real HTML and real 200 responses; keep the `404.html` fallback only for the authorized SPA routes.
- [ ] `public/robots.txt` (disallow `/app`, `/login`, link sitemap) and `public/sitemap.xml`; submit to Google Search Console (+ Bing).
- [ ] Structured data: JSON-LD `Person` (name, jobTitle, worksFor, sameAs = GitHub/LinkedIn), `WebSite`; `SoftwareSourceCode`/`CreativeWork` for featured projects.
- [ ] Performance (Core Web Vitals): self-host Roboto (or `font-display: swap` + subset) instead of Google Fonts, optimize `me.jpg` (WebP/AVIF, `srcset`, explicit width/height, `loading`/`fetchpriority`), lazy-load routes, check bundle budgets in `angular.json`. Target Lighthouse >= 90 on all categories.
- [ ] Semantic HTML (`h1` once per page, headings in order, `alt` text, descriptive link text), `lang="en"` (or `pl` + `hreflang` if Polish is added).
- [ ] Make sure only one canonical host is indexed (apex `filipwisniewski.pl`; `www` redirects – Pages handles this when both are configured).

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

### E4. Run both apps without a Raspberry [BE][FE]

Today the backend only starts on the Pi (GPIO libraries are imported and hardware objects are created at import time) and the frontend always needs that backend. Goal: on a fresh clone on any laptop, run both apps with a few commands, log in, see live stats, use the camera controls and manage alarms. Not started – design notes below.

**Backend: hardware independence**

- [ ] Hardware abstraction layer: small interfaces (`Protocol`/ABC) for the servos (pan/tilt), camera light, LCD, rotary encoder + button, buzzer/melody output, CPU temperature, BLE climate sensor, Arduino websocket link and the ACT LED. Business logic (`alarm_manager`, `navigation`, controllers) depends only on these interfaces.
- [ ] Real implementations (`gpiozero`, `RPLCD`, `rpi_hardware_pwm`, `bleak`, sysfs) live in one package, e.g. `app/hardware/raspberry/`. Fake implementations in `app/hardware/fake/`: servos and light keep state in memory and log changes, the buzzer logs the melody name and duration, the LCD prints to the terminal (or is disabled), the encoder/button are no-ops (optionally driven by keyboard), BLE/CPU/RAM values follow a small random walk so the UI charts move.
- [ ] One composition root (`app/hardware/__init__.py` or `app/container.py`) chooses the implementation from `HARDWARE=raspberry|fake` (default: auto-detect Raspberry via `/proc/device-tree/model`, else fake). Remove import-time side effects and the module-level singletons that create hardware (`gpio.py`, `servos_controller`, `melody_player`, `ble_manager`).
- [ ] Import Pi-only libraries lazily inside the real implementations; split dependencies into `requirements.txt` (core: Flask, Flask-SocketIO, JWT, psutil, ...) and `requirements-raspberry.txt` (`gpiozero`, `lgpio`, `rpi-lgpio`, `rpi_hardware_pwm`, `RPLCD`, `smbus2`, `bleak`, `dbus-fast`, ...), so `pip install -r requirements.txt` works on macOS/Windows/Linux.
- [ ] Central config module (also covers the hardcoded paths from E3): data dir, port, users file, key paths, allowed origins, hardware mode – with dev-friendly defaults.
- [ ] Dev bootstrap script (`scripts/dev_setup.py`): generates a throwaway RS256 key pair and a sample `users.json`, creates empty `alarms.json`/`greetings.json` in a temp/data dir.
- [ ] Camera/HLS for local dev, pick one: (a) no stream, the UI shows a "no camera in dev mode" placeholder; (b) `docker-compose.dev.yml` with MediaMTX + ffmpeg publishing a test pattern or looping sample video to `cam1`, with `authJWTJWKS` pointing at the local Flask. Recommended: ship (a) first, add (b) afterwards.
- [ ] No `sudo`/`os.system` on non-Pi (the ACT LED handling goes behind the hardware interface).
- [ ] Entry points: `python main.py` (auto) and `python main.py --fake`; document in README/`AGENTS.md` and update the "only runs on the Pi" notes in both `AGENTS.md` files.
- [ ] Tests (E1) use the fake hardware: alarms scheduling, socket auth, controllers via the Flask test client; run in GitHub Actions on Ubuntu.

**Frontend: mocked backend**

- [ ] A standalone mock server in `mock-server/` (Node + Express + `socket.io`, dev dependency only) that implements the backend contract from `AGENTS.md`: `GET /health` (B2), `POST /login` (demo credentials, returns a JWT with a real `exp`), `GET/POST /alarms` and `POST /alarms/play` (in memory), `POST /greetings`, and Socket.IO with the same handshake auth rule as the real backend, the 5 s `system_stats_update`/`ble_update` broadcasts with randomized values, and logging of `message` events. Rationale for a server over in-browser mocking (MSW or an Angular interceptor): it exercises the real HTTP/socket code paths, CORS and the auth handshake, and it can be reused for Playwright E2E tests (P2).
- [ ] Angular `mock` configuration: `environment.mock.ts` (pointing at `http://localhost:<port>`), an `angular.json` build/serve configuration, and `npm run start:mock` that starts the mock server and `ng serve` together (e.g. `concurrently`). Fix the hardcoded LAN IP in `npm start` while at it (E2).
- [ ] Video in mock mode: serve a looping sample as HLS (a small pre-generated `.m3u8` + segments checked in or generated with `ffmpeg`), or fall back to a static placeholder when `env.mock` is set.
- [ ] Failure simulation for B2/F2 work: mock-server controls (query param, admin endpoint or key combo) to go "offline", respond slowly, return 401/500, and drop the socket, so every offline/error state in the UI can be tested without unplugging a Pi.
- [ ] Keep the contract in one place: an `openapi.yaml` for REST plus a short socket events section, shared by the real backend docs and the mock server; add a simple contract test (the mock server and the real backend in fake mode must answer the same requests with the same shapes).
- [ ] Document in `AGENTS.md` / README: `npm run start:mock`, demo credentials, how to point the UI at the real backend in fake mode instead (`EXTRA_ALLOWED_ORIGINS=http://localhost:4200`).

**Acceptance criteria**

- Fresh clone + `pip install -r requirements.txt` + `python scripts/dev_setup.py` + `python main.py --fake` starts the backend on a non-Pi machine.
- `npm ci && npm run start:mock` starts the UI against the mock server; login, alarms, greetings, live stats and camera controls all work.
- The UI also works against the fake-hardware backend, and CI runs backend tests and the mocked UI flows without a Raspberry.
- Behavior on the real Pi is unchanged (`HARDWARE=raspberry` or auto-detect).

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
