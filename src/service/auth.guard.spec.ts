import { Mock, vi } from 'vitest'
import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { authGuard } from './auth.guard'
import { AuthService } from './auth.service'

describe('authGuard', () => {
    let navigate: Mock

    function run(loggedIn: boolean) {
        navigate = vi.fn()
        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
                { provide: Router, useValue: { navigate } },
            ],
        })
        return TestBed.runInInjectionContext(() => authGuard())
    }

    it('lets signed-in users through', () => {
        expect(run(true)).toBe(true)
        expect(navigate).not.toHaveBeenCalled()
    })

    it('sends everybody else to the login page', () => {
        expect(run(false)).toBe(false)
        expect(navigate).toHaveBeenCalledWith(['/login'])
    })
})
