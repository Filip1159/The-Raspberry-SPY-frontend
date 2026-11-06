import { Component, ElementRef, HostListener, inject, OnDestroy, signal, ViewChild, computed } from '@angular/core'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faAngleUp, faArrowsToCircle, faLightbulb, faVideo, faVideoSlash } from '@fortawesome/free-solid-svg-icons'
import { SocketService } from '../../service/socket.service'
import { LongPressButton } from './longpress-button/longpress-button.component'
import { Slider } from './slider/slider'
import { env } from './../../environment'
import { AuthService } from '../../service/auth.service'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService } from '../../service/backend-status.service'
import type { MockCamera } from './mock-camera'

export type CameraState = 'off' | 'connecting' | 'live' | 'error'

// Arrow keys steer the camera, C centers it
const KEY_DIRECTIONS: Record<string, string> = {
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    c: 'CENTER',
    C: 'CENTER',
}
const KEY_REPEAT_MS = 100

@Component({
    selector: 'app-video-stream',
    standalone: true,
    imports: [FontAwesomeModule, LongPressButton, Slider],
    templateUrl: './video-stream.component.html',
    styleUrl: './video-stream.component.scss',
})
export class VideoStreamComponent implements OnDestroy {
    @ViewChild('video', { static: false })
    private video!: ElementRef<HTMLVideoElement>

    private auth = inject(AuthService)
    private socket = inject(SocketService)
    backendStatus = inject(BackendStatusService)

    faAngleUp = faAngleUp
    faArrowsToCircle = faArrowsToCircle
    faLightbulb = faLightbulb
    faVideo = faVideo
    faVideoSlash = faVideoSlash

    offlineMessage = BACKEND_OFFLINE_MESSAGE

    state = signal<CameraState>('off')
    brightness = 0

    /** The steering needs the websocket, which exists only while the Raspberry is reachable */
    canControl = computed(() => this.socket.connected() && !this.backendStatus.isOffline())

    private mockCamera: MockCamera | null = null
    private lastKeyMove = 0

    async cameraOn() {
        this.state.set('connecting')
        const video = this.video.nativeElement
        video.onloadeddata = () => video.play().catch(() => undefined)
        video.onplaying = () => this.state.set('live')

        if (env.mock) {
            // No HLS stream without a Raspberry: show a generated test pattern instead
            const { createMockCameraStream } = await import('./mock-camera')
            this.mockCamera?.stop()
            this.mockCamera = createMockCameraStream()
            video.srcObject = this.mockCamera.stream
        } else {
            video.src = `${env.hlsUrl}/cam1/index.m3u8?jwt=${this.auth.token()}`
        }
    }

    cameraOff() {
        const video = this.video.nativeElement
        video.onloadeddata = null
        video.onplaying = null
        video.pause()
        video.removeAttribute('src')
        video.srcObject = null
        video.load()
        this.mockCamera?.stop()
        this.mockCamera = null
        this.state.set('off')
    }

    onVideoError(): void {
        if (this.state() === 'off') return
        this.state.set('error')
        // Find out whether the whole Raspberry is down or just the stream
        this.backendStatus.check()
    }

    move(msg: string): void {
        this.socket.emit('message', msg)
    }

    setBrightness(value: number): void {
        this.brightness = value
        this.socket.emit('message', `LED${value}`)
    }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        const direction = KEY_DIRECTIONS[event.key]
        if (!direction || event.ctrlKey || event.metaKey || event.altKey || !this.canControl()) return

        // leave the keys alone while a form control (the brightness slider) has the focus
        const target = event.target as HTMLElement
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

        event.preventDefault()
        const now = Date.now()
        if (now - this.lastKeyMove < KEY_REPEAT_MS) return
        this.lastKeyMove = now
        this.move(direction)
    }

    ngOnDestroy(): void {
        this.mockCamera?.stop()
    }
}
