import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService } from '../../service/auth.service'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { ThemeToggle } from '../theme-toggle/theme-toggle'

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [FontAwesomeModule, RouterLink, RouterLinkActive, ThemeToggle],
    templateUrl: './header.html',
    styleUrl: './header.scss',
})
export class Header {
    private auth = inject(AuthService)

    faArrowRightFromBracket = faArrowRightFromBracket

    logout() {
        this.auth.logout()
    }
}
