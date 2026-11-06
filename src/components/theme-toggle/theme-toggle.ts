import { afterNextRender, Component, inject } from '@angular/core'
import { Icon } from '../icon/icon'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { ThemeService } from '../../service/theme.service'

@Component({
    selector: 'theme-toggle',
    standalone: true,
    imports: [Icon],
    template: `
        <button
            class="toggle"
            type="button"
            (click)="theme.toggle()"
            [attr.aria-label]="theme.current() === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'">
            <app-icon [icon]="theme.current() === 'dark' ? faSun : faMoon" />
        </button>
    `,
    styles: `
        .toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            font-size: 18px;
            color: inherit;
            background: transparent;
            border: 2px solid currentColor;
            border-radius: 50%;
            cursor: pointer;
            opacity: 0.85;

            &:hover {
                opacity: 1;
            }
        }
    `,
})
export class ThemeToggle {
    theme = inject(ThemeService)

    faMoon = faMoon
    faSun = faSun

    constructor() {
        afterNextRender(() => this.theme.sync())
    }
}
