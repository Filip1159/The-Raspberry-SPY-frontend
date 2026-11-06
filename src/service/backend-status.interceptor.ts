import { HttpInterceptorFn, HttpResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { tap } from 'rxjs'
import { env } from './../environment'
import { BackendStatusService, isBackendUnreachable } from './backend-status.service'

export const backendStatusInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.startsWith(env.backendApiUrl)) {
        return next(req)
    }

    const backendStatus = inject(BackendStatusService)

    return next(req).pipe(
        tap({
            next: event => {
                if (event instanceof HttpResponse) {
                    backendStatus.markOnline()
                }
            },
            error: error => {
                if (isBackendUnreachable(error)) {
                    backendStatus.markOffline()
                }
            },
        })
    )
}
