import {} from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { env } from '../../environment'
import { BackendStatusService } from '../../service/backend-status.service'
import { ToastService } from '../../service/toast.service'
import { Greetings } from './greetings'

describe('Greetings', () => {
    const url = `${env.backendApiUrl}/greetings`

    let component: Greetings
    let fixture: ComponentFixture<Greetings>
    let httpMock: HttpTestingController
    let toasts: ToastService

    const sendButton = () => fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Greetings],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents()

        httpMock = TestBed.inject(HttpTestingController)
        toasts = TestBed.inject(ToastService)
        fixture = TestBed.createComponent(Greetings)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    afterEach(() => httpMock.verify())

    it('cannot be sent while empty', () => {
        expect(sendButton().disabled).toBe(true)

        component.form.controls.text.setValue('   ')
        fixture.detectChanges()
        expect(sendButton().disabled).toBe(true)
    })

    it('cannot be sent when it is too long', () => {
        component.form.controls.text.setValue('x'.repeat(component.maxLength + 1))
        fixture.detectChanges()

        expect(sendButton().disabled).toBe(true)
    })

    it('sends the text, thanks the visitor and empties the box', () => {
        component.form.controls.text.setValue('Nice site!')
        fixture.detectChanges()
        expect(sendButton().disabled).toBe(false)

        component.send()
        const request = httpMock.expectOne(url)
        expect(JSON.parse(request.request.body)).toEqual({ text: 'Nice site!' })
        request.flush(null, { status: 201, statusText: 'Created' })

        expect(toasts.toasts().map(t => t.kind)).toEqual(['success'])
        expect(component.form.controls.text.value).toBe('')
        expect(component.sending()).toBe(false)
    })

    it('does not send twice while a request is running', () => {
        component.form.controls.text.setValue('Hi')

        component.send()
        component.send()

        httpMock.expectOne(url).flush(null, { status: 201, statusText: 'Created' })
    })

    it('keeps the text and says so when the visitor sends too fast', () => {
        component.form.controls.text.setValue('Hi again')

        component.send()
        httpMock.expectOne(url).flush(null, { status: 429, statusText: 'Too Many Requests' })

        expect(toasts.toasts()[0].message).toContain('too fast')
        expect(component.form.controls.text.value).toBe('Hi again')
    })

    it('is blocked with an explanation while the Raspberry is offline', () => {
        component.form.controls.text.setValue('Hi')
        TestBed.inject(BackendStatusService).markOffline()
        fixture.detectChanges()

        expect(sendButton().disabled).toBe(true)
        expect(fixture.nativeElement.textContent).toContain('probably switched off')
    })
})
