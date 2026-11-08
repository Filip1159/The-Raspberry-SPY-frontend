import { Mock, vi } from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { signal } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { BackendStatusService } from '../../service/backend-status.service'
import { ToastService } from '../../service/toast.service'
import { SocketService } from '../../service/socket.service'
import { VideoStream } from './video-stream'

// hls.js needs MediaSource, which jsdom does not have: a stand-in that records what the page asks of it
const hlsMock = vi.hoisted(() => {
    const state = { supported: false, instances: [] as InstanceType<typeof FakeHls>[], onError: undefined as unknown as (data: unknown) => void }
    class FakeHls {
        static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifestParsed' }
        static ErrorTypes = { MEDIA_ERROR: 'mediaError', NETWORK_ERROR: 'networkError' }
        static isSupported = () => state.supported
        loadSource = vi.fn()
        attachMedia = vi.fn()
        destroy = vi.fn()
        recoverMediaError = vi.fn()
        on = (event: string, handler: (event: string, data: unknown) => void) => {
            if (event === 'error') state.onError = data => handler('error', data)
        }
        constructor() {
            state.instances.push(this)
        }
    }
    return { state, FakeHls }
})
vi.mock('hls.js', () => ({ default: hlsMock.FakeHls }))

describe('VideoStream', () => {
    let component: VideoStream
    let fixture: ComponentFixture<VideoStream>
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
            imports: [VideoStream],
            providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SocketService, useValue: { connected, emit } }],
        }).compileComponents()

        fixture = TestBed.createComponent(VideoStream)
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

    it('shows a buffering overlay while a live stream stalls and hides it when playback resumes', () => {
        const video: HTMLVideoElement = fixture.nativeElement.querySelector('video')
        component.state.set('connecting')
        component.cameraOn()
        video.onplaying?.(new Event('playing'))
        fixture.detectChanges()
        expect(fixture.nativeElement.textContent).not.toContain('Buffering')

        video.onwaiting?.(new Event('waiting'))
        fixture.detectChanges()
        expect(fixture.nativeElement.textContent).toContain('Buffering')

        video.onplaying?.(new Event('playing'))
        fixture.detectChanges()
        expect(fixture.nativeElement.textContent).not.toContain('Buffering')
    })

    it('does not call waiting before the first frame "buffering"', () => {
        const video: HTMLVideoElement = fixture.nativeElement.querySelector('video')
        component.cameraOn()
        video.onwaiting?.(new Event('waiting'))

        expect(component.buffering()).toBe(false)
    })

    it('offers the snapshot only while the stream is live', () => {
        const snapshot = () => [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLElement) => b.textContent?.includes('Snapshot'))
        component.state.set('connecting')
        fixture.detectChanges()
        expect(snapshot().disabled).toBe(true)

        component.state.set('live')
        fixture.detectChanges()
        expect(snapshot().disabled).toBe(false)
    })

    describe('snapshot', () => {
        let download: Mock
        let toasts: ToastService

        beforeEach(() => {
            toasts = TestBed.inject(ToastService)
            vi.spyOn(toasts, 'success')
            vi.spyOn(toasts, 'error')
            download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined) as unknown as Mock
            vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
            const video: HTMLVideoElement = fixture.nativeElement.querySelector('video')
            Object.defineProperty(video, 'videoWidth', { value: 640 })
            Object.defineProperty(video, 'videoHeight', { value: 360 })
        })

        afterEach(() => vi.restoreAllMocks())

        it('downloads the current frame as a PNG', () => {
            vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')

            component.takeSnapshot()

            expect(download).toHaveBeenCalled()
            expect(toasts.success).toHaveBeenCalled()
        })

        it('says so when the browser refuses to export the frame', () => {
            vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
                throw new Error('tainted canvas')
            })

            component.takeSnapshot()

            expect(download).not.toHaveBeenCalled()
            expect(toasts.error).toHaveBeenCalled()
        })
    })

    it('enters and leaves fullscreen with the frame', () => {
        const frame = fixture.nativeElement.querySelector('video').parentElement as HTMLElement
        frame.requestFullscreen = vi.fn().mockResolvedValue(undefined)
        document.exitFullscreen = vi.fn().mockResolvedValue(undefined)

        component.toggleFullscreen()
        expect(frame.requestFullscreen).toHaveBeenCalled()

        Object.defineProperty(document, 'fullscreenElement', { value: frame, configurable: true })
        component.toggleFullscreen()
        expect(document.exitFullscreen).toHaveBeenCalled()
        Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    })

    it('sends the light brightness', () => {
        component.setBrightness(128)

        expect(emit).toHaveBeenCalledWith('message', 'LED128')
    })

    describe('restartStream (the camera settings changed)', () => {
        beforeEach(() => vi.useFakeTimers())
        afterEach(() => vi.useRealTimers())

        it('does nothing while the camera is off', () => {
            component.restartStream()

            expect(component.state()).toBe('off')
        })

        it('shows the player as connecting and reconnects after a moment', async () => {
            const cameraOn = vi.spyOn(component, 'cameraOn').mockResolvedValue()
            component.state.set('live')

            component.restartStream()
            expect(component.state()).toBe('connecting')
            expect(cameraOn).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(4000)
            expect(cameraOn).toHaveBeenCalledTimes(1)
        })

        it('does not reconnect when the camera was turned off meanwhile', async () => {
            const cameraOn = vi.spyOn(component, 'cameraOn').mockResolvedValue()
            component.state.set('live')

            component.restartStream()
            component.cameraOff()
            await vi.advanceTimersByTimeAsync(5000)

            expect(cameraOn).not.toHaveBeenCalled()
        })

        it('reconnects only once when settings are applied twice in a row', async () => {
            const cameraOn = vi.spyOn(component, 'cameraOn').mockResolvedValue()
            component.state.set('live')

            component.restartStream()
            await vi.advanceTimersByTimeAsync(2000)
            component.restartStream()
            await vi.advanceTimersByTimeAsync(5000)

            expect(cameraOn).toHaveBeenCalledTimes(1)
        })
    })

    describe('playback', () => {
        const video = () => fixture.nativeElement.querySelector('video') as HTMLVideoElement
        const instances = () => hlsMock.state.instances

        beforeEach(() => {
            hlsMock.state.supported = false
            hlsMock.state.instances = []
        })

        it('plays the playlist natively with the token where hls.js cannot run', async () => {
            await component.cameraOn()

            expect(video().src).toMatch(/\/cam1\/index\.m3u8\?jwt=/)
            expect(instances()).toHaveLength(0)
        })

        it('leaves the playback to hls.js where it can run', async () => {
            hlsMock.state.supported = true

            await component.cameraOn()

            expect(instances()).toHaveLength(1)
            expect(instances()[0].loadSource).toHaveBeenCalledWith(expect.stringMatching(/\/cam1\/index\.m3u8/))
            expect(video().getAttribute('src')).toBeNull()
        })

        it('falls back to the native player when hls.js fails before the first frame', async () => {
            hlsMock.state.supported = true
            await component.cameraOn()

            hlsMock.state.onError({ fatal: true, type: 'networkError' })

            expect(instances()[0].destroy).toHaveBeenCalled()
            expect(video().src).toMatch(/\/cam1\/index\.m3u8\?jwt=/)
        })

        it('shows the error state when a stream that was playing breaks', async () => {
            hlsMock.state.supported = true
            await component.cameraOn()
            video().dispatchEvent(new Event('playing'))

            hlsMock.state.onError({ fatal: true, type: 'networkError' })

            expect(component.state()).toBe('error')
        })

        it('stops hls.js when the camera is started again or turned off', async () => {
            hlsMock.state.supported = true

            await component.cameraOn()
            await component.cameraOn()
            expect(instances()[0].destroy).toHaveBeenCalledTimes(1)

            component.cameraOff()
            expect(instances()[1].destroy).toHaveBeenCalledTimes(1)
        })

        it('drops a start that was overtaken while hls.js was loading', async () => {
            hlsMock.state.supported = true

            const start = component.cameraOn()
            component.cameraOff()
            await start

            expect(instances()[0].destroy).toHaveBeenCalled()
            expect(component.state()).toBe('off')
        })
    })
})
