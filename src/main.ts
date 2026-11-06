import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app.config'
import { Root } from './components/root/root'

bootstrapApplication(Root, appConfig).catch(err => console.error(err))
