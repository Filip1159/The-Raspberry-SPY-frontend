import { HttpErrorResponse } from '@angular/common/http'
import { Component, inject, signal } from '@angular/core'
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { AuthService } from '../../service/auth.service'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../service/backend-status.service'
import { BackendStatusBanner } from '../backend-status-banner/backend-status-banner'
import { ThemeToggle } from '../theme-toggle/theme-toggle'

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, RouterLink, FontAwesomeModule, BackendStatusBanner, ThemeToggle],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class Login {
    private auth = inject(AuthService)
    private router = inject(Router)
    backendStatus = inject(BackendStatusService)
    offlineMessage = BACKEND_OFFLINE_MESSAGE

    faEye = faEye
    faEyeSlash = faEyeSlash

    form = new FormGroup({
        username: new FormControl('', { validators: Validators.required, nonNullable: true }),
        password: new FormControl('', { validators: Validators.required, nonNullable: true }),
    })

    error = signal('')
    submitting = signal(false)
    showPassword = signal(false)

    onSubmit() {
        if (this.submitting()) return
        if (!this.form.valid) {
            this.error.set('Enter your username and password.')
            return
        }

        const { username, password } = this.form.getRawValue()
        this.error.set('')
        this.submitting.set(true)

        this.auth.login(username, password).subscribe({
            next: res => {
                this.auth.saveToken(res.access_token)
                this.router.navigate(['/app/video'])
            },
            error: err => {
                this.submitting.set(false)
                this.error.set(this.errorMessage(err))
            },
        })
    }

    private errorMessage(error: unknown): string {
        if (isBackendUnreachable(error)) return BACKEND_OFFLINE_MESSAGE
        if (error instanceof HttpErrorResponse && error.status === 401) return 'Wrong username or password.'
        if (error instanceof HttpErrorResponse && error.status === 429) return 'Too many failed attempts. Please wait a minute and try again.'
        return 'Something went wrong. Please try again.'
    }
}
