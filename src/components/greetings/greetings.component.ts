import { HttpErrorResponse } from '@angular/common/http'
import { Component, inject, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { RaspberryApi } from '../../service/raspberry.api'
import { ToastService } from '../../service/toast.service'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../service/backend-status.service'

// Same limit as the backend
const MAX_GREETING_LENGTH = 500

@Component({
    selector: 'greetings',
    standalone: true,
    imports: [FontAwesomeModule, ReactiveFormsModule],
    templateUrl: './greetings.component.html',
    styleUrl: './greetings.component.scss',
})
export class GreetingsComponent {
    private api = inject(RaspberryApi)
    private toasts = inject(ToastService)
    backendStatus = inject(BackendStatusService)
    offlineMessage = BACKEND_OFFLINE_MESSAGE

    faPaperPlane = faPaperPlane

    readonly maxLength = MAX_GREETING_LENGTH
    sending = signal(false)

    form = new FormGroup({
        text: new FormControl('', { validators: [Validators.required, Validators.maxLength(MAX_GREETING_LENGTH)], nonNullable: true }),
    })

    send() {
        if (this.sending()) return
        this.sending.set(true)
        this.api.sendGreeting(this.form.controls.text.value).subscribe({
            next: () => {
                this.sending.set(false)
                this.toasts.success('Greeting sent, thank you!')
                this.form.controls.text.reset()
            },
            error: err => {
                this.sending.set(false)
                this.toasts.error(this.errorMessage(err))
            },
        })
    }

    private errorMessage(error: unknown): string {
        if (isBackendUnreachable(error)) return BACKEND_OFFLINE_MESSAGE
        if (error instanceof HttpErrorResponse && error.status === 429)
            return 'You are sending greetings a bit too fast. Please try again in a minute.'
        return 'Failed to save greeting :( My bad...'
    }
}
