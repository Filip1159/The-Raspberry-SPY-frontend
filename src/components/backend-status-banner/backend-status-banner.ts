import { Component, inject } from '@angular/core'
import { BackendStatusService } from '../../service/backend-status.service'

@Component({
    selector: 'backend-status-banner',
    standalone: true,
    templateUrl: './backend-status-banner.html',
    styleUrl: './backend-status-banner.scss',
})
export class BackendStatusBanner {
    backendStatus = inject(BackendStatusService)
}
