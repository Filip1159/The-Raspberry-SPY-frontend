import {} from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { FormBuilder } from '@angular/forms'
import { AlarmComponent } from './alarm.component'

describe('AlarmComponent', () => {
    let fixture: ComponentFixture<AlarmComponent>
    let component: AlarmComponent

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlarmComponent],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents()

        fixture = TestBed.createComponent(AlarmComponent)
        fixture.componentRef.setInput(
            'form',
            TestBed.inject(FormBuilder).group({ day: ['monday'], hour: [7], minute: [5], enabled: [true], melody: ['Nokia'] })
        )
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    it('shows the time as HH:MM', () => {
        expect(component.time).toBe('07:05')
    })

    it('updates the hour and minute from the time input', () => {
        component.setTime({ target: { value: '23:45' } } as unknown as Event)

        expect(component.form.value.hour).toBe(23)
        expect(component.form.value.minute).toBe(45)
    })

    it('ignores an empty time input', () => {
        component.setTime({ target: { value: '' } } as unknown as Event)

        expect(component.form.value.hour).toBe(7)
    })

    it('toggles the alarm', () => {
        component.toggleEnabled()

        expect(component.form.value.enabled).toBe(false)
    })
})
