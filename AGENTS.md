# The Raspberry SPY – frontend

Angular SPA: Filip's **portfolio** (public, `/`) plus the control panel of a home-built Raspberry Pi 5 camera/alarm system (signed-in area, `/app/*`). Hosted on **GitHub Pages** at `https://filipwisniewski.pl`. The backend runs on the Raspberry at home and is exposed through a **Cloudflare Tunnel** at `https://api.filipwisniewski.pl`. When the Pi is off, the backend is unreachable – that is a normal state, not a bug.

Backend repo: `../The-Raspberry-SPY-backend` (Python/FastAPI). Planned work lives in `BACKLOG.md` (covers both repos).

## Stack

- Angular 21, **standalone components, zoneless** (`provideZonelessChangeDetection`), signals, `inject()`. No NgModules, no zone.js.
- **The production build pre-renders the public portfolio** (`outputMode: static` + `prerender` in the `production` configuration, `@angular/ssr`): `dist/raspberry-ui/browser/index.html` is the finished portfolio page, `index.csr.html` is the client-only shell used for `/login` and `/app/*`. Dev and mock builds are client-only. Hydration is enabled.
- TypeScript strict (`strictTemplates`, `noPropertyAccessFromIndexSignature`), SCSS, FontAwesome icons.
- `socket.io-client` (websocket transport only) for live data and camera controls; `HttpClient` for REST; plain `<video src>` for HLS (native browser playback, no hls.js).
- Tests: Vitest specs (globals, jsdom) run through the `@angular/build:unit-test` builder (`runner: vitest`, `setupFiles: src/test-setup.ts` stubs `matchMedia`; coverage with v8). End-to-end: Playwright. Lint: angular-eslint + prettier via eslint (`ng lint`).

## Commands

```bash
npm ci
npm start          # ng serve on localhost:4200 against the Pi at the LAN IP in src/environment.ts (edit it if the Pi's address changes; start the backend with EXTRA_ALLOWED_ORIGINS=http://localhost:4200; add `-- --host 0.0.0.0` to serve the UI on the LAN)
npm run start:mock # no Raspberry needed: mock backend (mock-server/, :8080) + ng serve --configuration mock (:4200). Login demo / demo
npm run start:ui   # only the UI in the mock configuration, e.g. against the real backend started with `python main.py --fake`
npm run build      # production build + pre-rendering -> dist/raspberry-ui/browser (index.html = portfolio, index.csr.html = SPA shell, copied to 404.html by deploy.yml)
npm run lint       # must pass, CI fails otherwise
npm run format     # prettier --write .
npm test           # unit tests in watch mode
npm run test:ci    # what CI runs: once, with a coverage summary (coverage/ has the HTML report)
npm run e2e        # Playwright end-to-end tests (starts mock-server + `ng serve --configuration mock` itself, reuses them when running; first time: `npx playwright install chromium`)
npm run contract   # contract checks (REST + socket) against the mock server; `-- http://localhost:8080` targets a backend started with `python main.py --fake` (restart it between runs: greeting rate limit)
npm run check:build # sanity check of dist/ after `npm run build` (pre-rendered portfolio, CNAME, robots, sitemap, ...)
```

## Routes

```
/                public portfolio (own nav, no app header, no websocket, works with the backend down)
/login           public sign-in page (+ offline banner)
/app/video       signed-in area (authGuard on the parent, lazy-loaded AppShell = skip link + banner + header tabs + mobile nav)
/app/alarm       (leaving with unsaved changes asks for confirmation)
/app/stats       live stats dashboard with sparklines
/video /alarm /mobile-stats /greetings  -> redirects (old URLs); anything unknown -> /
```

## Layout

```
src/
  main.ts, main.server.ts, app.config.ts, app.config.server.ts, app.routes.ts, app.routes.server.ts   # server routes: '' is pre-rendered, everything else client-side
  styles.scss             # design tokens (light/dark CSS variables), base styles, shared .button/.card/.field/.chip/.notice/.spinner/.skeleton classes
  environment.ts          # dev: LAN IP of the Pi (http://192.168.1.105:8080/8888)
  environment.prod.ts     # prod: https://api.filipwisniewski.pl  (swapped in by angular.json fileReplacements)
  environment.mock.ts     # mock configuration: http://localhost:8080 (mock-server or the backend in fake mode), `mock: true`
  components/
    root/                 # <router-outlet/> + <toasts/>
    portfolio/            # public landing page: portfolio.ts/html/scss, portfolio.data.ts (ALL copy: skills, projects, links), raspberry-spy-section/ (status badge + gallery + embedded greeting form)
    shell/                # AppShell: layout of the signed-in area
    header/ (+ mobile/)   # red header with tabs (Live stream, Alarm, Stats, Portfolio), theme toggle, sign out; compact on phones + bottom nav
    backend-status-banner/ # "Raspberry is probably switched off" bar (shell + login)
    toasts/  theme-toggle/  sparkline/   # small shared UI pieces
    login/  greetings/ (embedded widget, not a page)  alarm-manager/ (+ alarm/)  video-stream/ (+ slider, longpress-button, mock-camera)  stats/ (stats-page)
  service/
    auth.interceptor.ts   # adds `Authorization: Bearer` to protected backend calls (not /login, /health, POST /greetings); a 401 signs the user out with a toast
    auth.service.ts       # JWT in localStorage ('jwt'), silent refresh 60 s before expiry via the refresh cookie, restoreSession(), expiry timers (warning toast 15 s before when refreshing fails)
    auth.guard.ts, unsaved-changes.guard.ts
    raspberry.api.ts      # all REST calls; no token handling here, `authInterceptor` adds it
    socket.service.ts     # single socket.io connection, listen<T>() returns Observable, `connected` signal
    stats.service.ts      # live system/climate values + 60-sample history, seeded from GET /stats/history (created by AppShell)
    backend-status.service.ts / .interceptor.ts   # online/offline detection for the Raspberry (see Gotchas)
    seo.service.ts        # adds `noindex` for routes with `data: { noindex: true }` (login, /app)
    theme.service.ts      # light/dark choice (data-theme on <html>, stored in localStorage 'theme')
    toast.service.ts      # replaces alert(): success/error/warning/info messages
mock-server/server.js      # Express + Socket.IO fake of the backend contract (health, login, alarms, greetings, stats, JWT handshake) + failure simulation
public/                   # CNAME (custom domain – keep!), robots.txt, sitemap.xml, site.webmanifest, favicons/icons, raspberry-pi.svg, img/ (photos as jpg + webp, og-image.jpg for link previews)
.github/workflows/        # ci.yml (lint+test on push/PR), deploy.yml (build + GitHub Pages on master)
```

## Backend contract (what the UI depends on)

- `POST /login` `{username,password}` -> `{access_token, expires_at}`; RS256 JWT, 30 min lifetime. The answer also sets an **httpOnly, SameSite=Strict `refresh_token` cookie** (7 days; the UI and API are the same site, `withCredentials: true` on these calls, CORS allows credentials).
- `POST /refresh` (cookie, no bearer) -> a new `{access_token, expires_at}` and a rotated cookie; `401 {msg}` when the cookie is missing, unknown or expired. A spent token still works for 30 s (two tabs refreshing together). `POST /logout` -> 204, revokes the cookie. `AuthService` renews the token 60 s before it expires (a warning toast appears only when that fails, e.g. the Pi is offline), restores a session whose token expired while the tab was closed (`authGuard` -> `restoreSession()`, only when an old token is still in localStorage, so the portfolio never calls the backend), and `SocketService` reconnects when the token changes (the backend ties the socket session to the handshake token).
- `GET/POST /alarms`, `POST /alarms/play`, `GET /greetings`: `Authorization: Bearer <jwt>`. `POST /greetings` is public (max 500 characters, 3/min and 20/h per visitor). `POST /login` allows 5 failed attempts per minute per visitor; both answer `429` when exceeded, which the UI must show as "too many attempts", not as "offline".
- `GET /stats/history`: `Authorization: Bearer <jwt>`, the last 120 samples `{cpuUsage,cpuTemperature,ramUsage,humidity|null,temperature|null,timestamp}` oldest first (kept in memory by the backend, so they are gone after a restart); `StatsService` seeds the sparklines with them. Failure is not fatal (charts start empty).
- `GET /health` (public) is the liveness probe used by `BackendStatusService`.
- All REST goes through `env.backendApiUrl` = `<host>/api` (nginx strips `/api`; the old `/flask` alias still works on the Pi until it is removed).
- Socket.IO on `env.websocketUrl` (`/socket.io`) requires a valid JWT in the handshake (`auth: { token }`); otherwise the server refuses with `unauthorized`. `SocketService` connects only while a token exists and logs out on `unauthorized`. Server pushes every 5 s: `system_stats_update` `{cpuUsage,cpuTemperature,ramUsage}` and `ble_update` `{humidity,temperature,voltage,lastUpdated,stale}` (`stale`: no reading yet or older than 5 min; the UI does not use it yet). Client sends event `message` with a direction name (`UP`, `DOWN_LEFT`, `CENTER`, …) or `LED<0-255>`.
- HLS: `${env.hlsUrl}/cam1/index.m3u8?jwt=<token>` (MediaMTX validates the same JWT).
- Backend CORS only allows `https://filipwisniewski.pl` (+ `www`). For local dev against the Pi, set `EXTRA_ALLOWED_ORIGINS` on the backend.

## Mock backend (no Raspberry)

- `mock-server/server.js` implements the same contract as the real backend, so keep it in sync whenever an endpoint, payload or socket event changes (also change `../The-Raspberry-SPY-backend` and the contract section above).
- Failure simulation for testing offline/error states: `curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"offline": true}'` (also `latencyMs`, `failWith: 500`); reset with `{"offline": false, "latencyMs": 0, "failWith": null}`. `offline` drops the sockets abruptly, like a Pi that lost power.
- With `env.mock` the stream page shows a generated test pattern (`video-stream/mock-camera.ts`, lazy-loaded) instead of HLS.
- The same `mock` configuration works against the real backend in fake-hardware mode (`python main.py --fake`, demo / demo).

## Conventions

- Prettier: 4 spaces, single quotes, **no semicolons**, `printWidth` 150, `arrowParens: avoid`. Run `npm run lint` before committing.
- Components are standalone with `templateUrl`/`styleUrl`. Files and classes are named after the thing, without a `.component` / `Component` suffix (`login.ts` with `class Login`, `alarm.ts` with `AlarmCard` because `Alarm` is the API model). Selectors are a mix of `app-*` and plain names; keep the one of the component you touch. Use signals for state, `inject()` instead of constructor DI.
- BEM-style SCSS class names (`header__tabs__tab`); mobile support via `@media (max-width: 600px)`.
- **Use the design tokens and shared classes** from `styles.scss` (`var(--accent)`, `var(--card)`, `.button`, `.card`, `.field`, `.notice`...) instead of hardcoded colors, so light and dark mode both work. Never use `alert()`: inject `ToastService`. Every interactive element needs an accessible name (visible label or `aria-label`), a visible focus state (global `:focus-visible`), and must work with the keyboard; verify new pages with axe in both themes.
- Keep `public/CNAME` and the `404.html` copy step in `deploy.yml` (SPA deep-link fallback on Pages) intact.
- Commit messages: short imperative summary.

## Gotchas

- Never point `environment.prod.ts` at `http://` URLs – the site is HTTPS, browsers block mixed content.
- The Pages site is static; there is no server to hide secrets. Nothing secret belongs in this repo.
- The socket is created with `autoConnect: false` and connects/disconnects reactively with the `AuthService.token` signal. Components must not assume it is connected (`emit` is a no-op while disconnected). The header `Stats` only renders when logged in.
- Several `alert()` calls are used for UX (session expiry, greetings). Prefer replacing them with in-page toasts when touching that code.
- The Raspberry being off is a normal state. `BackendStatusService.status()` / `isOffline()` drive the global banner and disabled submit buttons; use `isBackendUnreachable(error)` and `BACKEND_OFFLINE_MESSAGE` in new error handlers instead of showing a generic failure. Do not inject `BackendStatusService` into code that runs while it is being constructed (its interceptor injects it lazily; `app.config.ts` triggers the first `check()` through an app initializer).
- Portfolio copy lives in `portfolio.data.ts` and `portfolio.html`; keep it factual (taken from the GitHub profile) and don't add claims about Filip that are not public. The portfolio must not require the backend: it only shows the status badge, which re-checks `/health` every 30 s.
- Keep the first load small (Lighthouse mobile ~91): the public pages must not import `@fortawesome/angular-fontawesome` or `@angular/forms` eagerly. Use `<app-icon [icon]="faX">` (`components/icon`) there, keep `login` lazy and the greeting form inside `@defer`; `<fa-icon>` is fine inside the lazy `/app` area. Check with `npm run build` ("Initial total", currently ~342 kB raw / 98 kB transferred) and measure Lighthouse against a gzip-capable server (`npx serve dist/raspberry-ui/browser`), not `http-server`.
- The `SocketService` (socket.io-client) must stay out of the portfolio bundle: only inject it from components inside the lazy `/app` area.
- **Code that runs during the pre-render must be server-safe**: no `localStorage`, `window` or `document` at construction time and no calls to the Raspberry. Use `isPlatformBrowser(inject(PLATFORM_ID))` or `afterNextRender()` (see `AuthService`, the app initializer in `app.config.ts`, `Portfolio`). State that differs per visitor (signed in or not) must be resolved in `afterNextRender`, otherwise hydration mismatches the pre-rendered HTML.
- SEO basics live in three places: `src/index.html` (title, description, canonical, Open Graph/Twitter, JSON-LD, icons), `public/` (robots, sitemap, manifest, images) and `SeoService` (noindex). The domain `https://filipwisniewski.pl` is hardcoded in `index.html` and `sitemap.xml`. When adding a public route add it to `sitemap.xml`, `app.routes.server.ts` (`RenderMode.Prerender`) and give it a route `title`.
- The social preview, icons and webp images were generated with throw-away puppeteer/sharp scripts (not in the repo); keep `og-image.jpg` at 1200x630.
- Fonts (Roboto 400/700, latin and latin-ext for the Polish letters) are self-hosted through `@fontsource/roboto` entries in `angular.json` `styles`; do not add Google Fonts links back.
- Dark mode: CSS variables switch through `prefers-color-scheme` unless the visitor picked a theme (`data-theme` on `<html>`, applied by an inline script in `index.html` before the first paint). `ThemeToggle` resolves its icon after hydration because the pre-rendered page cannot know the theme.
- The stream page needs `SocketService.connected` and `BackendStatusService` to enable the steering controls; keyboard control (arrows, C) is handled in `VideoStream`.

## Tests and CI

- Specs live next to the code (`*.spec.ts`), 90+ of them: services (auth expiry timers, backend status, stats history, theme, toasts, SEO, API calls), guards, the route table (redirects, guards, noindex), and the main components (login, greetings, portfolio, stream page keyboard control, alarms unsaved-changes flow). Write a spec for new logic; use `HttpTestingController` for HTTP, `vi.useFakeTimers()` / `vi.advanceTimersByTime()` for timers, `vi.fn()` / `vi.spyOn()` for spies (import `vi` from `vitest`), and stub `SocketService` (`{ connected: signal(true), emit, listen }`) instead of opening a socket (its own spec replaces `SOCKET_FACTORY`). `test:ci` fails when coverage drops below the thresholds in `angular.json` (`coverageThresholds`).
- **Zoneless pitfall**: templates must read signals (or state changed by DOM events). A plain `FormControl.value` changed from code does not refresh the view; wrap it with `toSignal(control.valueChanges, ...)` (see `Greetings`).
- `.github/workflows/ci.yml` is one pipeline: `verify` (npm ci, lint, `test:ci`, build with pre-rendering, `check:build`, 404.html fallback) and `deploy` (GitHub Pages) which `needs: [verify, e2e]` and runs only for pushes to `master`. Pull requests run `verify` only. Never deploy from another workflow.
- End-to-end tests (`e2e/*.spec.ts`, config `playwright.config.ts`) drive the real UI in Chromium against the mock server: portfolio without backend, theme, login/logout, wrong password, 429, redirects, stats from the socket, alarm edit/save/discard, offline banner and recovery; `a11y.spec.ts` runs axe (WCAG 2.0/2.1 A and AA) on every page in both themes, on desktop and the `mobile` (Pixel 7) project, which also runs `*.mobile.spec.ts` (no horizontal scroll, bottom nav). New pages need an axe case. They change the mock's state, so they run serially and `e2e/fixtures.ts` resets the failure simulation around each test. Prefer role/label locators; the `.switch` checkbox is visually hidden, click its label. CI runs them as the `e2e` job; `deploy` needs both `verify` and `e2e`.
- Dependabot opens weekly PRs for npm (Angular packages grouped) and GitHub Actions.
