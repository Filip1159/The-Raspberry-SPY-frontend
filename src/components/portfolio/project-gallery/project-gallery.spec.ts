import { ComponentFixture, TestBed } from '@angular/core/testing'
import { ProjectGallery } from './project-gallery'

describe('ProjectGallery', () => {
    let fixture: ComponentFixture<ProjectGallery>

    const element = () => fixture.nativeElement as HTMLElement
    const button = (label: string) => element().querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`)!

    function create(count: number) {
        fixture = TestBed.createComponent(ProjectGallery)
        fixture.componentRef.setInput('name', 'Demo')
        fixture.componentRef.setInput(
            'images',
            Array.from({ length: count }, (_, i) => ({ src: `img/${i}.webp`, alt: `Picture ${i + 1}` }))
        )
        fixture.detectChanges()
        // jsdom has no layout: give the strip a width and make scrollTo move it
        const track = element().querySelector<HTMLElement>('.gallery__track')!
        Object.defineProperty(track, 'clientWidth', { value: 300 })
        track.scrollTo = ((options: ScrollToOptions) => (track.scrollLeft = options.left ?? 0)) as typeof track.scrollTo
        return track
    }

    it('renders every image with its alt text', () => {
        create(3)
        const images = Array.from(element().querySelectorAll('img'))
        expect(images.map(i => i.alt)).toEqual(['Picture 1', 'Picture 2', 'Picture 3'])
    })

    it('has no controls for a single image', () => {
        create(1)
        expect(element().querySelectorAll('button').length).toBe(0)
    })

    it('slides with the arrows and wraps around', () => {
        const track = create(3)

        button('Next').click()
        expect(track.scrollLeft).toBe(300)
        button('Next').click()
        button('Next').click()
        expect(track.scrollLeft).toBe(0)
        button('Previous').click()
        expect(track.scrollLeft).toBe(600)
    })

    it('marks the dot of the visible image when the strip is swiped', () => {
        const track = create(3)

        track.scrollLeft = 600
        track.dispatchEvent(new Event('scroll'))
        fixture.detectChanges()

        const dots = Array.from(element().querySelectorAll('.gallery__dot'))
        expect(dots.map(d => d.getAttribute('aria-current'))).toEqual([null, null, 'true'])
    })

    it('jumps to an image from its dot', () => {
        const track = create(3)

        button('Show image 2').click()

        expect(track.scrollLeft).toBe(300)
    })
})
