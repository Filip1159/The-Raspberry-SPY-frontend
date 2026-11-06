import { ComponentFixture, TestBed } from '@angular/core/testing'
import { ToastService } from '../../service/toast.service'
import { Toasts } from './toasts'

describe('Toasts', () => {
    let fixture: ComponentFixture<Toasts>
    let service: ToastService

    const items = () => Array.from(fixture.nativeElement.querySelectorAll('.toast')) as HTMLElement[]

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [Toasts] }).compileComponents()
        service = TestBed.inject(ToastService)
        fixture = TestBed.createComponent(Toasts)
        fixture.detectChanges()
    })

    it('announces errors as alerts and everything else politely', () => {
        service.success('Saved')
        service.error('Failed')
        fixture.detectChanges()

        expect(items().map(item => item.getAttribute('role'))).toEqual(['status', 'alert'])
        expect(items().map(item => item.textContent!.replace('×', '').trim())).toEqual(['Saved', 'Failed'])
    })

    it('can be closed with the button', () => {
        service.info('Hello')
        fixture.detectChanges()
        ;(fixture.nativeElement.querySelector('.toast__close') as HTMLButtonElement).click()
        fixture.detectChanges()

        expect(items().length).toBe(0)
    })
})
