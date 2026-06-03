import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core'
import { provideRouter } from '@angular/router'

import { routes } from './app.routes'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
    providers: [provideAnimationsAsync(), provideZonelessChangeDetection(), provideRouter(routes), provideHttpClient(withInterceptorsFromDi())],
}
