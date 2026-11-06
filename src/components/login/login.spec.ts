import { Mock, vi } from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { env } from '../../environment'
import { AuthService } from '../../service/auth.service'
import { BACKEND_OFFLINE_MESSAGE } from '../../service/backend-status.service'
import { Login } from './login'

describe('Login', () => {
    const loginUrl = `${env.backendApiUrl}/login`

    let component: Login
    let fixture: ComponentFixture<Login>
    let httpMock: HttpTestingController
    let saveToken: Mock
    let navigate: Mock

    function submit(username = 'demo', password = 'secret') {
        component.form.setValue({ username, password })
        component.onSubmit()
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Login],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents()

        httpMock = TestBed.inject(HttpTestingController)
        saveToken = vi.spyOn(TestBed.inject(AuthService), 'saveToken').mockImplementation(() => undefined)
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
        fixture = TestBed.createComponent(Login)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    afterEach(() => httpMock.verify())

    it('asks for both fields instead of calling the backend', () => {
        component.onSubmit()

        expect(component.error()).toBe('Enter your username and password.')
        httpMock.expectNone(loginUrl)
    })

    it('saves the token and opens the control panel after a successful login', () => {
        submit()
        httpMock.expectOne(loginUrl).flush({ access_token: 'jwt-token' })

        expect(saveToken).toHaveBeenCalledWith('jwt-token')
        expect(navigate).toHaveBeenCalledWith(['/app/video'])
    })

    it('ignores a second submit while the first one is running', () => {
        submit()
        component.onSubmit()

        expect(component.submitting()).toBe(true)
        httpMock.expectOne(loginUrl).flush({ access_token: 'x' })
    })

    const failures: [string, number, string][] = [
        ['wrong credentials', 401, 'Wrong username or password.'],
        ['rate limiting', 429, 'Too many failed attempts. Please wait a minute and try again.'],
        ['an unreachable Raspberry', 530, BACKEND_OFFLINE_MESSAGE],
        ['a network failure', 0, BACKEND_OFFLINE_MESSAGE],
        ['a server error', 500, 'Something went wrong. Please try again.'],
    ]

    failures.forEach(([name, status, message]) => {
        it(`explains ${name}`, () => {
            submit()
            httpMock.expectOne(loginUrl).flush(null, { status, statusText: 'error' })

            expect(component.error()).toBe(message)
            expect(component.submitting()).toBe(false)
            expect(saveToken).not.toHaveBeenCalled()
        })
    })

    it('clears the previous error on the next attempt', () => {
        submit()
        httpMock.expectOne(loginUrl).flush(null, { status: 401, statusText: 'Unauthorized' })

        submit()
        expect(component.error()).toBe('')
        httpMock.expectOne(loginUrl).flush({ access_token: 'x' })
    })

    it('shows and hides the password', () => {
        const input = () => fixture.nativeElement.querySelector('#password') as HTMLInputElement
        expect(input().type).toBe('password')

        component.showPassword.set(true)
        fixture.detectChanges()

        expect(input().type).toBe('text')
    })
})
