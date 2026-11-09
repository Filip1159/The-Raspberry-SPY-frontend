import { ChangeDetectionStrategy, Component, ElementRef, input, signal, viewChild } from '@angular/core'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '../../icon/icon'
import { ProjectImage } from '../portfolio.data'

// Swipeable strip (CSS scroll snap) with arrow buttons. Works as plain scrolling before hydration; the buttons only move the strip.
@Component({
    selector: 'project-gallery',
    standalone: true,
    imports: [Icon],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './project-gallery.html',
    styleUrl: './project-gallery.scss',
})
export class ProjectGallery {
    readonly images = input.required<ProjectImage[]>()
    readonly name = input.required<string>()

    readonly current = signal(0)
    readonly faChevronLeft = faChevronLeft
    readonly faChevronRight = faChevronRight

    private track = viewChild.required<ElementRef<HTMLElement>>('track')

    onScroll() {
        const track = this.track().nativeElement
        this.current.set(Math.round(track.scrollLeft / track.clientWidth))
    }

    step(direction: 1 | -1) {
        const count = this.images().length
        this.show((this.current() + direction + count) % count)
    }

    show(index: number) {
        const track = this.track().nativeElement
        track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
        this.current.set(index)
    }
}
