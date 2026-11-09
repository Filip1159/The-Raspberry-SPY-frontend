import { Mock, vi } from 'vitest'
import { playWithHls, withToken } from './hls-player'

type Handler = (event: string, data: unknown) => void

const hlsMock = vi.hoisted(() => {
    const state = { supported: true, config: {} as Record<string, unknown>, handlers: {} as Record<string, Handler>, instance: null as unknown }
    class FakeHls {
        static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifestParsed' }
        static ErrorTypes = { MEDIA_ERROR: 'mediaError', NETWORK_ERROR: 'networkError' }
        static isSupported = () => state.supported
        loadSource = vi.fn()
        attachMedia = vi.fn()
        destroy = vi.fn()
        recoverMediaError = vi.fn()
        latency = Number.NaN
        on = (event: string, handler: Handler) => (state.handlers[event] = handler)
        constructor(config: Record<string, unknown>) {
            state.config = config
            state.handlers = {}
            state.instance = this
        }
    }
    return { state, FakeHls }
})
vi.mock('hls.js', () => ({ default: hlsMock.FakeHls }))

const URL = 'https://api.example.com/cam1/index.m3u8'
const NOT_SAFARI = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15'

describe('withToken', () => {
    it('adds the token to a URL', () => {
        expect(withToken(URL, 'abc')).toBe(`${URL}?jwt=abc`)
    })

    it('replaces an old token and keeps other parameters', () => {
        expect(withToken(`${URL}?_HLS_msn=4&jwt=old`, 'new')).toBe(`${URL}?_HLS_msn=4&jwt=new`)
    })

    it('keeps a relative URL relative', () => {
        expect(withToken('/cam1/part3.mp4?x=1', 'abc')).toBe('/cam1/part3.mp4?x=1&jwt=abc')
    })

    it('leaves the URL alone without a token', () => {
        expect(withToken(URL, null)).toBe(URL)
    })
})

describe('playWithHls', () => {
    let video: HTMLVideoElement
    let onFallback: Mock<() => void>
    let onFatalError: Mock<() => void>
    let token: string

    const instance = () => hlsMock.state.instance as InstanceType<typeof hlsMock.FakeHls>
    const start = () => playWithHls({ video, url: URL, token: () => token, onFallback, onFatalError })
    const fail = (data: Record<string, unknown>) => hlsMock.state.handlers['error']('error', data)

    beforeEach(() => {
        hlsMock.state.supported = true
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(NOT_SAFARI)
        video = document.createElement('video')
        video.play = vi.fn().mockResolvedValue(undefined)
        onFallback = vi.fn<() => void>()
        onFatalError = vi.fn<() => void>()
        token = 'first'
    })

    afterEach(() => vi.restoreAllMocks())

    it('uses the browser itself where hls.js cannot run', async () => {
        hlsMock.state.supported = false

        expect(await start()).toBeNull()
    })

    it('leaves Safari to its native low-latency player', async () => {
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(SAFARI)

        expect(await start()).toBeNull()
    })

    it('loads the stream with the token and attaches the video', async () => {
        await start()

        expect(instance().loadSource).toHaveBeenCalledWith(`${URL}?jwt=first`)
        expect(instance().attachMedia).toHaveBeenCalledWith(video)
        expect(hlsMock.state.config['lowLatencyMode']).toBe(true)
        // the on-demand camera holds the first playlist request until it is up
        expect(hlsMock.state.config['manifestLoadingTimeOut']).toBeGreaterThanOrEqual(15_000)
    })

    it('puts the current token on every later request', async () => {
        await start()
        const open = vi.fn()
        const xhrSetup = hlsMock.state.config['xhrSetup'] as (xhr: unknown, url: string) => void
        const fetchSetup = hlsMock.state.config['fetchSetup'] as (context: { url: string }, init: RequestInit) => Request

        token = 'renewed'
        xhrSetup({ open }, `${URL.replace('index.m3u8', 'seg1.mp4')}?jwt=first`)

        expect(open).toHaveBeenCalledWith('GET', 'https://api.example.com/cam1/seg1.mp4?jwt=renewed', true)
        expect(fetchSetup({ url: `${URL}?_HLS_msn=2` }, {}).url).toBe(`${URL}?_HLS_msn=2&jwt=renewed`)
    })

    it('starts playback when the playlist is ready', async () => {
        await start()

        hlsMock.state.handlers['manifestParsed']('manifestParsed', {})

        expect(video.play).toHaveBeenCalled()
    })

    it('ignores errors hls.js recovers from by itself', async () => {
        await start()

        fail({ fatal: false, type: 'networkError' })

        expect(instance().destroy).not.toHaveBeenCalled()
        expect(onFallback).not.toHaveBeenCalled()
    })

    it('hands over to the native player when it fails before the first frame', async () => {
        await start()

        fail({ fatal: true, type: 'networkError' })

        expect(instance().destroy).toHaveBeenCalled()
        expect(onFallback).toHaveBeenCalledTimes(1)
        expect(onFatalError).not.toHaveBeenCalled()
    })

    it('reports a stream that played and then failed', async () => {
        await start()
        video.dispatchEvent(new Event('playing'))

        fail({ fatal: true, type: 'networkError' })

        expect(onFatalError).toHaveBeenCalledTimes(1)
        expect(onFallback).not.toHaveBeenCalled()
    })

    it('recovers from media errors twice, then gives up', async () => {
        await start()
        video.dispatchEvent(new Event('playing'))

        fail({ fatal: true, type: 'mediaError' })
        fail({ fatal: true, type: 'mediaError' })
        expect(instance().recoverMediaError).toHaveBeenCalledTimes(2)
        expect(onFatalError).not.toHaveBeenCalled()

        fail({ fatal: true, type: 'mediaError' })
        expect(onFatalError).toHaveBeenCalledTimes(1)
    })

    it('reports how far it is behind the live edge', async () => {
        const playback = await start()
        expect(playback?.latency()).toBeNull()

        instance().latency = 2.34
        expect(playback?.latency()).toBe(2.34)

        instance().latency = -1
        expect(playback?.latency()).toBeNull()
    })

    it('can be stopped', async () => {
        const playback = await start()

        playback?.destroy()

        expect(instance().destroy).toHaveBeenCalled()
    })
})
