# The Raspberry SPY – frontend

Angular SPA: Filip's **portfolio** (public, `/`) plus the control panel of a home-built Raspberry Pi 5 camera/alarm system (signed-in area, `/app/*`). Hosted on **GitHub Pages** at `https://filipwisniewski.pl`. The backend runs on the Raspberry at home and is exposed through a **Cloudflare Tunnel** at `https://api.filipwisniewski.pl`. When the Pi is off, the backend is unreachable – that is a normal state, not a bug.

Backend repo: `../The-Raspberry-SPY-backend` (Python/Flask). Planned work lives in `BACKLOG.md` (covers both repos).

## Stack

- Angular 21, **standalone components, zoneless** (`provideZonelessChangeDetection`), signals, `inject()`. No NgModules, no zone.js.
- **The production build pre-renders the public portfolio** (`outputMode: static` + `prerender` in the `production` configuration, `@angular/ssr`): `dist/raspberry-ui/browser/index.html` is the finished portfolio page, `index.csr.html` is the client-only shell used for `/login` and `/app/*`. Dev and mock builds are client-only. Hydration is enabled.
- TypeScript strict (`strictTemplates`, `noPropertyAccessFromIndexSignature`), SCSS, FontAwesome icons.
- `socket.io-client` (websocket transport only) for live data and camera controls; `HttpClient` for REST; plain `<video src>` for HLS (native browser playback, no hls.js).
- Tests: Karma + Jasmine (`ng test`). Lint: angular-eslint + prettier via eslint (`ng lint`).

## Commands

```bash
npm ci
npm start          # ng serve on 192.168.1.105 (hardcoded LAN IP of the dev machine – edit if needed), talks to the Pi
npm run start:mock # no Raspberry needed: mock backend (mock-server/, :8080) + ng serve --configuration mock (:4200). Login demo / demo
npm run start:ui   # only the UI in the mock configuration, e.g. against the real backend started with `python main.py --fake`
npm run build      # production build + pre-rendering -> dist/raspberry-ui/browser (index.html = portfolio, index.csr.html = SPA shell, copied to 404.html by deploy.yml)
npm run lint       # must pass, CI fails otherwise
npm run format     # prettier --write .
npm test -- --browsers=ChromeHeadlessCI --watch=false
```

## Routes

```
/                public portfolio (own nav, no app header, no websocket, works with the backend down)
/login           public sign-in page (+ offline banner)
/app/video       signed-in area (authGuard on the parent, lazy-loaded AppShell = banner + header tabs + mobile nav)
/app/alarm
/app/stats       mobile "Other" tab (CPU/RAM/BLE stats + logout)
/video /alarm /mobile-stats /greetings  -> redirects (old URLs); anything unknown -> /
```

## Layout

```
src/
  main.ts, main.server.ts, app.config.ts, app.config.server.ts, app.routes.ts, app.routes.server.ts   # server routes: '' is pre-rendered, everything else client-side
  environment.ts          # dev: LAN IP of the Pi (http://192.168.1.105:8080/8888)
  environment.prod.ts     # prod: https://api.filipwisniewski.pl  (swapped in by angular.json fileReplacements)
  environment.mock.ts     # mock configuration: http://localhost:8080 (mock-server or the backend in fake mode), `mock: true`
  components/
    root/                 # just <router-outlet/>
    portfolio/            # public landing page: portfolio.ts/html/scss, portfolio.data.ts (ALL copy: skills, projects, links), raspberry-spy-section/ (status badge + gallery + embedded greeting form)
    shell/                # AppShell: layout of the signed-in area
    header/ (+ mobile/)   # tabs (Live stream, Alarm, Portfolio), logout, stats dropdown; mobile bottom nav
    backend-status-banner/ # "Raspberry is probably switched off" bar (shell + login)
    login/  greetings/ (embedded widget, not a page)  alarm-manager/ (+ alarm/)  video-stream/ (+ slider, longpress-button, mock-camera)  stats/ (+ mobile/)
  service/
    auth.service.ts       # JWT in localStorage ('jwt'), expiry timers, 15 s warning via alert()
    auth.guard.ts         # redirects to /login
    raspberry.api.ts      # all REST calls; token passed manually per call (no interceptor)
    socket.service.ts     # single socket.io connection, listen<T>() returns Observable
    backend-status.service.ts / .interceptor.ts   # online/offline detection for the Raspberry (see Gotchas)
    seo.service.ts        # adds `noindex` for routes with `data: { noindex: true }` (login, /app)
mock-server/server.js      # Express + Socket.IO fake of the backend contract (health, login, alarms, greetings, stats, JWT handshake) + failure simulation
public/                   # CNAME (custom domain – keep!), robots.txt, sitemap.xml, site.webmanifest, favicons/icons, raspberry-pi.svg, img/ (photos as jpg + webp, og-image.jpg for link previews)
.github/workflows/        # ci.yml (lint+test on push/PR), deploy.yml (build + GitHub Pages on master)
```

## Backend contract (what the UI depends on)

- `POST /login` `{username,password}` -> `{access_token, expires_at}`; RS256 JWT, 30 min lifetime, no refresh.
- `GET/POST /alarms`, `POST /alarms/play`: `Authorization: Bearer <jwt>`. `POST /greetings` is public.
- `GET /health` (public) is the liveness probe used by `BackendStatusService`.
- All REST goes through `env.backendApiUrl` = `<host>/flask` (nginx strips `/flask`).
- Socket.IO on `env.websocketUrl` (`/socket.io`) requires a valid JWT in the handshake (`auth: { token }`); otherwise the server refuses with `unauthorized`. `SocketService` connects only while a token exists and logs out on `unauthorized`. Server pushes every 5 s: `system_stats_update` `{cpuUsage,cpuTemperature,ramUsage}` and `ble_update` `{humidity,temperature,voltage,lastUpdated}`. Client sends event `message` with a direction name (`UP`, `DOWN_LEFT`, `CENTER`, …) or `LED<0-255>`.
- HLS: `${env.hlsUrl}/cam1/index.m3u8?jwt=<token>` (MediaMTX validates the same JWT).
- Backend CORS only allows `https://filipwisniewski.pl` (+ `www`). For local dev against the Pi, set `EXTRA_ALLOWED_ORIGINS` on the backend.

## Mock backend (no Raspberry)

- `mock-server/server.js` implements the same contract as the real backend, so keep it in sync whenever an endpoint, payload or socket event changes (also change `../The-Raspberry-SPY-backend` and the contract section above).
- Failure simulation for testing offline/error states: `curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"offline": true}'` (also `latencyMs`, `failWith: 500`); reset with `{"offline": false, "latencyMs": 0, "failWith": null}`. `offline` drops the sockets abruptly, like a Pi that lost power.
- With `env.mock` the stream page shows a generated test pattern (`video-stream/mock-camera.ts`, lazy-loaded) instead of HLS.
- The same `mock` configuration works against the real backend in fake-hardware mode (`python main.py --fake`, demo / demo).

## Conventions

- Prettier: 4 spaces, single quotes, **no semicolons**, `printWidth` 150, `arrowParens: avoid`. Run `npm run lint` before committing.
- Components are standalone with `templateUrl`/`styleUrl`. Older files use `*.component.ts`, newer ones just `login.ts`/`stats.ts` – follow the folder you are in. Use signals for state, `inject()` instead of constructor DI.
- BEM-style SCSS class names (`header__tabs__tab`); mobile support via `@media (max-width: 600px)`.
- Keep `public/CNAME` and the `404.html` copy step in `deploy.yml` (SPA deep-link fallback on Pages) intact.
- Commit messages: short imperative summary.

## Gotchas

- Never point `environment.prod.ts` at `http://` URLs – the site is HTTPS, browsers block mixed content.
- The Pages site is static; there is no server to hide secrets. Nothing secret belongs in this repo.
- The socket is created with `autoConnect: false` and connects/disconnects reactively with the `AuthService.token` signal. Components must not assume it is connected (`emit` is a no-op while disconnected). The header `Stats` only renders when logged in.
- Several `alert()` calls are used for UX (session expiry, greetings). Prefer replacing them with in-page toasts when touching that code.
- The Raspberry being off is a normal state. `BackendStatusService.status()` / `isOffline()` drive the global banner and disabled submit buttons; use `isBackendUnreachable(error)` and `BACKEND_OFFLINE_MESSAGE` in new error handlers instead of showing a generic failure. Do not inject `BackendStatusService` into code that runs while it is being constructed (its interceptor injects it lazily; `app.config.ts` triggers the first `check()` through an app initializer).
- Portfolio copy lives in `portfolio.data.ts` and `portfolio.html`; keep it factual (taken from the GitHub profile) and don't add claims about Filip that are not public. The portfolio must not require the backend: it only shows the status badge, which re-checks `/health` every 30 s.
- The `SocketService` (socket.io-client) must stay out of the portfolio bundle: only inject it from components inside the lazy `/app` area.
- **Code that runs during the pre-render must be server-safe**: no `localStorage`, `window` or `document` at construction time and no calls to the Raspberry. Use `isPlatformBrowser(inject(PLATFORM_ID))` or `afterNextRender()` (see `AuthService`, the app initializer in `app.config.ts`, `Portfolio`). State that differs per visitor (signed in or not) must be resolved in `afterNextRender`, otherwise hydration mismatches the pre-rendered HTML.
- SEO basics live in three places: `src/index.html` (title, description, canonical, Open Graph/Twitter, JSON-LD, icons), `public/` (robots, sitemap, manifest, images) and `SeoService` (noindex). The domain `https://filipwisniewski.pl` is hardcoded in `index.html` and `sitemap.xml`. When adding a public route add it to `sitemap.xml`, `app.routes.server.ts` (`RenderMode.Prerender`) and give it a route `title`.
- The social preview, icons and webp images were generated with throw-away puppeteer/sharp scripts (not in the repo); keep `og-image.jpg` at 1200x630.
- Fonts (Roboto 400/700, latin and latin-ext for the Polish letters) are self-hosted through `@fontsource/roboto` entries in `angular.json` `styles`; do not add Google Fonts links back.
