import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser'
import { config } from './app.config.server'
import { Root } from './components/root/root'

const bootstrap = (context: BootstrapContext) => bootstrapApplication(Root, config, context)

export default bootstrap
