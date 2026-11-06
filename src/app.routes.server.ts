import { RenderMode, ServerRoute } from '@angular/ssr'

// Only the public portfolio is pre-rendered; the login and the signed-in area are client-side only
export const serverRoutes: ServerRoute[] = [
    { path: '', renderMode: RenderMode.Prerender },
    { path: '**', renderMode: RenderMode.Client },
]
