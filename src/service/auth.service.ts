import { isPlatformBrowser } from '@angular/common'
import { Injectable, signal, inject, OnDestroy, PLATFORM_ID } from '@angular/core'
import { Router } from '@angular/router'
import { RaspberryApi } from './raspberry.api'
import { ToastService } from './toast.service'

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
    private api = inject(RaspberryApi)
    private router = inject(Router)
    private toasts = inject(ToastService)

    // The portfolio is pre-rendered at build time, where there is no localStorage
    token = signal<string | null>(isPlatformBrowser(inject(PLATFORM_ID)) ? localStorage.getItem('jwt') : null)
    private expirationTimer: ReturnType<typeof setTimeout> | null = null
    private warningTimer: ReturnType<typeof setTimeout> | null = null

    constructor() {
        if (this.token()) {
            this.scheduleTokenExpiration(this.token()!)
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
        this.clearTimers()
        localStorage.removeItem('jwt')
        this.token.set(null)
        this.router.navigate(['/login'])
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

        const now = Math.floor(Date.now() / 1000)
        const secondsUntilExpiry = exp - now

        this.clearTimers()

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
    }

    ngOnDestroy() {
        this.clearTimers()
    }
}
