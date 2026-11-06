import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { BackendStatusBanner } from '../backend-status-banner/backend-status-banner'
import { HeaderComponent } from '../header/header.component'
import { MobileNavComponent } from '../header/mobile/mobile-nav'

// Layout of the area for signed-in users: header with tabs, mobile bottom navigation, the "Raspberry is off" banner
@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [RouterOutlet, BackendStatusBanner, HeaderComponent, MobileNavComponent],
    template: `
        <backend-status-banner />
        <app-header />
        <mobile-nav />
        <router-outlet />
    `,
})
export class AppShell {}
