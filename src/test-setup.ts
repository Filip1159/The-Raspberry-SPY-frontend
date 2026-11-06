// jsdom has no matchMedia; ThemeService reads the system colour scheme through it
if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
        }) as MediaQueryList
}

// `@defer (on viewport)` needs IntersectionObserver; report every element as visible so deferred content renders in specs
if (!('IntersectionObserver' in window)) {
    class VisibleObserver {
        constructor(private callback: IntersectionObserverCallback) {}
        observe(target: Element) {
            this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
        }
        unobserve = () => undefined
        disconnect = () => undefined
        takeRecords() {
            return []
        }
    }
    window.IntersectionObserver = VisibleObserver as unknown as typeof IntersectionObserver
}
