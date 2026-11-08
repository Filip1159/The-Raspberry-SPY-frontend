import type Hls from 'hls.js'
import type { ErrorData } from 'hls.js'

/** The stream URL with the given token (replacing a token that is already there) */
export function withToken(url: string, token: string | null): string {
    if (!token) return url
    const parsed = new URL(url, 'http://localhost')
    parsed.searchParams.set('jwt', token)
    return /^https?:/i.test(url) ? parsed.toString() : `${parsed.pathname}${parsed.search}`
}

export interface HlsPlayback {
    destroy(): void
}

interface Options {
    video: HTMLVideoElement
    /** The playlist URL without a token */
    url: string
    /** Read for every request, so a renewed access token is used by the next segment */
    token: () => string | null
    /** The browser plays HLS itself (Safari), or hls.js could not be used: set the source of the <video> directly */
    onFallback: () => void
    /** The stream failed for good */
    onFatalError: () => void
}

/** Safari plays low-latency HLS natively, and better than through MSE */
function isSafari(): boolean {
    return /^((?!chrome|chromium|android).)*safari/i.test(navigator.userAgent)
}

/**
 * Plays the stream with hls.js, which keeps the live edge (low-latency mode, small playback-rate corrections instead of stalls)
 * and sends the current access token with every request. Returns null when hls.js is not used (not supported, or Safari): the
 * caller plays the URL natively then. Loaded lazily, it is not part of the first load.
 */
export async function playWithHls({ video, url, token, onFallback, onFatalError }: Options): Promise<HlsPlayback | null> {
    const { default: HlsClass } = await import('hls.js')
    if (isSafari() || !HlsClass.isSupported()) return null

    const hls: Hls = new HlsClass({
        lowLatencyMode: true,
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 6,
        maxLiveSyncPlaybackRate: 1.1,
        backBufferLength: 10,
        // the camera starts on demand: the first playlist request is held until it is up (a few seconds)
        manifestLoadingTimeOut: 20_000,
        manifestLoadingMaxRetry: 2,
        // the access token lives 30 minutes, the stream longer: every playlist/segment request carries the current one
        xhrSetup: (xhr, requestUrl) => xhr.open('GET', withToken(requestUrl, token()), true),
        fetchSetup: (context, init) => new Request(withToken(context.url, token()), init),
    })

    let playing = false
    let mediaRecoveries = 0
    video.addEventListener('playing', () => (playing = true), { once: true })

    hls.on(HlsClass.Events.ERROR, (_event, data: ErrorData) => {
        if (!data.fatal) return
        if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 2) {
            hls.recoverMediaError()
            return
        }
        hls.destroy()
        // Never played: probably something about hls.js itself (for example the CORS headers of the video server), so let the
        // browser try on its own. Played before: the stream really is gone.
        if (playing) onFatalError()
        else onFallback()
    })
    hls.on(HlsClass.Events.MANIFEST_PARSED, () => video.play().catch(() => undefined))

    hls.loadSource(withToken(url, token()))
    hls.attachMedia(video)
    return { destroy: () => hls.destroy() }
}
