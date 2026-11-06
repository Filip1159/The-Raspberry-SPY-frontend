import { Mock, vi } from 'vitest'
import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { AuthService } from './auth.service'
import { RaspberryApi } from './raspberry.api'
import { ToastService } from './toast.service'

/** A JWT that expires in `seconds` seconds (the signature is irrelevant for the UI, which only reads `exp`) */
function tokenExpiringIn(seconds: number): string {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).replace(/=/g, '')
    return `header.${payload}.signature`
}

describe('AuthService', () => {
    let navigate: Mock
    let toasts: ToastService

    function createService(storedToken?: string): AuthService {
        if (storedToken) localStorage.setItem('jwt', storedToken)
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue: { navigate: navigate } },
                { provide: RaspberryApi, useValue: { login: () => undefined } },
            ],
        })
        toasts = TestBed.inject(ToastService)
        return TestBed.inject(AuthService)
    }

    beforeEach(() => {
        localStorage.removeItem('jwt')
        navigate = vi.fn()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        localStorage.removeItem('jwt')
    })

    it('is logged out without a token', () => {
        expect(createService().isLoggedIn()).toBe(false)
    })

    it('is logged in with a token that has not expired', () => {
        expect(createService(tokenExpiringIn(600)).isLoggedIn()).toBe(true)
    })

    it('treats a malformed token as logged out', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)

        expect(createService('not-a-jwt').isLoggedIn()).toBe(false)
    })

    it('logs out right away when the stored token has already expired', () => {
        const service = createService(tokenExpiringIn(-10))

        expect(service.isLoggedIn()).toBe(false)
        expect(service.token()).toBeNull()
        expect(navigate).toHaveBeenCalledWith(['/login'])
    })

    it('stores the token on login and removes it on logout', () => {
        const service = createService()
        const token = tokenExpiringIn(600)

        service.saveToken(token)
        expect(service.isLoggedIn()).toBe(true)
        expect(localStorage.getItem('jwt')).toBe(token)

        service.logout()
        expect(service.isLoggedIn()).toBe(false)
        expect(localStorage.getItem('jwt')).toBeNull()
        expect(navigate).toHaveBeenCalledWith(['/login'])
    })

    it('warns 15 seconds before the session ends and then logs out', () => {
        const service = createService()
        service.saveToken(tokenExpiringIn(60))

        vi.advanceTimersByTime(44_000)
        expect(toasts.toasts()).toEqual([])

        vi.advanceTimersByTime(2_000)
        expect(toasts.toasts().map(t => t.kind)).toEqual(['warning'])
        expect(service.isLoggedIn()).toBe(true)

        vi.advanceTimersByTime(15_000)
        expect(service.isLoggedIn()).toBe(false)
        // the warning has been dismissed by now, the expiry notice is shown
        expect(toasts.toasts().map(t => t.kind)).toEqual(['info'])
        expect(navigate).toHaveBeenCalledWith(['/login'])
    })

    it('does not log out later when the user logged out by hand', () => {
        const service = createService()
        service.saveToken(tokenExpiringIn(60))
        service.logout()
        navigate.mockClear()

        vi.advanceTimersByTime(120_000)

        expect(navigate).not.toHaveBeenCalled()
    })
})
