import { Component, inject } from '@angular/core'
import { ToastService } from '../../service/toast.service'

@Component({
    selector: 'toasts',
    standalone: true,
    templateUrl: './toasts.html',
    styleUrl: './toasts.scss',
})
export class Toasts {
    toastService = inject(ToastService)
}
