import { afterNextRender, Component, inject, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { faChess } from '@fortawesome/free-solid-svg-icons'
import { faDuolingo, faGithub, faLinkedinIn } from '@fortawesome/free-brands-svg-icons'
import { AuthService } from '../../service/auth.service'
import { PROJECTS, SKILL_GROUPS, SOCIAL_LINKS } from './portfolio.data'
import { ThemeToggle } from '../theme-toggle/theme-toggle'
import { RaspberrySpySection } from './raspberry-spy-section/raspberry-spy-section'
import { Icon } from '../icon/icon'
import { ProjectGallery } from './project-gallery/project-gallery'

@Component({
    selector: 'portfolio',
    standalone: true,
    imports: [Icon, ProjectGallery, RouterLink, RaspberrySpySection, ThemeToggle],
    templateUrl: './portfolio.html',
    styleUrl: './portfolio.scss',
})
export class Portfolio {
    private auth = inject(AuthService)

    // Resolved after hydration: the pre-rendered page always shows the signed-out state
    signedIn = signal(false)

    faChess = faChess
    faDuolingo = faDuolingo
    faGithub = faGithub
    faLinkedinIn = faLinkedinIn

    readonly projects = PROJECTS
    readonly skillGroups = SKILL_GROUPS
    readonly links = SOCIAL_LINKS
    readonly year = new Date().getFullYear()

    constructor() {
        afterNextRender(() => this.signedIn.set(this.auth.isLoggedIn()))
    }
}
