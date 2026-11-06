import { TestBed } from '@angular/core/testing'
import { ThemeService } from './theme.service'

describe('ThemeService', () => {
    let service: ThemeService

    beforeEach(() => {
        localStorage.removeItem('theme')
        delete document.documentElement.dataset['theme']
        service = TestBed.inject(ThemeService)
    })

    afterEach(() => {
        localStorage.removeItem('theme')
        delete document.documentElement.dataset['theme']
    })

    it('reads an explicit choice from the document', () => {
        document.documentElement.dataset['theme'] = 'dark'

        service.sync()

        expect(service.current()).toBe('dark')
    })

    it('toggles, applies the theme to the page and remembers it', () => {
        service.current.set('light')

        service.toggle()
        expect(service.current()).toBe('dark')
        expect(document.documentElement.dataset['theme']).toBe('dark')
        expect(localStorage.getItem('theme')).toBe('dark')

        service.toggle()
        expect(service.current()).toBe('light')
        expect(localStorage.getItem('theme')).toBe('light')
    })
})
