import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService } from '../../../service/auth.service'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faAlarmClock } from '@fortawesome/free-regular-svg-icons'
import { faPaperPlane } from '@fortawesome/free-regular-svg-icons'
import { faUserSecret } from '@fortawesome/free-solid-svg-icons'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { faBarsStaggered } from '@fortawesome/free-solid-svg-icons'
import { faLock } from '@fortawesome/free-solid-svg-icons'

@Component({
    selector: 'mobile-nav',
    standalone: true,
    imports: [FontAwesomeModule, RouterLink, RouterLinkActive],
    templateUrl: './mobile-nav.html',
    styleUrl: './mobile-nav.scss',
})
export class MobileNavComponent {
    auth = inject(AuthService)

    faAlarmClock = faAlarmClock
    faPaperPlane = faPaperPlane
    faUserSecret = faUserSecret
    faCircleInfo = faCircleInfo
    faBarsStaggered = faBarsStaggered
    faLock = faLock

    logout() {
        this.auth.logout()
    }
}
