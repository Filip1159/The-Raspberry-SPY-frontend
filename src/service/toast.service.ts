import { Injectable, signal } from '@angular/core'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
    id: number
    kind: ToastKind
    message: string
}

/** Short messages that replace alert(): shown in a live region at the corner of the screen and dismissed automatically */
@Injectable({ providedIn: 'root' })
export class ToastService {
    private nextId = 1
    readonly toasts = signal<Toast[]>([])

    success(message: string) {
        this.show('success', message)
    }

    error(message: string) {
        this.show('error', message, 8000)
    }

    warning(message: string) {
        this.show('warning', message, 8000)
    }

    info(message: string) {
        this.show('info', message)
    }

    dismiss(id: number) {
        this.toasts.update(toasts => toasts.filter(toast => toast.id !== id))
    }

    private show(kind: ToastKind, message: string, durationMs = 4000) {
        const id = this.nextId++
        this.toasts.update(toasts => [...toasts.slice(-3), { id, kind, message }])
        setTimeout(() => this.dismiss(id), durationMs)
    }
}
