/*
 * Contract test: the same requests against any implementation of the backend contract (see AGENTS.md).
 *
 *   npm run contract                                  # the mock server (starts it on :8089)
 *   npm run contract -- http://localhost:8080         # an already running backend, e.g. `python main.py --fake` (demo / demo)
 *
 * It changes the alarms and the camera settings (and restores them) and posts a greeting, so do not point it at the real Raspberry. The greeting rate limit of the real backend
 * is kept in memory: restart it before running the test a second time within a minute.
 */
import { spawn } from 'node:child_process'
import { io } from 'socket.io-client'

const given = process.argv[2]
const MOCK_PORT = 8089
const base = given ?? `http://localhost:${MOCK_PORT}`
const origin = process.env.CONTRACT_ORIGIN ?? 'https://filipwisniewski.pl'
const username = process.env.CONTRACT_USER ?? 'demo'
const password = process.env.CONTRACT_PASSWORD ?? 'demo'

let mock
if (!given) {
    mock = spawn('node', ['mock-server/server.js'], {
        env: { ...process.env, MOCK_PORT: String(MOCK_PORT), MOCK_STATS_INTERVAL_MS: '300' },
        stdio: 'ignore',
    })
}

const results = []
async function check(name, body) {
    try {
        await body()
        results.push({ name })
    } catch (error) {
        results.push({ name, error })
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

const call = (path, { token, method = 'GET', json, raw, cookie } = {}) =>
    fetch(base + path, {
        method,
        headers: {
            origin,
            ...(cookie ? { cookie } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(json !== undefined || raw ? { 'content-type': 'application/json' } : {}),
        },
        body: raw ?? (json === undefined ? undefined : JSON.stringify(json)),
    })

async function waitForServer() {
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            if ((await call('/health')).ok) return
        } catch {
            /* not up yet */
        }
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`${base} did not answer /health`)
}

function connectSocket(token) {
    return new Promise(resolve => {
        const socket = io(base, {
            path: '/socket.io',
            transports: ['websocket'],
            upgrade: false,
            reconnection: false,
            auth: { token },
            extraHeaders: { origin },
        })
        socket.on('connect', () => resolve({ socket }))
        socket.on('connect_error', error => resolve({ error: error.message, socket }))
    })
}

function nextEvent(socket, name) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no "${name}" event within 8 s`)), 8000)
        socket.once(name, data => {
            clearTimeout(timer)
            resolve(data)
        })
    })
}

try {
    await waitForServer()
    let token = ''
    let originalAlarms = []

    await check('GET /health is public and says ok', async () => {
        const response = await call('/health')
        assert(response.status === 200, `status ${response.status}`)
        assert((await response.json()).status === 'ok', 'body must be {status: "ok"}')
    })

    await check('POST /login with a wrong password answers 401 {msg}', async () => {
        const response = await call('/login', { method: 'POST', json: { username, password: 'definitely-wrong' } })
        assert(response.status === 401, `status ${response.status}`)
        assert(typeof (await response.json()).msg === 'string', 'body must have a "msg" string')
    })

    await check('POST /login returns a JWT and its expiry', async () => {
        const response = await call('/login', { method: 'POST', json: { username, password } })
        assert(response.status === 200, `status ${response.status}`)
        const body = await response.json()
        token = body.access_token
        assert(/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token), 'access_token must be a JWT')
        const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp
        assert(Number.isInteger(exp) && exp > Date.now() / 1000, 'the token needs a future `exp` claim')
        assert(Math.abs(new Date(body.expires_at).getTime() / 1000 - exp) < 5, 'expires_at must match the `exp` claim')
    })

    // The refresh token lives in an httpOnly cookie: it is never in a body, the test plays the browser's cookie jar
    const cookieOf = response => response.headers.getSetCookie().find(value => value.startsWith('refresh_token='))
    const pair = cookie => cookie.split(';')[0]
    let refreshCookie = ''

    await check('POST /login sets an httpOnly, SameSite=Strict refresh cookie (not in the body)', async () => {
        const response = await call('/login', { method: 'POST', json: { username, password } })
        const cookie = cookieOf(response)
        assert(cookie, 'no refresh_token cookie in Set-Cookie')
        assert(/;\s*HttpOnly/i.test(cookie), 'the cookie must be HttpOnly')
        assert(/;\s*SameSite=Strict/i.test(cookie), 'the cookie must be SameSite=Strict')
        assert(!JSON.stringify(await response.json()).includes(pair(cookie).split('=')[1]), 'the refresh token must not be in the body')
        assert(response.headers.get('access-control-allow-credentials') === 'true', 'CORS must allow credentials')
        refreshCookie = pair(cookie)
    })

    await check('POST /refresh trades the cookie for a new access token and a new cookie', async () => {
        const response = await call('/refresh', { method: 'POST', json: {}, cookie: refreshCookie })
        assert(response.status === 200, `status ${response.status}`)
        const body = await response.json()
        const exp = JSON.parse(Buffer.from(body.access_token.split('.')[1], 'base64url').toString()).exp
        assert(exp > Date.now() / 1000 && typeof body.expires_at === 'string', 'expected a fresh access token with expires_at')
        const next = cookieOf(response)
        assert(next && pair(next) !== refreshCookie, 'the refresh cookie must be rotated')
        refreshCookie = pair(next)
    })

    await check('POST /refresh without a valid cookie answers 401 {msg}', async () => {
        for (const cookie of [undefined, 'refresh_token=made-up']) {
            const response = await call('/refresh', { method: 'POST', json: {}, cookie })
            assert(response.status === 401, `${cookie ?? 'no cookie'}: status ${response.status}`)
            assert(typeof (await response.json()).msg === 'string', 'body must have a "msg" string')
        }
    })

    await check('POST /logout revokes the refresh token', async () => {
        const response = await call('/logout', { method: 'POST', json: {}, cookie: refreshCookie })
        assert(response.status === 204, `status ${response.status}`)
        assert((await call('/refresh', { method: 'POST', json: {}, cookie: refreshCookie })).status === 401, 'the revoked token must not work')
    })

    await check('protected endpoints answer 401 {msg} without a token', async () => {
        for (const [method, path] of [
            ['GET', '/alarms'],
            ['POST', '/alarms'],
            ['POST', '/alarms/play'],
            ['GET', '/greetings'],
            ['GET', '/camera/settings'],
            ['PUT', '/camera/settings'],
            ['POST', '/stream-token'],
        ]) {
            const response = await call(path, { method, json: method === 'POST' || method === 'PUT' ? [] : undefined })
            assert(response.status === 401, `${method} ${path}: status ${response.status}`)
            assert(typeof (await response.json()).msg === 'string', `${method} ${path}: body must have a "msg" string`)
        }
    })

    await check('POST /stream-token returns a short-lived token that the API refuses', async () => {
        const response = await call('/stream-token', { token, method: 'POST', json: {} })
        assert(response.status === 200, `status ${response.status}`)
        const body = await response.json()
        assert(/^[\w-]+\.[\w-]+\.[\w-]+$/.test(body.stream_token), 'stream_token must be a JWT')
        assert(typeof body.expires_at === 'string', 'expires_at must be a string')
        const claims = JSON.parse(Buffer.from(body.stream_token.split('.')[1], 'base64url').toString())
        assert(claims.exp - claims.iat <= 300, `a stream token must be short-lived, this one lasts ${claims.exp - claims.iat} s`)
        assert(claims.scope === 'stream', 'the token needs the claim scope = "stream"')
        for (const [method, path] of [
            ['GET', '/alarms'],
            ['POST', '/stream-token'],
        ]) {
            const refused = await call(path, { token: body.stream_token, method, json: method === 'POST' ? {} : undefined })
            assert(refused.status === 401, `${method} ${path} with a stream token: status ${refused.status}`)
        }
        const socket = await connectSocket(body.stream_token)
        socket.socket.close()
        assert(socket.error === 'unauthorized', 'the socket must refuse a stream token')
    })

    await check('GET /alarms lists one entry per day', async () => {
        const response = await call('/alarms', { token })
        assert(response.status === 200, `status ${response.status}`)
        originalAlarms = await response.json()
        assert(Array.isArray(originalAlarms) && originalAlarms.length === 7, 'expected 7 alarms')
        for (const alarm of originalAlarms) {
            assert(
                typeof alarm.day === 'string' && Number.isInteger(alarm.hour) && Number.isInteger(alarm.minute),
                `bad alarm ${JSON.stringify(alarm)}`
            )
            assert(typeof alarm.melody === 'string' && typeof alarm.enabled === 'boolean', `bad alarm ${JSON.stringify(alarm)}`)
        }
    })

    await check('POST /alarms validates (400 {error}) and stores (201)', async () => {
        for (const bad of [
            {},
            [{ ...originalAlarms[0], hour: 24 }],
            [{ ...originalAlarms[0], melody: 'No such tune' }],
            [{ ...originalAlarms[0], enabled: 'yes' }],
        ]) {
            const response = await call('/alarms', { token, method: 'POST', json: bad })
            assert(response.status === 400, `${JSON.stringify(bad)}: status ${response.status}`)
            assert(typeof (await response.json()).error === 'string', 'body must have an "error" string')
        }
        const changed = originalAlarms.map((alarm, index) => (index === 0 ? { ...alarm, minute: (alarm.minute + 1) % 60 } : alarm))
        assert((await call('/alarms', { token, method: 'POST', json: changed })).status === 201, 'saving must answer 201')
        assert((await (await call('/alarms', { token })).json())[0].minute === changed[0].minute, 'the change must be returned afterwards')
        assert((await call('/alarms', { token, method: 'POST', json: originalAlarms })).status === 201, 'restoring must answer 201')
    })

    await check('POST /alarms/play validates the melody', async () => {
        const unknown = await call('/alarms/play', { token, method: 'POST', json: { melody: 'No such tune' } })
        assert(unknown.status === 400, `unknown melody: status ${unknown.status}`)
        assert(typeof (await unknown.json()).error === 'string', 'body must have an "error" string')
        const known = await call('/alarms/play', { token, method: 'POST', json: { melody: originalAlarms[0].melody } })
        assert(known.status === 204, `known melody: status ${known.status}`)
    })

    // The real backend allows 3 greetings per minute per visitor (rejected ones count), so this test sends exactly three
    await check('POST /greetings is public and rejects too long and non-JSON bodies', async () => {
        const tooLong = await call('/greetings', { method: 'POST', json: { text: 'x'.repeat(501) } })
        assert(tooLong.status === 400, `501 characters: status ${tooLong.status}`)
        assert(typeof (await tooLong.json()).error === 'string', 'body must have an "error" string')
        const notJson = await call('/greetings', { method: 'POST', raw: 'not json' })
        assert(notJson.status === 400, `non-JSON body: status ${notJson.status}`)
        const ok = await call('/greetings', { method: 'POST', json: { text: 'Hello from the contract test' } })
        assert(ok.status === 201, `status ${ok.status}`)
    })

    await check('GET /greetings returns the texts to the owner', async () => {
        const response = await call('/greetings', { token })
        assert(response.status === 200, `status ${response.status}`)
        const greetings = await response.json()
        const last = greetings.at(-1)
        assert(last.text === 'Hello from the contract test' && typeof last.timestamp === 'string', `unexpected ${JSON.stringify(last)}`)
    })

    await check('GET /stats/history needs a token and lists samples, oldest first', async () => {
        const denied = await call('/stats/history')
        assert(denied.status === 401, `without a token: status ${denied.status}`)
        // samples are added by the 5 s broadcast; the Socket.IO checks below make sure at least one tick has happened
        const response = await call('/stats/history', { token })
        assert(response.status === 200, `status ${response.status}`)
        const samples = await response.json()
        assert(Array.isArray(samples), 'expected a list')
        for (const sample of samples) {
            for (const key of ['cpuUsage', 'cpuTemperature', 'ramUsage', 'timestamp'])
                assert(typeof sample[key] === 'number', `sample.${key} must be a number`)
            for (const key of ['humidity', 'temperature'])
                assert(sample[key] === null || typeof sample[key] === 'number', `sample.${key} must be a number or null`)
        }
        assert(
            samples.every((sample, index) => index === 0 || sample.timestamp >= samples[index - 1].timestamp),
            'oldest first'
        )
    })

    await check('GET/PUT /camera/settings validate (400 {error}) and store the stream settings', async () => {
        const response = await call('/camera/settings', { token })
        assert(response.status === 200, `status ${response.status}`)
        const { settings, defaults, applied } = await response.json()
        assert(settings && defaults && typeof applied === 'boolean', 'expected {settings, defaults, applied}')
        for (const key of ['fps', 'bitrate', 'brightness', 'contrast', 'saturation', 'sharpness', 'lensPosition'])
            assert(typeof settings[key] === 'number', `settings.${key} must be a number`)
        for (const key of ['hFlip', 'vFlip']) assert(typeof settings[key] === 'boolean', `settings.${key} must be a boolean`)
        for (const key of ['resolution', 'exposure', 'awb', 'afMode']) assert(typeof settings[key] === 'string', `settings.${key} must be a string`)

        // the real backend allows 10 changes per minute, the checks of this file make 10 (rejected ones count)
        for (const bad of [
            [],
            { ...settings, fps: 99 },
            { ...settings, resolution: '7680x4320' },
            { ...settings, lensPosition: 11 },
            { ...settings, afMode: 'custom' },
            { ...settings, awb: 'custom' },
            { fps: 20 },
        ]) {
            const refused = await call('/camera/settings', { token, method: 'PUT', json: bad })
            assert(refused.status === 400, `${JSON.stringify(bad)}: status ${refused.status}`)
            assert(typeof (await refused.json()).error === 'string', 'body must have an "error" string')
        }
        const changed = { ...settings, fps: settings.fps === 15 ? 20 : 15, vFlip: !settings.vFlip }
        const saved = await call('/camera/settings', { token, method: 'PUT', json: changed })
        assert(saved.status === 200, `saving: status ${saved.status}`)
        assert(JSON.stringify((await saved.json()).settings) === JSON.stringify(changed), 'the saved settings must be returned')
        assert(
            JSON.stringify((await (await call('/camera/settings', { token })).json()).settings) === JSON.stringify(changed),
            'the change must be returned afterwards'
        )
        assert((await call('/camera/settings', { token, method: 'PUT', json: settings })).status === 200, 'restoring must answer 200')
    })

    await check('an applied PUT /camera/settings pushes camera_stream_restart to the connected clients', async () => {
        const current = (await (await call('/camera/settings', { token })).json()).settings
        const { socket, error } = await connectSocket(token)
        try {
            assert(!error, `connect_error: ${error}`)
            const restart = nextEvent(socket, 'camera_stream_restart')
            const saved = await call('/camera/settings', { token, method: 'PUT', json: current })
            assert(saved.status === 200, `status ${saved.status}`)
            const event = await restart
            assert(typeof event.reason === 'string', 'the event needs a "reason" string')
        } finally {
            socket.close()
        }
    })

    await check('Socket.IO refuses a missing or forged token with "unauthorized"', async () => {
        for (const bad of [undefined, 'garbage', `${token.slice(0, -4)}AAAA`]) {
            const { error, socket } = await connectSocket(bad)
            socket.close()
            assert(error === 'unauthorized', `token ${bad === undefined ? '(none)' : bad.slice(0, 8)}: got ${error ?? 'a connection'}`)
        }
    })

    await check('Socket.IO with a valid token pushes the stats events', async () => {
        const { socket, error } = await connectSocket(token)
        try {
            assert(!error, `connect_error: ${error}`)
            const [system, climate] = await Promise.all([nextEvent(socket, 'system_stats_update'), nextEvent(socket, 'ble_update')])
            for (const key of ['cpuUsage', 'cpuTemperature', 'ramUsage'])
                assert(typeof system[key] === 'number', `system_stats_update.${key} must be a number`)
            for (const key of ['humidity', 'temperature', 'voltage']) assert(typeof climate[key] === 'number', `ble_update.${key} must be a number`)
            assert(typeof climate.lastUpdated === 'string', 'ble_update.lastUpdated must be a string')
            assert(typeof climate.stale === 'boolean', 'ble_update.stale must be a boolean')
            socket.emit('message', 'UP')
            socket.emit('message', 'LED128')
            socket.emit('message', 'NOT_A_COMMAND')
            await new Promise(resolve => setTimeout(resolve, 300))
            assert(socket.connected, 'control messages (even unknown ones) must not drop the connection')
        } finally {
            socket.close()
        }
    })
} finally {
    mock?.kill()
}

let failed = 0
for (const { name, error } of results) {
    console.log(`${error ? '✗' : '✓'} ${name}`)
    if (error) {
        failed++
        console.log(`    ${error.message}`)
    }
}
console.log(`\n${results.length - failed}/${results.length} passed against ${base}`)
process.exit(failed ? 1 : 0)
