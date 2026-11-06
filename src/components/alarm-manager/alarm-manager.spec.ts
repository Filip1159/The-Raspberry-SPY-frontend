import { vi } from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { env } from '../../environment'
import { AlarmManager } from './alarm-manager'

describe('AlarmManager', () => {
    const alarmsUrl = `${env.backendApiUrl}/alarms`
    const alarms = ['monday', 'tuesday'].map(day => ({ day, hour: 7, minute: 0, melody: 'Nokia', enabled: true }))

    let fixture: ComponentFixture<AlarmManager>
    let component: AlarmManager
    let httpMock: HttpTestingController

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlarmManager],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents()

        httpMock = TestBed.inject(HttpTestingController)
        fixture = TestBed.createComponent(AlarmManager)
        component = fixture.componentInstance
        fixture.detectChanges()
        httpMock.expectOne(alarmsUrl).flush(alarms)
    })

    afterEach(() => httpMock.verify())

    it('loads the alarms and starts without unsaved changes', () => {
        expect(component.loading()).toBe(false)
        expect(component.alarmsSignal().length).toBe(2)
        expect(component.hasUnsavedChanges()).toBe(false)
    })

    it('detects an edit and a change that is reverted', () => {
        const monday = component.alarmsSignal()[0]

        monday.patchValue({ hour: 6 })
        expect(component.hasUnsavedChanges()).toBe(true)

        monday.patchValue({ hour: 7 })
        expect(component.hasUnsavedChanges()).toBe(false)
    })

    it('discards the changes', () => {
        component.alarmsSignal()[1].patchValue({ enabled: false, melody: 'Panic' })

        component.discard()

        expect(component.alarmsSignal()[1].value).toEqual(alarms[1])
        expect(component.hasUnsavedChanges()).toBe(false)
    })

    it('saves the alarms and clears the unsaved state', () => {
        component.alarmsSignal()[0].patchValue({ minute: 30 })

        component.save()
        const request = httpMock.expectOne(alarmsUrl)
        expect(request.request.method).toBe('POST')
        expect(JSON.parse(request.request.body)[0].minute).toBe(30)
        request.flush(null, { status: 201, statusText: 'Created' })

        expect(component.saving()).toBe(false)
        expect(component.hasUnsavedChanges()).toBe(false)
    })

    it('keeps the unsaved state when saving fails', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined) // the component logs the failure
        component.alarmsSignal()[0].patchValue({ minute: 30 })

        component.save()
        httpMock.expectOne(alarmsUrl).flush(null, { status: 500, statusText: 'Server Error' })

        expect(component.hasUnsavedChanges()).toBe(true)
    })
})
