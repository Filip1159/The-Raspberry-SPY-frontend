import { isPlatformBrowser } from '@angular/common'
import { Injectable, signal, inject, OnDestroy, PLATFORM_ID } from '@angular/core'
import { Router } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { RaspberryApi } from './raspberry.api'
import { ToastService } from './toast.service'

/** The access token is renewed this long before it expires */
const REFRESH_LEAD_SECONDS = 60
const RETRY_REFRESH_MS = 15_000

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
    private api = inject(RaspberryApi)
    private router = inject(Router)
    private toasts = inject(ToastService)

    // The portfolio is pre-rendered at build time, where there is no localStorage
    token = signal<string | null>(isPlatformBrowser(inject(PLATFORM_ID)) ? localStorage.getItem('jwt') : null)
    private expirationTimer: ReturnType<typeof setTimeout> | null = null
    private warningTimer: ReturnType<typeof setTimeout> | null = null
    private refreshTimer: ReturnType<typeof setTimeout> | null = null

    constructor() {
        const stored = this.token()
        if (stored && this.secondsUntilExpiry(stored) > 0) {
            this.scheduleTokenExpiration(stored)
        } else if (stored) {
            // Expired while the tab was closed: no usable token, but `restoreSession()` may still get a new one
            this.token.set(null)
        }
    }

    login(username: string, password: string) {
        return this.api.login(username, password)
    }

    saveToken(token: string) {
        localStorage.setItem('jwt', token)
        this.token.set(token)
        this.scheduleTokenExpiration(token)
    }

    logout() {
        const hadSession = this.token() !== null
        this.clearTimers()
        localStorage.removeItem('jwt')
        // Revoke the refresh cookie too; if the Raspberry is unreachable the removed token above still prevents a silent sign-in
        if (hadSession) this.api.logout().subscribe({ error: () => undefined })
        this.token.set(null)
        this.router.navigate(['/login'])
    }

    /** True when an earlier session left an (expired) token behind, so a refresh is worth trying */
    hasStaleSession(): boolean {
        return !this.token() && localStorage.getItem('jwt') !== null
    }

    /** Silent sign-in with the refresh cookie; resolves to whether it worked */
    async restoreSession(): Promise<boolean> {
        try {
            const response = await firstValueFrom(this.api.refresh())
            this.saveToken(response.access_token)
            return true
        } catch {
            localStorage.removeItem('jwt')
            return false
        }
    }

    private refresh() {
        this.api.refresh().subscribe({
            next: response => this.saveToken(response.access_token),
            error: error => {
                // 401: the refresh cookie is gone or expired, so the session really is over. Anything else (offline): try again until the token runs out
                if (error instanceof HttpErrorResponse && error.status === 401) {
                    this.expire()
                } else {
                    this.refreshTimer = setTimeout(() => this.refresh(), RETRY_REFRESH_MS)
                }
            },
        })
    }

    private expire() {
        this.toasts.info('Your session has expired. Please sign in again.')
        this.logout()
    }

    isLoggedIn() {
        const token = this.token()
        if (!token) return false
        const exp = this.getTokenExpiration(token)
        if (!exp) return false
        return exp > Math.floor(Date.now() / 1000)
    }

    private scheduleTokenExpiration(token: string) {
        const exp = this.getTokenExpiration(token)
        if (!exp) return

        const secondsUntilExpiry = exp - Math.floor(Date.now() / 1000)

        this.clearTimers()

        // Renew the token shortly before it ends; the warning below only appears when that does not work (Raspberry offline)
        if (secondsUntilExpiry > 0) {
            this.refreshTimer = setTimeout(() => this.refresh(), Math.max(0, secondsUntilExpiry - REFRESH_LEAD_SECONDS) * 1000)
        }

        if (secondsUntilExpiry > 15) {
            this.warningTimer = setTimeout(() => this.toasts.warning('Your session expires in 15 seconds.'), (secondsUntilExpiry - 15) * 1000)
            this.expirationTimer = setTimeout(() => this.expire(), secondsUntilExpiry * 1000)
        } else if (secondsUntilExpiry > 0) {
            this.toasts.warning('Your session expires in less than 15 seconds.')
            this.expirationTimer = setTimeout(() => this.expire(), secondsUntilExpiry * 1000)
        } else {
            this.logout()
        }
    }

    private secondsUntilExpiry(token: string): number {
        const exp = this.getTokenExpiration(token)
        return exp ? exp - Math.floor(Date.now() / 1000) : 0
    }

    private getTokenExpiration(token: string): number | null {
        try {
            const payloadPart = token.split('.')[1]
            if (!payloadPart) return null
            const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
            const decoded = JSON.parse(atob(base64))
            return decoded.exp
        } catch (e) {
            console.error('Failed to decode JWT', e)
            return null
        }
    }

    private clearTimers() {
        if (this.warningTimer) clearTimeout(this.warningTimer)
        if (this.expirationTimer) clearTimeout(this.expirationTimer)
        if (this.refreshTimer) clearTimeout(this.refreshTimer)
    }

    ngOnDestroy() {
        this.clearTimers()
    }
}
