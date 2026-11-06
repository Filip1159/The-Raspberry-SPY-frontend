import { Component } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faAlarmClock } from '@fortawesome/free-regular-svg-icons'
import { faBarsStaggered, faHouse, faUserSecret } from '@fortawesome/free-solid-svg-icons'

@Component({
    selector: 'mobile-nav',
    standalone: true,
    imports: [FontAwesomeModule, RouterLink, RouterLinkActive],
    templateUrl: './mobile-nav.html',
    styleUrl: './mobile-nav.scss',
})
export class MobileNavComponent {
    faAlarmClock = faAlarmClock
    faUserSecret = faUserSecret
    faBarsStaggered = faBarsStaggered
    faHouse = faHouse
}
