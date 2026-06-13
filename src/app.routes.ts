import { Routes } from '@angular/router'
import { Login } from './components/login/login'
import { authGuard } from './service/auth.guard'
import { AlarmManagerComponent } from './components/alarm-manager/alarm-manager.component'
import { GreetingsComponent } from './components/greetings/greetings.component'
import { VideoStreamComponent } from './components/video-stream/video-stream.component'
import { AboutMe } from './components/about-me/about-me.component'
import { MobileStats } from './components/stats/mobile/mobile-stats'

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: 'video', component: VideoStreamComponent, canActivate: [authGuard] },
    { path: 'alarm', component: AlarmManagerComponent, canActivate: [authGuard] },
    { path: 'greetings', component: GreetingsComponent },
    { path: 'mobile-stats', component: MobileStats, canActivate: [authGuard] },
    { path: '', component: AboutMe },
]
