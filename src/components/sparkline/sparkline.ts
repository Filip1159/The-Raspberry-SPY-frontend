import { Component, computed, input } from '@angular/core'

const WIDTH = 120
const HEIGHT = 36
const PADDING = 3

/** Tiny line chart of the recent values of a metric */
@Component({
    selector: 'sparkline',
    standalone: true,
    template: `
        <svg class="sparkline" [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" role="img" [attr.aria-label]="description()">
            @if (points()) {
                <polyline
                    [attr.points]="points()"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    vector-effect="non-scaling-stroke" />
            }
        </svg>
    `,
    styles: `
        .sparkline {
            display: block;
            width: 100%;
            height: 40px;
            color: var(--accent);
        }
    `,
})
export class Sparkline {
    values = input.required<number[]>()
    /** What the values are, for screen readers, e.g. "CPU usage in percent" */
    label = input.required<string>()

    readonly width = WIDTH
    readonly height = HEIGHT

    points = computed(() => {
        const values = this.values()
        if (values.length < 2) return ''

        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min || 1
        return values
            .map((value, index) => {
                const x = (index / (values.length - 1)) * WIDTH
                const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2)
                return `${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(' ')
    })

    description = computed(() => {
        const values = this.values()
        if (values.length === 0) return `${this.label()}: no data yet`
        return `${this.label()}: latest ${values[values.length - 1]}, minimum ${Math.min(...values)}, maximum ${Math.max(...values)} over the last ${values.length} updates`
    })
}
