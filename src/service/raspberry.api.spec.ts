import {} from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { env } from './../environment'
import { RaspberryApi } from './raspberry.api'

describe('RaspberryApi', () => {
    let api: RaspberryApi
    let httpMock: HttpTestingController

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] })
        api = TestBed.inject(RaspberryApi)
        httpMock = TestBed.inject(HttpTestingController)
    })

    afterEach(() => httpMock.verify())

    it('logs in with the credentials in the body and no token', () => {
        api.login('demo', 'secret').subscribe()

        const request = httpMock.expectOne(`${env.backendApiUrl}/login`)
        expect(request.request.method).toBe('POST')
        expect(request.request.body).toEqual({ username: 'demo', password: 'secret' })
        expect(request.request.headers.has('Authorization')).toBe(false)
    })

    it('calls the alarm endpoints without handling tokens itself', () => {
        api.getAlarms().subscribe()
        api.saveAlarms([]).subscribe()
        api.playMelody('Nokia').subscribe()

        const requests = httpMock.match(() => true)
        expect(requests.map(r => r.request.url)).toEqual([
            `${env.backendApiUrl}/alarms`,
            `${env.backendApiUrl}/alarms`,
            `${env.backendApiUrl}/alarms/play`,
        ])
        expect(requests.some(r => r.request.headers.has('Authorization'))).toBe(false)
    })

    it('sends greetings without a token', () => {
        api.sendGreeting('hi').subscribe()

        const request = httpMock.expectOne(`${env.backendApiUrl}/greetings`)
        expect(JSON.parse(request.request.body)).toEqual({ text: 'hi' })
        expect(request.request.headers.has('Authorization')).toBe(false)
    })
})
