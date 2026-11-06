import { Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faChess } from '@fortawesome/free-solid-svg-icons'
import { faDuolingo, faGithub, faLinkedinIn } from '@fortawesome/free-brands-svg-icons'
import { AuthService } from '../../service/auth.service'
import { PROJECTS, SKILL_GROUPS, SOCIAL_LINKS } from './portfolio.data'
import { RaspberrySpySection } from './raspberry-spy-section/raspberry-spy-section'

@Component({
    selector: 'portfolio',
    standalone: true,
    imports: [FontAwesomeModule, RouterLink, RaspberrySpySection],
    templateUrl: './portfolio.html',
    styleUrl: './portfolio.scss',
})
export class Portfolio {
    auth = inject(AuthService)

    faChess = faChess
    faDuolingo = faDuolingo
    faGithub = faGithub
    faLinkedinIn = faLinkedinIn

    readonly projects = PROJECTS
    readonly skillGroups = SKILL_GROUPS
    readonly links = SOCIAL_LINKS
    readonly year = new Date().getFullYear()
}
