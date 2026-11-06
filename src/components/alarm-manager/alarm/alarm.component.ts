import { Component, inject, Input } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../../service/backend-status.service'
import { RaspberryApi } from '../../../service/raspberry.api'
import { ToastService } from '../../../service/toast.service'

@Component({
    selector: 'app-alarm',
    standalone: true,
    imports: [FontAwesomeModule],
    templateUrl: './alarm.component.html',
    styleUrl: './alarm.component.scss',
})
export class AlarmComponent {
    faPlay = faPlay

    private api = inject(RaspberryApi)
    private toasts = inject(ToastService)
    backendStatus = inject(BackendStatusService)

    melodies = ['Are you sleeping', 'Nokia', 'Old MacDonald', 'Panic', 'Pink panther', 'Pirates', 'Twinkle']

    @Input({ required: true })
    form!: FormGroup

    get day(): string {
        return this.form.value.day
    }

    /** "HH:MM" for the native time input */
    get time(): string {
        const pad = (value: number) => String(value).padStart(2, '0')
        return `${pad(this.form.value.hour)}:${pad(this.form.value.minute)}`
    }

    setTime(event: Event): void {
        const match = /^(\d{2}):(\d{2})$/.exec((event.target as HTMLInputElement).value)
        if (!match) return
        this.form.patchValue({ hour: Number(match[1]), minute: Number(match[2]) })
    }

    toggleEnabled(): void {
        const enabled = this.form.get('enabled')!
        enabled.setValue(!enabled.value)
    }

    setMelody(event: Event): void {
        this.form.get('melody')!.setValue((event.target as HTMLSelectElement).value)
    }

    play(): void {
        const melody = this.form.value.melody
        this.api.playMelody(melody).subscribe({
            next: () => this.toasts.info(`Playing "${melody}" on the Raspberry`),
            error: err => this.toasts.error(isBackendUnreachable(err) ? BACKEND_OFFLINE_MESSAGE : 'The melody could not be played.'),
        })
    }
}
