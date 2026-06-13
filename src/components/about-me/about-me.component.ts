import { AfterViewInit, Component, OnDestroy } from '@angular/core'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faChess, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { faDuolingo, faGithub, faLinkedinIn } from '@fortawesome/free-brands-svg-icons'

@Component({
    selector: 'about-me',
    imports: [FontAwesomeModule],
    templateUrl: './about-me.component.html',
    styleUrl: './about-me.component.scss',
})
export class AboutMe implements AfterViewInit, OnDestroy {
    faChess = faChess
    faUpRightFromSquare = faUpRightFromSquare
    faDuolingo = faDuolingo
    faGithub = faGithub
    faLinkedinIn = faLinkedinIn

    private paragraphObserver: IntersectionObserver | null = null
    private staggerDelay = 0
    private paragraphElements: Element[] = []

    ngAfterViewInit(): void {
        const paragraphs = document.querySelectorAll('.slideFromLeft')
        this.paragraphElements = Array.from(paragraphs)

        this.paragraphObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (!entry.target.classList.contains('visible')) {
                            this.staggerDelay += 100
                            entry.target.classList.add('visible')
                            ;(entry.target as HTMLElement).style.animationDelay = `${this.staggerDelay}ms`
                        }
                    } else {
                        entry.target.classList.remove('visible')
                        ;(entry.target as HTMLElement).style.animationDelay = `0ms`
                        this.staggerDelay = 0
                    }
                })
            },
            {
                threshold: 0.1,
            }
        )

        this.paragraphElements.forEach(el => {
            this.paragraphObserver?.observe(el)
        })

        this.paragraphElements.forEach(el => {
            const rect = el.getBoundingClientRect()
            const viewportTop = window.scrollY + window.innerHeight
            const viewportBottom = window.scrollY
            const elementCenter = rect.top + rect.height / 2

            if (elementCenter >= viewportBottom && elementCenter <= viewportTop) {
                this.staggerDelay += 100
                el.classList.add('visible')
                ;(el as HTMLElement).style.animationDelay = `${this.staggerDelay}ms`
            }
        })
    }

    ngOnDestroy(): void {
        this.paragraphObserver?.disconnect()
    }
}
