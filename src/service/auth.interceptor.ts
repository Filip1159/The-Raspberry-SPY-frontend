import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http'
import { inject } from '@angular/core'
import { tap } from 'rxjs'
import { env } from './../environment'
import { AuthService } from './auth.service'
import { ToastService } from './toast.service'

const PUBLIC_PATHS = ['/login', '/health', '/greetings']

function needsToken(url: string, method: string): boolean {
    if (!url.startsWith(env.backendApiUrl)) return false
    const path = url.slice(env.backendApiUrl.length).split('?')[0]
    // GET /greetings lists the messages and needs a token, POST /greetings is open to visitors
    if (path === '/greetings') return method === 'GET'
    return !PUBLIC_PATHS.includes(path)
}

/** Adds the bearer token to protected calls and signs the user out when the backend rejects it */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    if (!needsToken(req.url, req.method)) {
        return next(req)
    }

    const auth = inject(AuthService)
    const toasts = inject(ToastService)
    const token = auth.token()
    const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req

    return next(authorized).pipe(
        tap({
            error: error => {
                if (error instanceof HttpErrorResponse && error.status === 401 && auth.token()) {
                    toasts.info('Your session has expired. Please sign in again.')
                    auth.logout()
                }
            },
        })
    )
}
