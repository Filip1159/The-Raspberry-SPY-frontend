import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { HeaderComponent } from './../header/header.component'
import { MobileNavComponent } from '../header/mobile/mobile-nav'
import { BackendStatusBanner } from '../backend-status-banner/backend-status-banner'

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, HeaderComponent, MobileNavComponent, BackendStatusBanner],
    templateUrl: './root.component.html',
})
export class RootComponent {}
