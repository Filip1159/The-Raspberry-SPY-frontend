import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { SeoService } from './seo.service'

@Component({ template: '' })
class DummyComponent {}

describe('SeoService', () => {
    let router: Router

    const robotsTag = () => document.head.querySelector('meta[name=robots]')?.getAttribute('content')

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([
                    { path: '', component: DummyComponent },
                    { path: 'login', component: DummyComponent, data: { noindex: true } },
                    { path: 'app', component: DummyComponent, data: { noindex: true }, children: [{ path: 'video', component: DummyComponent }] },
                ]),
            ],
        })
        TestBed.inject(SeoService).init()
        router = TestBed.inject(Router)
    })

    afterEach(() => document.head.querySelector('meta[name=robots]')?.remove())

    it('does not add a robots tag to indexable pages', async () => {
        await router.navigateByUrl('/')

        expect(robotsTag()).toBeUndefined()
    })

    it('marks routes with noindex data', async () => {
        await router.navigateByUrl('/login')

        expect(robotsTag()).toBe('noindex, nofollow')
    })

    it('inherits noindex from a parent route', async () => {
        await router.navigateByUrl('/app/video')

        expect(robotsTag()).toBe('noindex, nofollow')
    })

    it('removes the tag again when navigating to an indexable page', async () => {
        await router.navigateByUrl('/login')
        await router.navigateByUrl('/')

        expect(robotsTag()).toBeUndefined()
    })
})
