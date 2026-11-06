import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from './auth.service'

export const authGuard = async () => {
    const auth = inject(AuthService)
    const router = inject(Router)

    // An access token that expired while the tab was closed: the refresh cookie may still sign the user in quietly
    if (!auth.isLoggedIn() && auth.hasStaleSession()) {
        await auth.restoreSession()
    }

    if (!auth.isLoggedIn()) {
        router.navigate(['/login'])
        return false
    }
    return true
}
