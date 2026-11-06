import { ComponentFixture, TestBed } from '@angular/core/testing'
import { ThemeService } from '../../service/theme.service'
import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle', () => {
    let fixture: ComponentFixture<ThemeToggle>

    const label = () => (fixture.nativeElement.querySelector('button') as HTMLButtonElement).getAttribute('aria-label')

    beforeEach(async () => {
        localStorage.removeItem('theme')
        delete document.documentElement.dataset['theme']
        await TestBed.configureTestingModule({ imports: [ThemeToggle] }).compileComponents()
        fixture = TestBed.createComponent(ThemeToggle)
        TestBed.inject(ThemeService).current.set('light')
        fixture.detectChanges()
    })

    afterEach(() => {
        localStorage.removeItem('theme')
        delete document.documentElement.dataset['theme']
    })

    it('tells where it leads and switches the theme when clicked', () => {
        expect(label()).toBe('Switch to the dark theme')
        ;(fixture.nativeElement.querySelector('button') as HTMLButtonElement).click()
        fixture.detectChanges()

        expect(document.documentElement.dataset['theme']).toBe('dark')
        expect(label()).toBe('Switch to the light theme')
    })
})
