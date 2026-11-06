import { Mock, vi } from 'vitest'
import { HttpErrorResponse } from '@angular/common/http'
import { TestBed } from '@angular/core/testing'
import { of, throwError } from 'rxjs'
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
    let api: { login: Mock; refresh: Mock; logout: Mock }

    function createService(storedToken?: string): AuthService {
        if (storedToken) localStorage.setItem('jwt', storedToken)
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue: { navigate: navigate } },
                { provide: RaspberryApi, useValue: api },
            ],
        })
        toasts = TestBed.inject(ToastService)
        return TestBed.inject(AuthService)
    }

    beforeEach(() => {
        localStorage.removeItem('jwt')
        navigate = vi.fn()
        api = { login: vi.fn(), refresh: vi.fn(), logout: vi.fn(() => of(undefined)) }
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

    it('is signed out when the stored token has already expired, but remembers that there was a session', () => {
        const service = createService(tokenExpiringIn(-10))

        expect(service.isLoggedIn()).toBe(false)
        expect(service.token()).toBeNull()
        expect(service.hasStaleSession()).toBe(true)
        expect(navigate).not.toHaveBeenCalled()
    })

    it('has no stale session without a stored token', () => {
        expect(createService().hasStaleSession()).toBe(false)
    })

    describe('silent sign-in with the refresh cookie', () => {
        it('restores the session after the access token expired', async () => {
            const fresh = tokenExpiringIn(1800)
            const service = createService(tokenExpiringIn(-10))
            api.refresh.mockReturnValue(of({ access_token: fresh }))

            expect(await service.restoreSession()).toBe(true)

            expect(service.isLoggedIn()).toBe(true)
            expect(localStorage.getItem('jwt')).toBe(fresh)
        })

        it('forgets the stale session when the refresh cookie is gone', async () => {
            const service = createService(tokenExpiringIn(-10))
            api.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })))

            expect(await service.restoreSession()).toBe(false)

            expect(service.hasStaleSession()).toBe(false)
        })
    })

    describe('renewing the token while the user is active', () => {
        it('gets a new token a minute before the old one ends, without any warning', () => {
            const service = createService()
            service.saveToken(tokenExpiringIn(300))
            const renewed = tokenExpiringIn(1800)
            api.refresh.mockReturnValue(of({ access_token: renewed }))

            vi.advanceTimersByTime(239_000)
            expect(api.refresh).not.toHaveBeenCalled()

            vi.advanceTimersByTime(2_000)
            expect(api.refresh).toHaveBeenCalledTimes(1)
            expect(service.token()).toBe(renewed)

            vi.advanceTimersByTime(299_000)
            expect(toasts.toasts()).toEqual([])
            expect(service.isLoggedIn()).toBe(true)
        })

        it('signs the user out with a notice when the refresh cookie is no longer valid', () => {
            const service = createService()
            service.saveToken(tokenExpiringIn(120))
            api.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })))

            vi.advanceTimersByTime(61_000)

            expect(service.isLoggedIn()).toBe(false)
            expect(toasts.toasts().map(t => t.kind)).toEqual(['info'])
            expect(navigate).toHaveBeenCalledWith(['/login'])
        })

        it('keeps trying while the Raspberry is unreachable and still warns before the end', () => {
            const service = createService()
            service.saveToken(tokenExpiringIn(120))
            api.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })))

            vi.advanceTimersByTime(61_000)
            expect(api.refresh).toHaveBeenCalledTimes(1)
            expect(service.isLoggedIn()).toBe(true)

            vi.advanceTimersByTime(15_000)
            expect(api.refresh).toHaveBeenCalledTimes(2)

            // the Raspberry is back
            const renewed = tokenExpiringIn(1800)
            api.refresh.mockReturnValue(of({ access_token: renewed }))
            vi.advanceTimersByTime(15_000)
            expect(service.token()).toBe(renewed)
        })
    })

    it('revokes the refresh cookie on logout', () => {
        const service = createService(tokenExpiringIn(600))

        service.logout()

        expect(api.logout).toHaveBeenCalled()
    })

    it('does not call the backend when logging out without a session', () => {
        createService().logout()

        expect(api.logout).not.toHaveBeenCalled()
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

    it('warns 15 seconds before the session ends when it cannot be renewed, and then logs out', () => {
        const service = createService()
        service.saveToken(tokenExpiringIn(60))

        api.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 }))) // Raspberry offline: no renewal possible

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
