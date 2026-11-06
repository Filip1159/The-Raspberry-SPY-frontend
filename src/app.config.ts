import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core'
import { provideRouter } from '@angular/router'

import { routes } from './app.routes'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { backendStatusInterceptor } from './service/backend-status.interceptor'
import { BackendStatusService } from './service/backend-status.service'

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideHttpClient(withInterceptors([backendStatusInterceptor])),
        provideAppInitializer(() => {
            inject(BackendStatusService).check()
        }),
    ],
}
