import { TestBed } from '@angular/core/testing'
import { ToastService } from './toast.service'

describe('ToastService', () => {
    let service: ToastService

    beforeEach(() => {
        jasmine.clock().install()
        service = TestBed.inject(ToastService)
    })

    afterEach(() => jasmine.clock().uninstall())

    it('shows a message with its kind', () => {
        service.success('Saved')
        service.error('Failed')

        expect(service.toasts().map(t => [t.kind, t.message])).toEqual([
            ['success', 'Saved'],
            ['error', 'Failed'],
        ])
    })

    it('dismisses messages automatically, errors later than the rest', () => {
        service.info('Fyi')
        service.error('Oops')

        jasmine.clock().tick(4001)
        expect(service.toasts().map(t => t.message)).toEqual(['Oops'])

        jasmine.clock().tick(4000)
        expect(service.toasts()).toEqual([])
    })

    it('can be dismissed by hand', () => {
        service.warning('Careful')
        service.dismiss(service.toasts()[0].id)

        expect(service.toasts()).toEqual([])
    })

    it('keeps at most four messages', () => {
        for (let i = 0; i < 6; i++) service.info(`message ${i}`)

        expect(service.toasts().map(t => t.message)).toEqual(['message 2', 'message 3', 'message 4', 'message 5'])
    })
})
