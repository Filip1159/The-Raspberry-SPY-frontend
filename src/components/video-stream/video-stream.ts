import { Component, ElementRef, HostListener, inject, OnDestroy, signal, ViewChild, computed } from '@angular/core'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faAngleUp, faArrowsToCircle, faCamera, faExpand, faLightbulb, faVideo, faVideoSlash } from '@fortawesome/free-solid-svg-icons'
import { SocketService } from '../../service/socket.service'
import { LongPressButton } from './longpress-button/longpress-button'
import { Slider } from './slider/slider'
import { CameraSettingsCard } from './camera-settings/camera-settings'
import { env } from './../../environment'
import { StreamTokenService } from '../../service/stream-token.service'
import { ToastService } from '../../service/toast.service'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService } from '../../service/backend-status.service'
import type { MockCamera } from './mock-camera'
import type { HlsPlayback } from './hls-player'

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
// MediaMTX restarts the camera when its settings change: give it a moment before the player reconnects
const STREAM_RESTART_MS = 4000
// A hidden tab keeps the (on-demand) camera running for nobody: stop after this long, so a quick look at another tab costs nothing
const HIDDEN_STOP_MS = 30_000

@Component({
    selector: 'app-video-stream',
    standalone: true,
    imports: [FontAwesomeModule, LongPressButton, Slider, CameraSettingsCard],
    templateUrl: './video-stream.html',
    styleUrl: './video-stream.scss',
})
export class VideoStream implements OnDestroy {
    @ViewChild('video', { static: false })
    private video!: ElementRef<HTMLVideoElement>

    private streamToken = inject(StreamTokenService)
    private socket = inject(SocketService)
    private toasts = inject(ToastService)
    backendStatus = inject(BackendStatusService)

    faAngleUp = faAngleUp
    faArrowsToCircle = faArrowsToCircle
    faCamera = faCamera
    faExpand = faExpand
    faLightbulb = faLightbulb
    faVideo = faVideo
    faVideoSlash = faVideoSlash

    offlineMessage = BACKEND_OFFLINE_MESSAGE

    state = signal<CameraState>('off')
    /** True while a live stream has run out of data and waits for more (HLS stall) */
    buffering = signal(false)
    brightness = 0

    /** The steering needs the websocket, which exists only while the Raspberry is reachable */
    canControl = computed(() => this.socket.connected() && !this.backendStatus.isOffline())

    private mockCamera: MockCamera | null = null
    private hls: HlsPlayback | null = null
    /** Counts camera starts, so a slow hls.js import of an earlier start cannot take over a later one */
    private session = 0
    private lastKeyMove = 0
    private restartTimer: ReturnType<typeof setTimeout> | null = null
    private hiddenTimer: ReturnType<typeof setTimeout> | null = null
    /** The stream was stopped because the tab was hidden, so it starts again when the tab is shown */
    private resumeWhenVisible = false

    async cameraOn() {
        this.resumeWhenVisible = false
        this.state.set('connecting')
        const video = this.video.nativeElement
        video.onloadeddata = () => video.play().catch(() => undefined)
        video.onplaying = () => {
            this.buffering.set(false)
            this.state.set('live')
        }
        video.onwaiting = () => this.buffering.set(this.state() === 'live')

        const session = ++this.session
        this.stopHls()

        if (env.mock) {
            // No HLS stream without a Raspberry: show a generated test pattern instead
            const { createMockCameraStream } = await import('./mock-camera')
            this.mockCamera?.stop()
            this.mockCamera = createMockCameraStream()
            video.srcObject = this.mockCamera.stream
            return
        }

        const playlist = `${env.hlsUrl}/cam1/index.m3u8`
        try {
            // a short-lived token that only the video server accepts: the URLs (and so the logs) never hold the login token
            await this.streamToken.start()
        } catch {
            if (session === this.session) this.onVideoError()
            return
        }
        if (session !== this.session) return

        const playNatively = () => (video.src = `${playlist}?jwt=${this.streamToken.token()}`)
        try {
            const { playWithHls } = await import('./hls-player')
            const hls = await playWithHls({
                video,
                url: playlist,
                token: () => this.streamToken.token(),
                onFallback: playNatively,
                onFatalError: () => this.onVideoError(),
            })
            if (session !== this.session) return hls?.destroy()
            if (hls) this.hls = hls
            else playNatively()
        } catch {
            // the player chunk could not be loaded (offline, deployment in between): the browser's own player still works
            if (session === this.session) playNatively()
        }
    }

    /** The camera settings changed on the Raspberry, so the running stream ends: show the player as connecting and reconnect */
    restartStream(): void {
        if (this.state() === 'off') return
        this.state.set('connecting')
        this.clearRestartTimer()
        this.restartTimer = setTimeout(() => {
            this.restartTimer = null
            if (this.state() !== 'off') this.cameraOn()
        }, STREAM_RESTART_MS)
    }

    cameraOff() {
        this.resumeWhenVisible = false
        this.clearHiddenTimer()
        this.session++
        this.stopHls()
        this.streamToken.stop()
        this.clearRestartTimer()
        const video = this.video.nativeElement
        video.onloadeddata = null
        video.onplaying = null
        video.onwaiting = null
        this.buffering.set(false)
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

    /** Saves the current frame as a PNG */
    takeSnapshot(): void {
        const video = this.video.nativeElement
        if (!video.videoWidth) return
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        try {
            canvas.getContext('2d')?.drawImage(video, 0, 0)
            const link = document.createElement('a')
            link.href = canvas.toDataURL('image/png')
            link.download = `raspberry-spy-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
            link.click()
            this.toasts.success('Snapshot saved')
        } catch {
            // a stream from another origin without CORS headers taints the canvas
            this.toasts.error('The browser did not allow saving this frame')
        }
    }

    /** Fullscreen of the frame (not the bare video), so the overlays stay visible */
    toggleFullscreen(): void {
        const frame = this.video.nativeElement.parentElement
        if (document.fullscreenElement) document.exitFullscreen()
        else frame?.requestFullscreen?.()
    }

    move(msg: string): void {
        this.socket.emit('message', msg)
    }

    setBrightness(value: number): void {
        this.brightness = value
        this.socket.emit('message', `LED${value}`)
    }

    @HostListener('document:visibilitychange')
    onVisibilityChange(): void {
        if (!document.hidden) {
            this.clearHiddenTimer()
            if (this.resumeWhenVisible) this.cameraOn()
            return
        }

        const state = this.state()
        if (state !== 'connecting' && state !== 'live') return
        this.clearHiddenTimer()
        this.hiddenTimer = setTimeout(() => {
            this.hiddenTimer = null
            const current = this.state()
            // Picture-in-picture is watching even though the tab is hidden
            if (!document.hidden || (current !== 'connecting' && current !== 'live') || document.pictureInPictureElement) return
            this.cameraOff()
            this.resumeWhenVisible = true
        }, HIDDEN_STOP_MS)
    }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        const direction = KEY_DIRECTIONS[event.key]
        if (!direction || event.ctrlKey || event.metaKey || event.altKey || !this.canControl()) return

        // leave the keys alone while a form control (the brightness slider) has the focus
        const target = event.target as HTMLElement | null
        if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

        event.preventDefault()
        const now = Date.now()
        if (now - this.lastKeyMove < KEY_REPEAT_MS) return
        this.lastKeyMove = now
        this.move(direction)
    }

    private clearHiddenTimer(): void {
        if (this.hiddenTimer) clearTimeout(this.hiddenTimer)
        this.hiddenTimer = null
    }

    private stopHls(): void {
        this.hls?.destroy()
        this.hls = null
    }

    private clearRestartTimer(): void {
        if (this.restartTimer) clearTimeout(this.restartTimer)
        this.restartTimer = null
    }

    ngOnDestroy(): void {
        this.clearHiddenTimer()
        this.stopHls()
        this.streamToken.stop()
        this.clearRestartTimer()
        this.mockCamera?.stop()
    }
}
