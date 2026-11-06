import { Mock, vi } from 'vitest'
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { env } from './../environment'
import { authInterceptor } from './auth.interceptor'
import { AuthService } from './auth.service'
import { ToastService } from './toast.service'

describe('authInterceptor', () => {
    let http: HttpClient
    let httpMock: HttpTestingController
    let token: ReturnType<typeof signal<string | null>>
    let auth: { token: typeof token; logout: Mock }
    let toasts: { info: Mock }

    beforeEach(() => {
        token = signal<string | null>('abc')
        auth = { token, logout: vi.fn() }
        toasts = { info: vi.fn() }
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: auth },
                { provide: ToastService, useValue: toasts },
            ],
        })
        http = TestBed.inject(HttpClient)
        httpMock = TestBed.inject(HttpTestingController)
    })

    afterEach(() => httpMock.verify())

    it('adds the bearer token to protected calls', () => {
        http.get(`${env.backendApiUrl}/alarms`).subscribe()
        http.post(`${env.backendApiUrl}/alarms/play`, {}).subscribe()
        http.get(`${env.backendApiUrl}/greetings`).subscribe()

        const requests = httpMock.match(() => true)
        expect(requests.length).toBe(3)
        expect(requests.every(r => r.request.headers.get('Authorization') === 'Bearer abc')).toBe(true)
    })

    it('leaves public calls alone', () => {
        http.post(`${env.backendApiUrl}/login`, {}).subscribe()
        http.post(`${env.backendApiUrl}/greetings`, {}).subscribe()
        http.get(`${env.backendApiUrl}/health`).subscribe()
        http.get('https://example.com/alarms').subscribe()

        const requests = httpMock.match(() => true)
        expect(requests.length).toBe(4)
        expect(requests.some(r => r.request.headers.has('Authorization'))).toBe(false)
    })

    it('signs the user out when a protected call returns 401', () => {
        http.get(`${env.backendApiUrl}/alarms`).subscribe({ error: () => undefined })
        httpMock.expectOne(`${env.backendApiUrl}/alarms`).flush({}, { status: 401, statusText: 'Unauthorized' })

        expect(auth.logout).toHaveBeenCalled()
        expect(toasts.info).toHaveBeenCalled()
    })

    it('does not treat a wrong password as an expired session', () => {
        http.post(`${env.backendApiUrl}/login`, {}).subscribe({ error: () => undefined })
        httpMock.expectOne(`${env.backendApiUrl}/login`).flush({}, { status: 401, statusText: 'Unauthorized' })

        expect(auth.logout).not.toHaveBeenCalled()
    })

    it('ignores other errors', () => {
        http.get(`${env.backendApiUrl}/alarms`).subscribe({ error: () => undefined })
        httpMock.expectOne(`${env.backendApiUrl}/alarms`).flush({}, { status: 500, statusText: 'Server Error' })

        expect(auth.logout).not.toHaveBeenCalled()
    })
})
