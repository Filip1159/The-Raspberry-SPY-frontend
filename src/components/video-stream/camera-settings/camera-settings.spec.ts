import { Mock, vi } from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { env } from '../../../environment'
import { BackendStatusService } from '../../../service/backend-status.service'
import { CameraSettings } from '../../../service/raspberry.api'
import { ToastService } from '../../../service/toast.service'
import { CameraSettingsCard } from './camera-settings'

const DEFAULTS: CameraSettings = {
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
const URL = `${env.backendApiUrl}/camera/settings`

describe('CameraSettingsCard', () => {
    let component: CameraSettingsCard
    let fixture: ComponentFixture<CameraSettingsCard>
    let http: HttpTestingController
    let toasts: ToastService
    let applied: Mock<() => void>

    const el = () => fixture.nativeElement as HTMLElement
    const button = (name: string) => Array.from(el().querySelectorAll('button')).find(b => b.textContent?.trim() === name) as HTMLButtonElement
    const change = (selector: string, value: string, type = 'input') => {
        const input = el().querySelector(selector) as HTMLInputElement | HTMLSelectElement
        input.value = value
        input.dispatchEvent(new Event(type))
        fixture.detectChanges()
    }
    const loadWith = (settings = DEFAULTS, appliedFlag = true) => {
        http.expectOne(URL).flush({ settings, defaults: DEFAULTS, applied: appliedFlag })
        fixture.detectChanges()
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [CameraSettingsCard], providers: [provideHttpClient(), provideHttpClientTesting()] })
        http = TestBed.inject(HttpTestingController)
        toasts = TestBed.inject(ToastService)
        vi.spyOn(toasts, 'success')
        vi.spyOn(toasts, 'warning')
        vi.spyOn(toasts, 'error')
        fixture = TestBed.createComponent(CameraSettingsCard)
        component = fixture.componentInstance
        applied = vi.fn<() => void>()
        component.applied.subscribe(applied)
        fixture.detectChanges()
    })

    afterEach(() => http.verify())

    it('shows a placeholder while the settings load, then the form with the saved values', () => {
        expect(el().querySelector('.skeleton')).not.toBeNull()

        loadWith({ ...DEFAULTS, fps: 15, vFlip: true, resolution: '640x360' })

        expect((el().querySelector('#camera-fps') as HTMLInputElement).value).toBe('15')
        expect((el().querySelector('#camera-resolution') as HTMLSelectElement).value).toBe('640x360')
        expect(el().textContent).toContain('15 fps')
        expect(el().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].checked).toBe(true)
    })

    it('has nothing to apply until something changes', () => {
        loadWith()

        expect(button('Apply').disabled).toBe(true)
        expect(button('Discard').disabled).toBe(true)
        expect(button('Defaults').disabled).toBe(true)
    })

    it('enables Apply and Discard after an edit, and Discard restores the saved values', () => {
        loadWith()

        change('#camera-fps', '15')
        expect(button('Apply').disabled).toBe(false)
        expect(el().textContent).toContain('15 fps')

        button('Discard').click()
        fixture.detectChanges()
        expect(component.draft()?.fps).toBe(30)
        expect(button('Apply').disabled).toBe(true)
    })

    it('sends the whole edited settings object and announces the restart', () => {
        loadWith()
        change('#camera-resolution', '1920x1080', 'change')
        change('#camera-bitrate', '6500')
        el().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].click()
        fixture.detectChanges()

        button('Apply').click()

        const request = http.expectOne(URL)
        expect(request.request.method).toBe('PUT')
        expect(request.request.body).toEqual({ ...DEFAULTS, resolution: '1920x1080', bitrate: 6500, hFlip: true })
        request.flush({ settings: request.request.body, defaults: DEFAULTS, applied: true })
        fixture.detectChanges()

        expect(toasts.success).toHaveBeenCalled()
        expect(applied).toHaveBeenCalledTimes(1)
        expect(button('Apply').disabled).toBe(true)
    })

    it('warns instead of restarting the player when the camera service did not take the settings', () => {
        loadWith()
        change('#camera-fps', '20')

        button('Apply').click()
        http.expectOne(URL).flush({ settings: { ...DEFAULTS, fps: 20 }, defaults: DEFAULTS, applied: false })
        fixture.detectChanges()

        expect(toasts.warning).toHaveBeenCalled()
        expect(applied).not.toHaveBeenCalled()
        expect(el().textContent).toContain('not in use yet')
    })

    it('shows the reason of a refused change and keeps the edits', () => {
        loadWith()
        change('#camera-fps', '20')

        button('Apply').click()
        http.expectOne(URL).flush({ error: 'Invalid fps (between 5 and 30)' }, { status: 400, statusText: 'Bad Request' })

        expect(toasts.error).toHaveBeenCalledWith('Invalid fps (between 5 and 30)')
        expect(component.draft()?.fps).toBe(20)
        expect(component.saving()).toBe(false)
    })

    it('explains the rate limit and the offline Raspberry', () => {
        loadWith()
        change('#camera-fps', '20')

        button('Apply').click()
        http.expectOne(URL).flush({ error: 'x' }, { status: 429, statusText: 'Too Many Requests' })
        expect(toasts.error).toHaveBeenLastCalledWith(expect.stringContaining('Too many changes'))

        button('Apply').click()
        http.expectOne(URL).flush('', { status: 0, statusText: 'Unknown Error' })
        expect(toasts.error).toHaveBeenLastCalledWith(expect.stringContaining('switched off'))
    })

    it('"Defaults" fills the form with the defaults of the Raspberry without saving them', () => {
        loadWith({ ...DEFAULTS, contrast: 2.5, awb: 'daylight' })

        button('Defaults').click()
        fixture.detectChanges()

        expect(component.draft()).toEqual(DEFAULTS)
        expect(button('Apply').disabled).toBe(false)
    })

    it('shows an error with a retry when loading fails, and loads again on retry', () => {
        http.expectOne(URL).flush('', { status: 500, statusText: 'Server Error' })
        fixture.detectChanges()
        expect(el().textContent).toContain('could not be loaded')

        button('Retry').click()
        loadWith()

        expect(el().querySelector('#camera-fps')).not.toBeNull()
    })

    it('loads the settings once the Raspberry is back after it was off at the start', () => {
        TestBed.inject(BackendStatusService).markOffline()
        http.expectOne(URL).flush('', { status: 0, statusText: 'Unknown Error' })
        fixture.detectChanges()
        expect(button('Retry').disabled).toBe(true)

        TestBed.inject(BackendStatusService).markOnline()
        fixture.detectChanges()

        loadWith()
        expect(el().querySelector('#camera-fps')).not.toBeNull()
    })
})
