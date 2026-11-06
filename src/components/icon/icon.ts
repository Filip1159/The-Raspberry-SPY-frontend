import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import type { IconDefinition } from '@fortawesome/fontawesome-common-types'

/**
 * Renders a FontAwesome icon definition as an inline SVG without the FontAwesome runtime (~85 kB of JavaScript).
 * Used on the public pages so that the first load stays small; the signed-in area keeps using `<fa-icon>`.
 * Decorative: give the surrounding button or link an accessible name.
 */
@Component({
    selector: 'app-icon',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="currentColor" [attr.viewBox]="viewBox()">
        @for (path of paths(); track $index) {
            <path [attr.d]="path" />
        }
    </svg>`,
    styles: `
        :host {
            display: inline-block;
            height: 1em;
            vertical-align: -0.125em;
            line-height: 1;
        }

        svg {
            height: 100%;
            width: auto;
            display: block;
        }
    `,
})
export class Icon {
    readonly icon = input.required<IconDefinition>()

    protected readonly viewBox = computed(() => `0 0 ${this.icon().icon[0]} ${this.icon().icon[1]}`)
    protected readonly paths = computed(() => [this.icon().icon[4]].flat())
}
