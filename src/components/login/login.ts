import { HttpErrorResponse } from '@angular/common/http'
import { Component, inject, signal } from '@angular/core'
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../service/auth.service'
import { RouterLink } from '@angular/router'
import { BackendStatusBanner } from '../backend-status-banner/backend-status-banner'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../service/backend-status.service'

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, RouterLink, BackendStatusBanner],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class Login {
    private auth = inject(AuthService)
    private router = inject(Router)
    backendStatus = inject(BackendStatusService)
    offlineMessage = BACKEND_OFFLINE_MESSAGE

    form = new FormGroup({
        username: new FormControl('', { validators: Validators.required, nonNullable: true }),
        password: new FormControl('', { validators: Validators.required, nonNullable: true }),
    })

    error = signal('')

    onSubmit() {
        if (!this.form.valid) return

        const { username, password } = this.form.value

        this.auth.login(username!, password!).subscribe({
            next: res => {
                this.auth.saveToken(res.access_token)
                console.log('token saved')
                this.router.navigate(['/app/video'])
            },
            error: err => this.error.set(this.errorMessage(err)),
        })
    }

    private errorMessage(error: unknown): string {
        if (isBackendUnreachable(error)) return BACKEND_OFFLINE_MESSAGE
        if (error instanceof HttpErrorResponse && error.status === 401) return 'Wrong credentials'
        if (error instanceof HttpErrorResponse && error.status === 429) return 'Too many failed attempts. Please wait a minute and try again.'
        return 'Something went wrong. Please try again.'
    }
}
