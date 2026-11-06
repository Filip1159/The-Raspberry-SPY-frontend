import { inject, Injectable } from '@angular/core'
import { Meta } from '@angular/platform-browser'
import { NavigationEnd, Router } from '@angular/router'
import { filter } from 'rxjs'

/** Keeps crawlers away from pages that are not meant to be indexed: routes marked with `data: { noindex: true }` */
@Injectable({ providedIn: 'root' })
export class SeoService {
    private router = inject(Router)
    private meta = inject(Meta)

    init() {
        this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.updateRobotsTag())
    }

    private updateRobotsTag() {
        let route: typeof this.router.routerState.snapshot.root | null = this.router.routerState.snapshot.root
        let noindex = false
        while (route) {
            noindex ||= route.data['noindex'] === true
            route = route.firstChild
        }

        if (noindex) {
            this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' })
        } else {
            this.meta.removeTag("name='robots'")
        }
    }
}
