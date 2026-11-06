import { Component, inject } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { RaspberryApi } from '../../service/raspberry.api'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../service/backend-status.service'

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

    form = new FormGroup({
        text: new FormControl('', { validators: Validators.required, nonNullable: true }),
    })

    send() {
        this.api.sendGreeting(this.form.controls.text.value).subscribe({
            next: () => {
                alert('Greeting send! Thank you!')
                this.form.controls.text.reset()
            },
            error: err => alert(isBackendUnreachable(err) ? BACKEND_OFFLINE_MESSAGE : 'Failed to save greeting :( My bad...'),
        })
    }
}
