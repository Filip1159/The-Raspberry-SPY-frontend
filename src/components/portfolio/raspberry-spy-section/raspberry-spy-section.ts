import { afterNextRender, Component, inject, OnDestroy, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService } from '../../../service/auth.service'
import { BackendStatusService } from '../../../service/backend-status.service'
import { GreetingsComponent } from '../../greetings/greetings.component'
import { RASPBERRY_SPY } from '../portfolio.data'

@Component({
    selector: 'raspberry-spy-section',
    standalone: true,
    imports: [RouterLink, GreetingsComponent],
    templateUrl: './raspberry-spy-section.html',
    styleUrl: './raspberry-spy-section.scss',
})
export class RaspberrySpySection implements OnDestroy {
    private auth = inject(AuthService)
    backendStatus = inject(BackendStatusService)

    readonly spy = RASPBERRY_SPY

    private statusTimer: ReturnType<typeof setInterval> | null = null

    // Resolved after hydration: the pre-rendered page always shows the signed-out state
    signedIn = signal(false)

    constructor() {
        afterNextRender(() => {
            this.signedIn.set(this.auth.isLoggedIn())
            // Keeps the "Raspberry is online/offline" badge fresh while the visitor stays on the page
            this.statusTimer = setInterval(() => this.backendStatus.check(), 30000)
        })
    }

    ngOnDestroy(): void {
        if (this.statusTimer) clearInterval(this.statusTimer)
    }
}
