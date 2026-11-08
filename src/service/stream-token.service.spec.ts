import { vi } from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { env } from './../environment'
import { StreamTokenService } from './stream-token.service'

const URL = `${env.backendApiUrl}/stream-token`

/** A token shaped like the backend's, valid for `lifetime` seconds */
function token(name: string, lifetime = 120): string {
    const payload = btoa(JSON.stringify({ iat: 1000, exp: 1000 + lifetime })).replace(/=+$/, '')
    return `h.${payload}.${name}`
}

describe('StreamTokenService', () => {
    let service: StreamTokenService
    let http: HttpTestingController

    const answer = (value: string) => http.expectOne(URL).flush({ stream_token: value, expires_at: 'x' })

    beforeEach(() => {
        vi.useFakeTimers()
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] })
        service = TestBed.inject(StreamTokenService)
        http = TestBed.inject(HttpTestingController)
    })

    afterEach(() => {
        service.stop()
        http.verify()
        vi.useRealTimers()
    })

    it('has no token until started', () => {
        expect(service.token()).toBeNull()
    })

    it('resolves with the token once the first one has arrived', async () => {
        const started = service.start()
        answer(token('one'))
        await started

        expect(service.token()).toBe(token('one'))
    })

    it('rejects when the first token cannot be fetched', async () => {
        const started = service.start()
        http.expectOne(URL).flush('', { status: 503, statusText: 'Unavailable' })

        await expect(started).rejects.toBeTruthy()
        expect(service.token()).toBeNull()
    })

    it('renews the token after 60% of its lifetime', async () => {
        const started = service.start()
        answer(token('one'))
        await started

        await vi.advanceTimersByTimeAsync(71_000)
        http.expectNone(URL)
        await vi.advanceTimersByTimeAsync(2_000)
        answer(token('two'))
        await vi.advanceTimersByTimeAsync(0)

        expect(service.token()).toBe(token('two'))
    })

    it('keeps the old token and tries again when a renewal fails', async () => {
        const started = service.start()
        answer(token('one'))
        await started

        await vi.advanceTimersByTimeAsync(73_000)
        http.expectOne(URL).flush('', { status: 0, statusText: 'Unknown Error' })
        await vi.advanceTimersByTimeAsync(0)
        expect(service.token()).toBe(token('one'))

        await vi.advanceTimersByTimeAsync(5_000)
        answer(token('three'))
        await vi.advanceTimersByTimeAsync(0)
        expect(service.token()).toBe(token('three'))
    })

    it('uses a short fallback lifetime for a token it cannot read', async () => {
        const started = service.start()
        answer('not-a-jwt')
        await started

        await vi.advanceTimersByTimeAsync(37_000)
        answer(token('next'))
    })

    it('stops renewing and forgets the token', async () => {
        const started = service.start()
        answer(token('one'))
        await started

        service.stop()
        await vi.advanceTimersByTimeAsync(300_000)

        http.expectNone(URL)
        expect(service.token()).toBeNull()
    })

    it('drops an answer that arrives after stop()', async () => {
        const started = service.start()
        service.stop()
        answer(token('late'))
        await started

        expect(service.token()).toBeNull()
        await vi.advanceTimersByTimeAsync(300_000)
        http.expectNone(URL)
    })
})
