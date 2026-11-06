import { Mock, vi } from 'vitest'
import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { authGuard } from './auth.guard'
import { AuthService } from './auth.service'

describe('authGuard', () => {
    let navigate: Mock
    let restoreSession: Mock

    /** `restored`: what a silent refresh would do (the user is signed in afterwards) */
    function run(options: { loggedIn: boolean; stale?: boolean; restored?: boolean }) {
        navigate = vi.fn()
        let loggedIn = options.loggedIn
        restoreSession = vi.fn(async () => {
            loggedIn = options.restored ?? false
            return loggedIn
        })
        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: { isLoggedIn: () => loggedIn, hasStaleSession: () => options.stale ?? false, restoreSession } },
                { provide: Router, useValue: { navigate } },
            ],
        })
        return TestBed.runInInjectionContext(() => authGuard())
    }

    it('lets signed-in users through', async () => {
        expect(await run({ loggedIn: true })).toBe(true)
        expect(navigate).not.toHaveBeenCalled()
        expect(restoreSession).not.toHaveBeenCalled()
    })

    it('sends everybody else to the login page', async () => {
        expect(await run({ loggedIn: false })).toBe(false)
        expect(navigate).toHaveBeenCalledWith(['/login'])
        expect(restoreSession).not.toHaveBeenCalled()
    })

    it('signs in quietly when the refresh cookie still works', async () => {
        expect(await run({ loggedIn: false, stale: true, restored: true })).toBe(true)
        expect(navigate).not.toHaveBeenCalled()
    })

    it('goes to the login page when the quiet sign-in fails', async () => {
        expect(await run({ loggedIn: false, stale: true, restored: false })).toBe(false)
        expect(navigate).toHaveBeenCalledWith(['/login'])
    })
})
