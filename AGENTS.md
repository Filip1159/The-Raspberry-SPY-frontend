# The Raspberry SPY – frontend

Angular SPA for a home-built Raspberry Pi 5 camera/alarm system. Hosted on **GitHub Pages** at `https://filipwisniewski.pl`. The backend runs on the Raspberry at home and is exposed through a **Cloudflare Tunnel** at `https://api.filipwisniewski.pl`. When the Pi is off, the backend is unreachable – that is a normal state, not a bug.

Backend repo: `../The-Raspberry-SPY-backend` (Python/Flask). Planned work lives in `BACKLOG.md` (covers both repos).

## Stack

- Angular 21, **standalone components, zoneless** (`provideZonelessChangeDetection`), signals, `inject()`. No NgModules, no zone.js.
- TypeScript strict (`strictTemplates`, `noPropertyAccessFromIndexSignature`), SCSS, FontAwesome icons.
- `socket.io-client` (websocket transport only) for live data and camera controls; `HttpClient` for REST; plain `<video src>` for HLS (native browser playback, no hls.js).
- Tests: Karma + Jasmine (`ng test`). Lint: angular-eslint + prettier via eslint (`ng lint`).

## Commands

```bash
npm ci
npm start          # ng serve on 192.168.1.105 (hardcoded LAN IP of the dev machine – edit if needed), talks to the Pi
npm run start:mock # no Raspberry needed: mock backend (mock-server/, :8080) + ng serve --configuration mock (:4200). Login demo / demo
npm run start:ui   # only the UI in the mock configuration, e.g. against the real backend started with `python main.py --fake`
npm run build      # production build -> dist/raspberry-ui/browser
npm run lint       # must pass, CI fails otherwise
npm run format     # prettier --write .
npm test -- --browsers=ChromeHeadlessCI --watch=false
```

## Layout

```
src/
  main.ts, app.config.ts, app.routes.ts
  environment.ts          # dev: LAN IP of the Pi (http://192.168.1.105:8080/8888)
  environment.prod.ts     # prod: https://api.filipwisniewski.pl  (swapped in by angular.json fileReplacements)
  environment.mock.ts     # mock configuration: http://localhost:8080 (mock-server or the backend in fake mode), `mock: true`
  components/
    root/                 # <backend-status-banner/> + <app-header/> + <mobile-nav/> + <router-outlet/>
    backend-status-banner/ # "Raspberry is probably switched off" bar
    header/ (+ mobile/)   # tabs, logout, stats dropdown
    about-me/             # landing page "/" (to become portfolio, see BACKLOG)
    login/  greetings/  alarm-manager/ (+ alarm/)  video-stream/ (+ slider, longpress-button)  stats/ (+ mobile/)
  service/
    auth.service.ts       # JWT in localStorage ('jwt'), expiry timers, 15 s warning via alert()
    auth.guard.ts         # redirects to /login
    raspberry.api.ts      # all REST calls; token passed manually per call (no interceptor)
    socket.service.ts     # single socket.io connection, listen<T>() returns Observable
    backend-status.service.ts / .interceptor.ts   # online/offline detection for the Raspberry (see Gotchas)
mock-server/server.js      # Express + Socket.IO fake of the backend contract (health, login, alarms, greetings, stats, JWT handshake) + failure simulation
public/                   # CNAME (custom domain – keep!), favicon, me.jpg, raspberry-pi.svg
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
- `about-me` still links to old repo names (`raspberry-backend`, `raspberry-ui`); the real ones are `The-Raspberry-SPY-backend/-frontend`.
- The Raspberry being off is a normal state. `BackendStatusService.status()` / `isOffline()` drive the global banner and disabled submit buttons; use `isBackendUnreachable(error)` and `BACKEND_OFFLINE_MESSAGE` in new error handlers instead of showing a generic failure. Do not inject `BackendStatusService` into code that runs while it is being constructed (its interceptor injects it lazily; `app.config.ts` triggers the first `check()` through an app initializer).
