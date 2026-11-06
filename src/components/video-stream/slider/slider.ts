import { Component, Input, Output, EventEmitter } from '@angular/core'

let nextId = 0

@Component({
    selector: 'slider',
    standalone: true,
    templateUrl: './slider.html',
    styleUrls: ['./slider.scss'],
})
export class Slider {
    @Input() value = 0
    @Input({ required: true }) label!: string
    @Input() disabled = false

    @Output() valueChange = new EventEmitter<number>()

    readonly id = `slider-${nextId++}`

    get percent(): number {
        return Math.round((this.value / 255) * 100)
    }

    onInput(event: Event): void {
        const newValue = Number((event.target as HTMLInputElement).value)
        this.value = newValue
        this.valueChange.emit(newValue)
    }
}
