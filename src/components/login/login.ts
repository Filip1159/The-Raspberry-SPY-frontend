import { Component, inject, signal } from '@angular/core'
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../service/auth.service'

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class Login {
    private auth = inject(AuthService)
    private router = inject(Router)

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
                this.router.navigate(['/video'])
            },
            error: () => this.error.set('Wrong credentials'),
        })
    }
}
