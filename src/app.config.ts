import { isPlatformBrowser } from '@angular/common'
import { ApplicationConfig, inject, PLATFORM_ID, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core'
import { provideClientHydration, withEventReplay } from '@angular/platform-browser'
import { provideRouter } from '@angular/router'

import { routes } from './app.routes'
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http'
import { authInterceptor } from './service/auth.interceptor'
import { backendStatusInterceptor } from './service/backend-status.interceptor'
import { BackendStatusService } from './service/backend-status.service'
import { SeoService } from './service/seo.service'

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideClientHydration(withEventReplay()),
        provideHttpClient(withFetch(), withInterceptors([authInterceptor, backendStatusInterceptor])),
        provideAppInitializer(() => {
            inject(SeoService).init()
            // The pre-render at build time must not call the Raspberry, and the first paint must not wait for it
            if (isPlatformBrowser(inject(PLATFORM_ID))) {
                const backendStatus = inject(BackendStatusService)
                const check = () => backendStatus.check()
                if ('requestIdleCallback' in window) {
                    window.requestIdleCallback(check, { timeout: 3000 })
                } else {
                    setTimeout(check, 1000)
                }
            }
        }),
    ],
}
