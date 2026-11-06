import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { computed, inject, Injectable, signal } from '@angular/core'
import { timeout } from 'rxjs'
import { env } from './../environment'

export type BackendStatus = 'checking' | 'online' | 'offline'

export const BACKEND_OFFLINE_MESSAGE = 'The Raspberry is probably switched off or offline. Please try again later.'

const HEALTH_TIMEOUT_MS = 5000
const RETRY_INTERVAL_MS = 15000

// 0 = network error / CORS / timeout, 502-504 = nginx or Flask down, 521-524 and 530 = Cloudflare cannot reach the tunnel
const UNREACHABLE_HTTP_STATUSES = [0, 502, 503, 504, 521, 522, 523, 524, 530]

export function isBackendUnreachable(error: unknown): boolean {
    return error instanceof HttpErrorResponse && UNREACHABLE_HTTP_STATUSES.includes(error.status)
}

@Injectable({ providedIn: 'root' })
export class BackendStatusService {
    private http = inject(HttpClient)
    private retryTimer: ReturnType<typeof setTimeout> | null = null

    private statusSignal = signal<BackendStatus>('checking')
    status = this.statusSignal.asReadonly()
    isOffline = computed(() => this.statusSignal() === 'offline')

    /** Pings the backend. While it stays unreachable the check is repeated automatically. */
    check() {
        this.clearRetryTimer()
        this.http
            .get(`${env.backendApiUrl}/health`)
            .pipe(timeout(HEALTH_TIMEOUT_MS))
            .subscribe({
                next: () => this.markOnline(),
                error: () => this.markOffline(),
            })
    }

    /** Verifies a suspected problem (e.g. a dropped websocket) without flipping the status for a healthy backend. */
    checkIfOnline() {
        if (this.statusSignal() === 'online') {
            this.check()
        }
    }

    markOnline() {
        this.clearRetryTimer()
        this.statusSignal.set('online')
    }

    markOffline() {
        this.statusSignal.set('offline')
        if (!this.retryTimer) {
            this.retryTimer = setTimeout(() => this.check(), RETRY_INTERVAL_MS)
        }
    }

    private clearRetryTimer() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer)
            this.retryTimer = null
        }
    }
}
