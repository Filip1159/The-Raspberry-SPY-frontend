import {} from 'vitest'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { AuthService } from '../../service/auth.service'
import { BackendStatusService } from '../../service/backend-status.service'
import { Portfolio } from './portfolio'
import { PROFILE_STATS } from './profile-stats'
import { PROJECTS, SKILL_GROUPS } from './portfolio.data'

describe('Portfolio', () => {
    let fixture: ComponentFixture<Portfolio>

    const element = () => fixture.nativeElement as HTMLElement

    function create(loggedIn: boolean) {
        TestBed.configureTestingModule({
            imports: [Portfolio],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
            ],
        })
        fixture = TestBed.createComponent(Portfolio)
        fixture.detectChanges()
    }

    it('has exactly one h1 and the main sections', () => {
        create(false)

        expect(element().querySelectorAll('h1').length).toBe(1)
        expect(Array.from(element().querySelectorAll('section[id]')).map(s => s.id)).toEqual([
            'about',
            'skills',
            'projects',
            'beyond-code',
            'location',
            'contact',
        ])
    })

    it('renders every project and skill from the data file', () => {
        create(false)

        expect(element().querySelectorAll('.project').length).toBe(PROJECTS.length)
        const chips = SKILL_GROUPS.reduce((count, group) => count + group.skills.length, 0)
        expect(element().querySelectorAll('#skills .chip').length).toBe(chips)
    })

    it('opens external links safely', () => {
        create(false)

        const external = Array.from(element().querySelectorAll<HTMLAnchorElement>('a[target=_blank]'))
        expect(external.length).toBeGreaterThan(5)
        expect(external.every(link => link.rel.includes('noopener'))).toBe(true)
    })

    it('shows the chess.com rating and the Duolingo streak on their cards', () => {
        create(false)

        const card = (name: string) => element().querySelector<HTMLElement>(`.contact__link[aria-label^="${name}"]`)!
        expect(card('Chess.com').textContent).toContain(`Rapid ${PROFILE_STATS.chessRapidRating}`)
        expect(card('Duolingo').textContent).toContain(`${PROFILE_STATS.duolingoStreak} day streak`)
    })

    it('offers to sign in to visitors', async () => {
        create(false)
        await fixture.whenStable()
        fixture.detectChanges()

        expect(element().querySelector('.nav__actions .button')!.textContent).toContain('Sign in')
    })

    it('links signed-in visitors to the control panel once the page is interactive', async () => {
        create(true)
        await fixture.whenStable()
        fixture.detectChanges()

        const button = element().querySelector('.nav__actions .button') as HTMLAnchorElement
        expect(button.textContent).toContain('Control panel')
        expect(button.getAttribute('href')).toBe('/app/video')
    })

    it('shows whether the Raspberry is online', () => {
        create(false)
        const status = TestBed.inject(BackendStatusService)
        const badge = () => element().querySelector('.status')!.textContent!.trim()

        expect(badge()).toContain('Checking')

        status.markOnline()
        fixture.detectChanges()
        expect(badge()).toContain('online')

        status.markOffline()
        fixture.detectChanges()
        expect(badge()).toContain('switched off')
    })
})
