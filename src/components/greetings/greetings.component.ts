import { HttpErrorResponse } from '@angular/common/http'
import { Component, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { RaspberryApi } from '../../service/raspberry.api'
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
    backendStatus = inject(BackendStatusService)
    offlineMessage = BACKEND_OFFLINE_MESSAGE

    faPaperPlane = faPaperPlane

    readonly maxLength = MAX_GREETING_LENGTH

    form = new FormGroup({
        text: new FormControl('', { validators: [Validators.required, Validators.maxLength(MAX_GREETING_LENGTH)], nonNullable: true }),
    })

    send() {
        this.api.sendGreeting(this.form.controls.text.value).subscribe({
            next: () => {
                alert('Greeting send! Thank you!')
                this.form.controls.text.reset()
            },
            error: err => alert(this.errorMessage(err)),
        })
    }

    private errorMessage(error: unknown): string {
        if (isBackendUnreachable(error)) return BACKEND_OFFLINE_MESSAGE
        if (error instanceof HttpErrorResponse && error.status === 429)
            return 'You are sending greetings a bit too fast. Please try again in a minute.'
        return 'Failed to save greeting :( My bad...'
    }
}
