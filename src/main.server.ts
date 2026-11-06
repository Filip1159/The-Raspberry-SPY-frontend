import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser'
import { config } from './app.config.server'
import { RootComponent } from './components/root/root.component'

const bootstrap = (context: BootstrapContext) => bootstrapApplication(RootComponent, config, context)

export default bootstrap
