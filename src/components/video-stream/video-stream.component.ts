import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core'
import { SocketService } from '../../service/socket.service'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faAngleUp, faArrowsToCircle, faLightbulb } from '@fortawesome/free-solid-svg-icons'
import { LongPressButton } from './longpress-button/longpress-button.component'
import { Slider } from './slider/slider'
import { env } from './../../environment'
import { AuthService } from '../../service/auth.service'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService } from '../../service/backend-status.service'

@Component({
    selector: 'app-video-stream',
    standalone: true,
    imports: [FontAwesomeModule, LongPressButton, Slider],
    templateUrl: './video-stream.component.html',
    styleUrl: './video-stream.component.scss',
})
export class VideoStreamComponent {
    @ViewChild('video', { static: false })
    private video!: ElementRef<HTMLVideoElement>

    private auth = inject(AuthService)
    private socket = inject(SocketService)
    backendStatus = inject(BackendStatusService)
    offlineMessage = BACKEND_OFFLINE_MESSAGE

    faAngleUp = faAngleUp
    faArrowsToCircle = faArrowsToCircle
    faLightbulb = faLightbulb

    cameraTurnedOn = signal(false)
    streamError = signal(false)
    brightness = 100

    cameraOn() {
        this.streamError.set(false)
        this.video.nativeElement.src = `${env.hlsUrl}/cam1/index.m3u8?jwt=${this.auth.token()}`
        this.video.nativeElement.onloadeddata = () => this.video.nativeElement.play()
        this.cameraTurnedOn.set(true)
    }

    onVideoError(): void {
        if (!this.cameraTurnedOn()) return
        this.streamError.set(true)
        // Find out whether the whole Raspberry is down or just the stream
        this.backendStatus.check()
    }

    move(msg: string): void {
        this.socket.emit('message', msg)
    }

    setBrightness(value: number): void {
        this.socket.emit('message', `LED${value}`)
    }
}
