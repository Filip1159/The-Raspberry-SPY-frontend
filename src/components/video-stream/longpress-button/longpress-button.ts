import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core'

/** A button that keeps emitting `press` while it is held down (mouse, touch or pen), or once per Enter/Space */
@Component({
    selector: 'longpress-button',
    templateUrl: './longpress-button.html',
    styleUrl: './longpress-button.scss',
})
export class LongPressButton implements OnDestroy {
    @Input() intervalMs = 200
    @Input({ required: true }) label!: string
    @Input() disabled = false

    @Output() press = new EventEmitter<void>()

    private timer: ReturnType<typeof setInterval> | null = null

    onPressStart(event: PointerEvent): void {
        if (this.disabled || this.timer) return // keep receiving the pointer events when the finger or the mouse slides off the button
        ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
        this.press.emit()
        this.timer = setInterval(() => this.press.emit(), this.intervalMs)
    }

    onPressEnd(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    // Keyboard users: Enter or Space presses once (key repeat of the OS handles holding it down)
    onKeyDown(event: KeyboardEvent): void {
        if (this.disabled || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        this.press.emit()
    }

    ngOnDestroy(): void {
        this.onPressEnd()
    }
}
