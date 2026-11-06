import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { Toasts } from '../toasts/toasts'

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, Toasts],
    templateUrl: './root.component.html',
})
export class RootComponent {}
