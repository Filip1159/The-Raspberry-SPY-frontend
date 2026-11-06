import {} from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import { EMPTY } from 'rxjs'
import { routes } from './app.routes'
import { SocketService } from './service/socket.service'

/** A token that has not expired; the app only reads `exp` */
function validToken(): string {
    return `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=/g, '')}.s`
}

describe('routes', () => {
    let router: Router

    async function visit(url: string, signedIn: boolean): Promise<string> {
        if (signedIn) localStorage.setItem('jwt', validToken())
        TestBed.configureTestingModule({
            providers: [
                provideRouter(routes),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: SocketService, useValue: { connected: signal(false), emit: () => undefined, listen: () => EMPTY } },
            ],
        })
        router = TestBed.inject(Router)
        const harness = await RouterTestingHarness.create()
        await harness.navigateByUrl(url)
        return router.url
    }

    afterEach(() => localStorage.removeItem('jwt'))

    it('shows the portfolio at the root, to everybody', async () => {
        expect(await visit('/', false)).toBe('/')
    })

    it('keeps the signed-out visitor out of the control panel', async () => {
        for (const url of ['/app/video', '/app/alarm', '/app/stats', '/app']) {
            TestBed.resetTestingModule()
            expect(await visit(url, false), url).toBe('/login')
        }
    })

    it('lets the signed-in user in', async () => {
        expect(await visit('/app/alarm', true)).toBe('/app/alarm')
    })

    it('opens the live stream when /app is visited signed in', async () => {
        expect(await visit('/app', true)).toBe('/app/video')
    })

    it('redirects the URLs from before the portfolio existed', async () => {
        const redirects: [string, string][] = [
            ['/video', '/app/video'],
            ['/alarm', '/app/alarm'],
            ['/mobile-stats', '/app/stats'],
            ['/greetings', '/'],
        ]
        for (const [from, to] of redirects) {
            TestBed.resetTestingModule()
            expect(await visit(from, true), from).toBe(to)
        }
    })

    it('sends unknown URLs to the portfolio', async () => {
        expect(await visit('/no/such/page', false)).toBe('/')
    })

    it('keeps the private pages out of search engines', () => {
        const byPath = (path: string) => routes.find(route => route.path === path)!

        expect(byPath('login').data?.['noindex']).toBe(true)
        expect(byPath('app').data?.['noindex']).toBe(true)
        expect(byPath('').data?.['noindex']).toBeUndefined()
    })

    it('gives every page a title', () => {
        // the /app parent only provides the layout, its children are the pages
        const pages = routes.filter(route => (route.component || route.loadComponent) && !route.children)
        expect(pages.every(route => !!route.title)).toBe(true)
        expect(
            routes
                .find(route => route.path === 'app')!
                .children!.filter(child => child.loadComponent)
                .every(child => !!child.title)
        ).toBe(true)
    })
})
