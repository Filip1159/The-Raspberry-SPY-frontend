import { Component, ViewEncapsulation, AfterViewInit, OnDestroy } from '@angular/core'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faChess, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { faDuolingo, faGithub, faLinkedinIn } from '@fortawesome/free-brands-svg-icons'

@Component({
    selector: 'about-me',
    imports: [FontAwesomeModule],
    templateUrl: './about-me.component.html',
    styleUrl: './about-me.component.scss',
    encapsulation: ViewEncapsulation.None,
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
        // Zbieramy wszystkie elementy tekstu do animacji
        const paragraphs = document.querySelectorAll('.aboutMe__content__paragraph,.aboutMe__content__title')
        this.paragraphElements = Array.from(paragraphs)

        // Stworzenie obserwatora
        this.paragraphObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Element jest w viewport, uruchom animację
                        if (!entry.target.classList.contains('visible')) {
                            this.staggerDelay += 100
                            entry.target.classList.add('visible')
                            ;(entry.target as HTMLElement).style.animationDelay = `${this.staggerDelay}ms`
                        }
                    } else {
                        // Usuwanie klasy przy przewijaniu w górę, aby powtórzyć animację
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

        // Obsługujemy każdy element tekstu
        this.paragraphElements.forEach(el => {
            this.paragraphObserver?.observe(el)
        })

        // Sprawdź elementy, które są już widoczne podczas ładowania strony
        this.paragraphElements.forEach(el => {
            const rect = el.getBoundingClientRect()
            const viewportTop = window.scrollY + window.innerHeight
            const viewportBottom = window.scrollY
            const elementCenter = rect.top + rect.height / 2

            // Jeśli element jest w viewport (centrum elementu w zakresie viewportu)
            if (elementCenter >= viewportBottom && elementCenter <= viewportTop) {
                // Element jest w viewport - uruchom animację z opóźnieniem
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
