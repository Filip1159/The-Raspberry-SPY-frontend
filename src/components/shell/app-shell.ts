import { Component, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { StatsService } from '../../service/stats.service'
import { BackendStatusBanner } from '../backend-status-banner/backend-status-banner'
import { Header } from '../header/header'
import { MobileNav } from '../header/mobile/mobile-nav'

// Layout of the area for signed-in users: header with tabs, mobile bottom navigation, the "Raspberry is off" banner
@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [RouterOutlet, BackendStatusBanner, Header, MobileNav],
    template: `
        <a class="skip-link" href="#main">Skip to the content</a>
        <backend-status-banner />
        <app-header />
        <router-outlet />
        <mobile-nav />
    `,
})
export class AppShell {
    // Starts collecting stats as soon as the signed-in area opens, so the charts already have history on the stats tab
    private stats = inject(StatsService)
}
