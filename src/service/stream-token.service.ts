import { Injectable, inject } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { RaspberryApi } from './raspberry.api'

/** The token is renewed after this share of its lifetime, so a failed attempt can be retried before it expires */
const RENEW_AT = 0.6
const RETRY_MS = 5000
const FALLBACK_LIFETIME_SECONDS = 60

/** The lifetime in the token itself (`exp - iat`): independent of a clock that differs from the server's */
function lifetimeSeconds(token: string): number {
    try {
        const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        const lifetime = claims.exp - claims.iat
        return Number.isFinite(lifetime) && lifetime > 0 ? lifetime : FALLBACK_LIFETIME_SECONDS
    } catch {
        return FALLBACK_LIFETIME_SECONDS
    }
}

/**
 * The token that goes into the video URLs. It is short-lived (2 minutes) and only the video server accepts it, because URLs end up in
 * logs. While the stream plays it is renewed in the background; `token()` always returns the latest one.
 */
@Injectable({ providedIn: 'root' })
export class StreamTokenService {
    private api = inject(RaspberryApi)
    private current: string | null = null
    private timer: ReturnType<typeof setTimeout> | null = null
    /** Changes with every start/stop, so an answer that arrives after `stop()` is dropped */
    private run = 0

    token(): string | null {
        return this.current
    }

    /** Gets a token (rejects when that fails) and keeps it fresh until `stop()` */
    async start(): Promise<void> {
        this.stop()
        await this.fetch(this.run)
    }

    stop(): void {
        this.run++
        this.current = null
        if (this.timer) clearTimeout(this.timer)
        this.timer = null
    }

    private async fetch(run: number): Promise<void> {
        const { stream_token } = await firstValueFrom(this.api.getStreamToken())
        if (run !== this.run) return
        this.current = stream_token
        this.schedule(run, lifetimeSeconds(stream_token) * RENEW_AT * 1000)
    }

    private schedule(run: number, delayMs: number): void {
        this.timer = setTimeout(() => {
            this.fetch(run).catch(() => {
                // keep the old token until it expires and try again
                if (run === this.run) this.schedule(run, RETRY_MS)
            })
        }, delayMs)
    }
}
