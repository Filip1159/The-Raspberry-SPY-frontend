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
        expect(request.request.withCredentials).toBe(true)
    })

    it('refreshes and logs out with the cookie of the API host', () => {
        api.refresh().subscribe()
        api.logout().subscribe()

        const refresh = httpMock.expectOne(`${env.backendApiUrl}/refresh`)
        const logout = httpMock.expectOne(`${env.backendApiUrl}/logout`)
        expect([refresh.request.method, refresh.request.withCredentials]).toEqual(['POST', true])
        expect([logout.request.method, logout.request.withCredentials]).toEqual(['POST', true])
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

    it('reads and saves the camera settings', () => {
        const settings = {
            resolution: '1280x720',
            fps: 30,
            bitrate: 4000,
            hFlip: false,
            vFlip: false,
            brightness: 0,
            contrast: 1,
            saturation: 1,
            sharpness: 1,
            exposure: 'normal',
            awb: 'auto',
        }
        api.getCameraSettings().subscribe()
        const get = httpMock.expectOne(`${env.backendApiUrl}/camera/settings`)
        expect(get.request.method).toBe('GET')
        get.flush({ settings, defaults: settings, applied: true })

        api.saveCameraSettings(settings).subscribe()
        const put = httpMock.expectOne(`${env.backendApiUrl}/camera/settings`)
        expect(put.request.method).toBe('PUT')
        expect(put.request.body).toEqual(settings)
        put.flush({ settings, defaults: settings, applied: true })
    })

    it('sends greetings without a token', () => {
        api.sendGreeting('hi').subscribe()

        const request = httpMock.expectOne(`${env.backendApiUrl}/greetings`)
        expect(JSON.parse(request.request.body)).toEqual({ text: 'hi' })
        expect(request.request.headers.has('Authorization')).toBe(false)
    })
})
