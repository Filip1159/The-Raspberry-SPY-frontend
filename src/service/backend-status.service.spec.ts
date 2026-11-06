import { vi } from 'vitest'
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { env } from './../environment'
import { backendStatusInterceptor } from './backend-status.interceptor'
import { BackendStatusService } from './backend-status.service'

describe('BackendStatusService', () => {
    const healthUrl = `${env.backendApiUrl}/health`

    let service: BackendStatusService
    let http: HttpClient
    let httpMock: HttpTestingController

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(withInterceptors([backendStatusInterceptor])), provideHttpClientTesting()],
        })
        service = TestBed.inject(BackendStatusService)
        http = TestBed.inject(HttpClient)
        httpMock = TestBed.inject(HttpTestingController)
    })

    afterEach(() => {
        vi.useRealTimers()
        httpMock.verify()
    })

    it('starts in the checking state', () => {
        expect(service.status()).toBe('checking')
        expect(service.isOffline()).toBe(false)
    })

    it('is online after a successful health check', () => {
        service.check()
        httpMock.expectOne(healthUrl).flush({ status: 'ok' })

        expect(service.status()).toBe('online')
    })

    it('is offline when the health check gets a gateway error', () => {
        service.check()
        httpMock.expectOne(healthUrl).flush(null, { status: 502, statusText: 'Bad Gateway' })

        expect(service.isOffline()).toBe(true)
    })

    it('is offline on a network error', () => {
        service.check()
        httpMock.expectOne(healthUrl).error(new ProgressEvent('error'))

        expect(service.isOffline()).toBe(true)
    })

    it('retries automatically while offline and recovers', () => {
        vi.useFakeTimers()
        service.check()
        httpMock.expectOne(healthUrl).flush(null, { status: 530, statusText: 'Origin unreachable' })
        expect(service.isOffline()).toBe(true)

        vi.advanceTimersByTime(15000)
        httpMock.expectOne(healthUrl).flush({ status: 'ok' })

        expect(service.status()).toBe('online')
        vi.advanceTimersByTime(60000)
        httpMock.expectNone(healthUrl)
    })

    it('checkIfOnline only verifies a backend that is currently considered online', () => {
        service.checkIfOnline()
        httpMock.expectNone(healthUrl)

        service.markOnline()
        service.checkIfOnline()
        httpMock.expectOne(healthUrl).flush({ status: 'ok' })
        expect(service.status()).toBe('online')
    })

    describe('interceptor', () => {
        it('marks the backend offline when an API call cannot reach it', () => {
            http.get(`${env.backendApiUrl}/alarms`).subscribe({ error: () => undefined })
            httpMock.expectOne(`${env.backendApiUrl}/alarms`).flush(null, { status: 503, statusText: 'Service Unavailable' })

            expect(service.isOffline()).toBe(true)
        })

        it('marks the backend online after any successful API call', () => {
            service.markOffline()

            http.get(`${env.backendApiUrl}/alarms`).subscribe()
            httpMock.expectOne(`${env.backendApiUrl}/alarms`).flush([])

            expect(service.status()).toBe('online')
        })

        it('does not treat client errors such as an expired session as offline', () => {
            service.markOnline()

            http.get(`${env.backendApiUrl}/alarms`).subscribe({ error: () => undefined })
            httpMock.expectOne(`${env.backendApiUrl}/alarms`).flush(null, { status: 401, statusText: 'Unauthorized' })

            expect(service.status()).toBe('online')
        })

        it('ignores requests to other hosts', () => {
            service.markOnline()

            http.get('https://example.com/data').subscribe({ error: () => undefined })
            httpMock.expectOne('https://example.com/data').error(new ProgressEvent('error'))

            expect(service.status()).toBe('online')
        })
    })
})
