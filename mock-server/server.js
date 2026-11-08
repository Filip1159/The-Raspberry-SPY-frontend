/*
 * Mock of the Raspberry backend, so the UI can be developed without the Raspberry: npm run start:mock
 *
 * Implements the same contract as The-Raspberry-SPY-backend (see AGENTS.md): /health, /login, /alarms, /alarms/play,
 * /refresh, /logout, /stream-token, /greetings, /stats/history, /camera/settings and Socket.IO (JWT handshake, 5 s stats broadcasts, 'message' control events).
 *
 * Failure simulation (for testing the offline/error states of the UI), e.g.
 *   curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"offline": true}'
 *   curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"latencyMs": 2000}'
 *   curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"failWith": 500}'   (429 shows the rate-limit messages)
 *   curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"offline": false, "latencyMs": 0, "failWith": null}'
 *   curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"cameraApplied": false}'   (camera settings are saved but not applied)
 *   curl -X POST localhost:8080/__mock/config -H 'content-type: application/json' -d '{"reset": true}'   (restores the alarms, greetings and camera settings)
 */
const crypto = require('crypto')
const http = require('http')
const cors = require('cors')
const express = require('express')
const { Server } = require('socket.io')

const PORT = Number(process.env.MOCK_PORT || 8080)
const USERNAME = process.env.MOCK_USER || 'demo'
const PASSWORD = process.env.MOCK_PASSWORD || 'demo'
const TOKEN_LIFETIME_SECONDS = Number(process.env.MOCK_TOKEN_SECONDS || 30 * 60)
const MAX_GREETING_LENGTH = 500
const STATS_INTERVAL_MS = Number(process.env.MOCK_STATS_INTERVAL_MS || 5000)

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MELODIES = ['Are you sleeping', 'Nokia', 'Old MacDonald', 'Panic', 'Pink panther', 'Pirates', 'Twinkle']

// Same allowlist and ranges as app/camera_settings.py of the backend
const CAMERA_DEFAULTS = {
    resolution: '1280x720',
    fps: 30,
    bitrate: 4000,
    hFlip: false,
    vFlip: false,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    sharpness: 1,
    exposure: 'normal',
    awb: 'auto',
    afMode: 'continuous',
    lensPosition: 0,
}
const CAMERA_RESOLUTIONS = ['1920x1080', '1280x720', '854x480', '640x360']
const CAMERA_EXPOSURES = ['normal', 'short', 'long']
const CAMERA_AF_MODES = ['continuous', 'manual']
const CAMERA_AWB = ['auto', 'incandescent', 'tungsten', 'fluorescent', 'indoor', 'daylight', 'cloudy']
const CAMERA_LIMITS = {
    fps: [5, 30],
    bitrate: [500, 10000],
    brightness: [-1, 1],
    contrast: [0, 4],
    saturation: [0, 4],
    sharpness: [0, 8],
    lensPosition: [0, 10],
}
const CAMERA_INTEGERS = ['fps', 'bitrate']
const CAMERA_CHANGES_PER_MINUTE = 10

/** The error message for invalid camera settings, or null */
function validateCameraSettings(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Body must be an object'
    const keys = Object.keys(CAMERA_DEFAULTS)
    if (Object.keys(data).length !== keys.length || !keys.every(key => key in data)) return `Expected exactly these settings: ${keys.join(', ')}`
    if (!CAMERA_RESOLUTIONS.includes(data.resolution)) return `Invalid resolution (one of ${CAMERA_RESOLUTIONS.join(', ')})`
    for (const key of ['hFlip', 'vFlip']) if (typeof data[key] !== 'boolean') return `Invalid ${key} value`
    for (const [key, [low, high]] of Object.entries(CAMERA_LIMITS)) {
        const value = data[key]
        if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < low ||
            value > high ||
            (CAMERA_INTEGERS.includes(key) && !Number.isInteger(value))
        )
            return `Invalid ${key} (between ${low} and ${high})`
    }
    if (!CAMERA_EXPOSURES.includes(data.exposure)) return `Invalid exposure (one of ${CAMERA_EXPOSURES.join(', ')})`
    if (!CAMERA_AWB.includes(data.awb)) return `Invalid awb (one of ${CAMERA_AWB.join(', ')})`
    if (!CAMERA_AF_MODES.includes(data.afMode)) return `Invalid afMode (one of ${CAMERA_AF_MODES.join(', ')})`
    return null
}

const secret = crypto.randomBytes(32)

const REFRESH_COOKIE = 'refresh_token'
const REFRESH_LIFETIME_SECONDS = 7 * 24 * 3600
const REFRESH_GRACE_SECONDS = 30
// refresh token -> expiry (epoch seconds). A spent token keeps working for the grace period, like in the real backend
const refreshTokens = new Map()

const initialAlarms = () => DAYS.map(day => ({ day, hour: 7, minute: 0, melody: 'Nokia', enabled: day !== 'saturday' && day !== 'sunday' }))

const state = {
    offline: false,
    latencyMs: 0,
    failWith: null,
    alarms: initialAlarms(),
    greetings: [],
    cameraSettings: { ...CAMERA_DEFAULTS },
    cameraChanges: [],
    // `applied: false` in the answers, like a backend whose MediaMTX is not reachable
    cameraApplied: true,
}

// Like the real backend: the latest samples of the 5 s broadcast, oldest first
const HISTORY_LENGTH = 120
const history = []

// ---- JWT (HS256 is enough here, the UI only reads the `exp` claim) ----

const base64url = value => Buffer.from(value).toString('base64url')

// Like the real backend: a short-lived token that only the video server accepts (it goes into URLs); the API refuses it
const STREAM_TOKEN_SECONDS = Number(process.env.MOCK_STREAM_TOKEN_SECONDS || 120)

function signToken(subject, lifetimeSeconds = TOKEN_LIFETIME_SECONDS, extraClaims = {}) {
    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = base64url(JSON.stringify({ sub: subject, iat: now, exp: now + lifetimeSeconds, ...extraClaims }))
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
    return { token: `${header}.${payload}.${signature}`, exp: now + lifetimeSeconds }
}

/** Returns the token claims, or null when the token is missing, forged or expired */
function verifyToken(token) {
    if (typeof token !== 'string') return null
    const [header, payload, signature] = token.split('.')
    if (!header || !payload || !signature) return null

    const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null

    try {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
        if (claims.scope === 'stream') return null
        return claims.exp > Math.floor(Date.now() / 1000) ? claims : null
    } catch {
        return null
    }
}

function readCookie(req, name) {
    const match = (req.headers.cookie ?? '')
        .split(';')
        .map(part => part.trim().split('='))
        .find(([key]) => key === name)
    return match ? match[1] : null
}

function issueRefreshToken(res) {
    const token = crypto.randomBytes(32).toString('base64url')
    refreshTokens.set(token, Math.floor(Date.now() / 1000) + REFRESH_LIFETIME_SECONDS)
    res.cookie(REFRESH_COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: REFRESH_LIFETIME_SECONDS * 1000 })
}

// ---- REST ----

const app = express()
// credentials: the refresh token travels in an httpOnly cookie, so the browser needs the explicit origin and the credentials header
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`)
    next()
})

app.get('/__mock/config', (_req, res) => res.json(configView()))
app.post('/__mock/config', (req, res) => {
    const { offline, latencyMs, failWith, reset, cameraApplied } = req.body ?? {}
    // `reset: true` restores the alarms, greetings and camera settings (data), not the failure simulation
    if (reset === true) {
        state.alarms = initialAlarms()
        state.greetings = []
        state.cameraSettings = { ...CAMERA_DEFAULTS }
        state.cameraChanges = []
        state.cameraApplied = true
    }
    if (typeof cameraApplied === 'boolean') state.cameraApplied = cameraApplied
    if (typeof offline === 'boolean') {
        state.offline = offline
        // Drop the connections abruptly, like a Raspberry that lost power (clients see a 'transport close')
        if (offline) io.sockets.sockets.forEach(socket => socket.conn.close())
    }
    if (typeof latencyMs === 'number') state.latencyMs = latencyMs
    if (failWith === null || typeof failWith === 'number') state.failWith = failWith ?? null
    console.log('Mock config:', configView())
    res.json(configView())
})

// Simulated failures apply to everything below
app.use((_req, res, next) => {
    if (state.offline) return res.status(503).json({ error: 'The mock backend is switched to offline' })
    setTimeout(() => (state.failWith ? res.status(state.failWith).json({ error: 'Simulated failure' }) : next()), state.latencyMs)
})

function requireToken(req, res, next) {
    const header = req.headers.authorization ?? ''
    if (!header.startsWith('Bearer ') || !verifyToken(header.slice(7))) return res.status(401).json({ msg: 'Missing or invalid token' })
    next()
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/login', (req, res) => {
    const { username, password } = req.body ?? {}
    if (username !== USERNAME || password !== PASSWORD) return res.status(401).json({ msg: 'bad credentials' })

    const { token, exp } = signToken(username)
    issueRefreshToken(res)
    res.json({ access_token: token, expires_at: new Date(exp * 1000).toISOString() })
})

app.post('/refresh', (req, res) => {
    const spent = readCookie(req, REFRESH_COOKIE)
    const expires = spent ? refreshTokens.get(spent) : undefined
    const now = Math.floor(Date.now() / 1000)
    if (!expires || expires <= now) {
        res.clearCookie(REFRESH_COOKIE, { path: '/' })
        return res.status(401).json({ msg: 'No valid refresh token' })
    }
    refreshTokens.set(spent, Math.min(expires, now + REFRESH_GRACE_SECONDS))
    issueRefreshToken(res)
    const { token, exp } = signToken(USERNAME)
    res.json({ access_token: token, expires_at: new Date(exp * 1000).toISOString() })
})

app.post('/stream-token', requireToken, (_req, res) => {
    const { token, exp } = signToken(USERNAME, STREAM_TOKEN_SECONDS, { scope: 'stream' })
    res.json({ stream_token: token, expires_at: new Date(exp * 1000).toISOString() })
})

app.post('/logout', (req, res) => {
    refreshTokens.delete(readCookie(req, REFRESH_COOKIE))
    res.clearCookie(REFRESH_COOKIE, { path: '/' })
    res.status(204).end()
})

app.get('/alarms', requireToken, (_req, res) => res.json(state.alarms))

app.post('/alarms', requireToken, (req, res) => {
    const alarms = req.body
    if (!Array.isArray(alarms)) return res.status(400).json({ error: 'Body must be a list' })

    for (const [index, alarm] of alarms.entries()) {
        const valid =
            alarm &&
            DAYS.includes(alarm.day) &&
            Number.isInteger(alarm.hour) &&
            alarm.hour >= 0 &&
            alarm.hour <= 23 &&
            Number.isInteger(alarm.minute) &&
            alarm.minute >= 0 &&
            alarm.minute <= 59 &&
            MELODIES.includes(alarm.melody) &&
            typeof alarm.enabled === 'boolean'
        if (!valid) return res.status(400).json({ error: `Invalid alarm at index ${index}` })
    }

    state.alarms = alarms
    res.status(201).end()
})

app.post('/alarms/play', requireToken, (req, res) => {
    if (!MELODIES.includes(req.body?.melody)) return res.status(400).json({ error: 'Unknown melody' })
    console.log(`Playing melody "${req.body.melody}" (mock buzzer)`)
    res.status(204).end()
})

const cameraView = () => ({ settings: state.cameraSettings, defaults: CAMERA_DEFAULTS, applied: state.cameraApplied })

app.get('/camera/settings', requireToken, (_req, res) => res.json(cameraView()))

app.put('/camera/settings', requireToken, (req, res) => {
    // Like the real backend: changes restart the stream, so they are limited (10 per minute)
    const now = Date.now()
    state.cameraChanges = state.cameraChanges.filter(time => now - time < 60_000)
    if (state.cameraChanges.length >= CAMERA_CHANGES_PER_MINUTE) return res.status(429).json({ error: 'Too many requests, please try again later' })
    state.cameraChanges.push(now)

    const error = validateCameraSettings(req.body)
    if (error) return res.status(400).json({ error })
    state.cameraSettings = req.body
    // Like the real backend: the stream restarts, so every viewer has to reconnect
    if (state.cameraApplied) io.emit('camera_stream_restart', { reason: 'settings' })
    res.json(cameraView())
})

// Like the real backend: greetings can only be read by the owner
app.get('/stats/history', requireToken, (_req, res) => res.json(history))

app.get('/greetings', requireToken, (_req, res) => res.json(state.greetings))

app.post('/greetings', (req, res) => {
    const text = req.body?.text
    if (typeof text !== 'string' || text.trim().length === 0) return res.status(400).json({ error: 'Invalid greeting text' })
    if (text.length > MAX_GREETING_LENGTH) return res.status(400).json({ error: `Greeting is too long (max ${MAX_GREETING_LENGTH} characters)` })
    state.greetings.push({ text: text.trim(), timestamp: new Date().toISOString() })
    res.status(201).end()
})

// ---- Socket.IO ----

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.use((socket, next) => {
    if (state.offline) return next(new Error('The mock backend is switched to offline'))
    const claims = verifyToken(socket.handshake.auth?.token)
    if (!claims) return next(new Error('unauthorized'))
    socket.data.exp = claims.exp
    next()
})

io.on('connection', socket => {
    console.log(`Socket ${socket.id} connected`)
    socket.emit('message', 'Connected')
    emitStats(socket)

    socket.on('message', msg => {
        if (socket.data.exp <= Math.floor(Date.now() / 1000)) return socket.disconnect(true)
        if (typeof msg !== 'string') return
        console.log(msg.startsWith('LED') ? `Camera light -> ${Math.round((Number(msg.slice(3)) / 255) * 100)}%` : `Servos -> ${msg}`)
    })
    socket.on('disconnect', () => console.log(`Socket ${socket.id} disconnected`))
})

// Slowly drifting values, so the stats look alive
const stats = { cpuUsage: 12, cpuTemperature: 48, ramUsage: 35, humidity: 45, temperature: 22, voltage: 3.0 }
const drift = (value, step, min, max) => Math.min(max, Math.max(min, value + (Math.random() * 2 - 1) * step))

function advanceStats() {
    stats.cpuUsage = drift(stats.cpuUsage, 6, 1, 95)
    stats.cpuTemperature = drift(stats.cpuTemperature, 1.5, 35, 75)
    stats.ramUsage = drift(stats.ramUsage, 1, 20, 80)
    stats.humidity = drift(stats.humidity, 0.5, 20, 80)
    stats.temperature = drift(stats.temperature, 0.2, 15, 30)
    stats.voltage = Math.max(2.2, stats.voltage - Math.random() * 0.001)
}

function emitStats(target) {
    target.emit('system_stats_update', {
        cpuUsage: Math.round(stats.cpuUsage),
        cpuTemperature: Math.round(stats.cpuTemperature),
        ramUsage: Math.round(stats.ramUsage),
    })
    target.emit('ble_update', {
        humidity: Number(stats.humidity.toFixed(1)),
        temperature: Number(stats.temperature.toFixed(1)),
        voltage: Number(stats.voltage.toFixed(2)),
        lastUpdated: new Date().toTimeString().slice(0, 8),
        stale: false,
    })
}

setInterval(() => {
    advanceStats()
    history.push({
        cpuUsage: Math.round(stats.cpuUsage),
        cpuTemperature: Math.round(stats.cpuTemperature),
        ramUsage: Math.round(stats.ramUsage),
        humidity: Number(stats.humidity.toFixed(1)),
        temperature: Number(stats.temperature.toFixed(1)),
        timestamp: Math.floor(Date.now() / 1000),
    })
    if (history.length > HISTORY_LENGTH) history.shift()
    emitStats(io)
}, STATS_INTERVAL_MS)

function configView() {
    return { offline: state.offline, latencyMs: state.latencyMs, failWith: state.failWith }
}

server.listen(PORT, () => console.log(`Mock backend listening on http://localhost:${PORT} (login: ${USERNAME} / ${PASSWORD})`))
