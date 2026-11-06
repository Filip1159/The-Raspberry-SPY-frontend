import { isPlatformBrowser } from '@angular/common'
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

/**
 * Light/dark theme. Without a choice the colors follow the operating system (CSS `prefers-color-scheme`);
 * the toggle stores an explicit choice and sets data-theme on <html>. The inline script in index.html applies the
 * stored choice before the first paint.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
    private isBrowser = isPlatformBrowser(inject(PLATFORM_ID))

    // Starts as 'light' on the server and during hydration, `sync()` resolves the real value afterwards
    readonly current = signal<Theme>('light')

    sync() {
        if (!this.isBrowser) return
        const explicit = document.documentElement.dataset['theme']
        this.current.set(
            explicit === 'dark' || explicit === 'light' ? explicit : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        )
    }

    toggle() {
        const next: Theme = this.current() === 'dark' ? 'light' : 'dark'
        this.current.set(next)
        document.documentElement.dataset['theme'] = next
        try {
            localStorage.setItem(STORAGE_KEY, next)
        } catch {
            // private mode or blocked storage: the choice just won't be remembered
        }
    }
}
