import { Injectable, signal, inject, OnDestroy } from '@angular/core'
import { Router } from '@angular/router'
import { RaspberryApi } from './raspberry.api'

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
    private api = inject(RaspberryApi)
    private router = inject(Router)

    token = signal<string | null>(localStorage.getItem('jwt'))
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
            this.warningTimer = setTimeout(
                () => alert('Your session is about to expire in 15 seconds'),
                (secondsUntilExpiry - 15) * 1000
            )
            this.expirationTimer = setTimeout(() => {
                this.logout()
            }, secondsUntilExpiry * 1000)
        } else if (secondsUntilExpiry > 0) {
            alert('Your session is about to expire in less than 15 seconds')
            this.expirationTimer = setTimeout(() => this.logout(), secondsUntilExpiry * 1000)
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
