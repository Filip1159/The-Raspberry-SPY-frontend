import { Mock, vi } from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { signal } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { BackendStatusService } from '../../service/backend-status.service'
import { SocketService } from '../../service/socket.service'
import { VideoStreamComponent } from './video-stream.component'

describe('VideoStreamComponent', () => {
    let component: VideoStreamComponent
    let fixture: ComponentFixture<VideoStreamComponent>
    let emit: Mock
    let connected: ReturnType<typeof signal<boolean>>

    const press = (key: string, target: EventTarget = document.body) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        target.dispatchEvent(event)
        return event
    }

    beforeEach(async () => {
        emit = vi.fn()
        connected = signal(true)
        await TestBed.configureTestingModule({
            imports: [VideoStreamComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SocketService, useValue: { connected, emit } }],
        }).compileComponents()

        fixture = TestBed.createComponent(VideoStreamComponent)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    it('starts with the camera off', () => {
        expect(component.state()).toBe('off')
        expect(fixture.nativeElement.textContent).toContain('The camera is off')
    })

    it('steers the camera with the arrow keys and centers it with C', () => {
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
        expect(emit).toHaveBeenCalledWith('message', 'UP')

        // pretend the key repeat limit has passed
        ;(component as unknown as { lastKeyMove: number }).lastKeyMove = 0
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'c' }))
        expect(emit).toHaveBeenCalledWith('message', 'CENTER')
    })

    it('limits how fast held keys move the camera', () => {
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))

        expect(emit).toHaveBeenCalledTimes(1)
    })

    it('prevents the page from scrolling when an arrow key steers the camera', () => {
        expect(press('ArrowDown').defaultPrevented).toBe(true)
    })

    it('leaves the keys alone while a form control has the focus', () => {
        const slider = document.createElement('input')
        document.body.appendChild(slider)

        const event = press('ArrowRight', slider)

        expect(event.defaultPrevented).toBe(false)
        expect(emit).not.toHaveBeenCalled()
        slider.remove()
    })

    it('ignores other keys and shortcuts', () => {
        press('a')
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', ctrlKey: true, bubbles: true }))

        expect(emit).not.toHaveBeenCalled()
    })

    it('does not steer while the websocket is down or the Raspberry is offline', () => {
        connected.set(false)
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
        expect(emit).not.toHaveBeenCalled()

        connected.set(true)
        TestBed.inject(BackendStatusService).markOffline()
        expect(component.canControl()).toBe(false)
    })

    it('disables the control pad and explains why while the connection is down', () => {
        connected.set(false)
        fixture.detectChanges()

        const buttons = Array.from(fixture.nativeElement.querySelectorAll('.stream__pad button')) as HTMLButtonElement[]
        expect(buttons.length).toBe(9)
        expect(buttons.every(b => b.disabled)).toBe(true)
        expect(fixture.nativeElement.textContent).toContain('Reconnecting')
    })

    it('shows an error with a retry button when the stream fails', () => {
        component.state.set('connecting')

        component.onVideoError()
        fixture.detectChanges()

        expect(component.state()).toBe('error')
        expect(fixture.nativeElement.textContent).toContain('Try again')
    })

    it('ignores video errors while the camera is off', () => {
        component.onVideoError()

        expect(component.state()).toBe('off')
    })

    it('sends the light brightness', () => {
        component.setBrightness(128)

        expect(emit).toHaveBeenCalledWith('message', 'LED128')
    })
})
