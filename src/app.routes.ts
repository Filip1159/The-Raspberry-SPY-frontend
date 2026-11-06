import { Routes } from '@angular/router'
import { Portfolio } from './components/portfolio/portfolio'
import { authGuard } from './service/auth.guard'
import { unsavedChangesGuard } from './service/unsaved-changes.guard'

export const routes: Routes = [
    { path: '', component: Portfolio, title: 'Filip Wiśniewski – Software Engineer' },
    {
        path: 'login',
        loadComponent: () => import('./components/login/login').then(m => m.Login),
        title: 'Sign in – The Raspberry SPY',
        data: { noindex: true },
    },
    {
        path: 'app',
        loadComponent: () => import('./components/shell/app-shell').then(m => m.AppShell),
        canActivate: [authGuard],
        data: { noindex: true },
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'video' },
            {
                path: 'video',
                title: 'Live stream – The Raspberry SPY',
                loadComponent: () => import('./components/video-stream/video-stream.component').then(m => m.VideoStreamComponent),
            },
            {
                path: 'alarm',
                title: 'Alarms – The Raspberry SPY',
                canDeactivate: [unsavedChangesGuard],
                loadComponent: () => import('./components/alarm-manager/alarm-manager.component').then(m => m.AlarmManagerComponent),
            },
            {
                path: 'stats',
                title: 'Stats – The Raspberry SPY',
                loadComponent: () => import('./components/stats/stats-page').then(m => m.StatsPage),
            },
        ],
    },
    // URLs from before the portfolio existed
    { path: 'video', redirectTo: 'app/video' },
    { path: 'alarm', redirectTo: 'app/alarm' },
    { path: 'mobile-stats', redirectTo: 'app/stats' },
    { path: 'greetings', redirectTo: '' },
    { path: '**', redirectTo: '' },
]
