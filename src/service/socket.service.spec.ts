import { Mock, vi } from 'vitest'
import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { AuthService } from './auth.service'
import { BackendStatusService } from './backend-status.service'
import { SOCKET_FACTORY, SocketService } from './socket.service'

class FakeSocket {
    connected = false
    handlers = new Map<string, ((...args: unknown[]) => void)[]>()
    connect = vi.fn(() => (this.connected = true))
    disconnect = vi.fn(() => (this.connected = false))
    emit = vi.fn()

    on(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    }
    off(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(
            event,
            (this.handlers.get(event) ?? []).filter(h => h !== handler)
        )
    }
    trigger(event: string, ...args: unknown[]) {
        this.handlers.get(event)?.forEach(h => h(...args))
    }
}

describe('SocketService', () => {
    let socket: FakeSocket
    let options: Record<string, unknown>
    let token: ReturnType<typeof signal<string | null>>
    let auth: { token: typeof token; logout: Mock }
    let status: { markOnline: Mock; checkIfOnline: Mock }

    function create() {
        const service = TestBed.inject(SocketService)
        TestBed.tick()
        return service
    }

    beforeEach(() => {
        socket = new FakeSocket()
        token = signal<string | null>(null)
        auth = { token, logout: vi.fn() }
        status = { markOnline: vi.fn(), checkIfOnline: vi.fn() }
        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: auth },
                { provide: BackendStatusService, useValue: status },
                {
                    provide: SOCKET_FACTORY,
                    useValue: (_url: string, opts: Record<string, unknown>) => {
                        options = opts
                        return socket
                    },
                },
            ],
        })
    })

    it('stays disconnected until there is a token, and follows it', () => {
        create()
        expect(socket.connect).not.toHaveBeenCalled()
        expect(options['autoConnect']).toBe(false)

        token.set('abc')
        TestBed.tick()
        expect(socket.connect).toHaveBeenCalled()

        token.set(null)
        TestBed.tick()
        expect(socket.disconnect).toHaveBeenCalled()
    })

    it('reconnects with the new token when the token is renewed', () => {
        create()
        token.set('first')
        TestBed.tick()
        socket.disconnect.mockClear()
        socket.connect.mockClear()

        token.set('renewed')
        TestBed.tick()

        expect(socket.disconnect).toHaveBeenCalled()
        expect(socket.connect).toHaveBeenCalled()
    })

    it('hands the current token to the handshake', () => {
        create()
        token.set('fresh')
        let sent: unknown
        ;(options['auth'] as (cb: (data: unknown) => void) => void)((data: unknown) => (sent = data))
        expect(sent).toEqual({ token: 'fresh' })
    })

    it('tracks the connection and tells the status service', () => {
        const service = create()
        socket.trigger('connect')
        expect(service.connected()).toBe(true)
        expect(status.markOnline).toHaveBeenCalled()

        socket.trigger('disconnect', 'io client disconnect')
        expect(service.connected()).toBe(false)
        expect(status.checkIfOnline).not.toHaveBeenCalled()
    })

    it('probes the backend when the transport dies', () => {
        create()
        socket.trigger('disconnect', 'transport close')
        expect(status.checkIfOnline).toHaveBeenCalled()
    })

    it('signs out when the server refuses the token', () => {
        create()
        socket.trigger('connect_error', new Error('unauthorized'))
        expect(auth.logout).toHaveBeenCalled()
        expect(status.checkIfOnline).not.toHaveBeenCalled()
    })

    it('checks the backend on other connection errors', () => {
        const service = create()
        socket.trigger('connect')
        socket.trigger('connect_error', new Error('xhr poll error'))
        expect(service.connected()).toBe(false)
        expect(status.checkIfOnline).toHaveBeenCalled()
        expect(auth.logout).not.toHaveBeenCalled()
    })

    it('listens to an event only while subscribed', () => {
        const service = create()
        const received: number[] = []
        const subscription = service.listen<number>('ble_update').subscribe(v => received.push(v))
        socket.trigger('ble_update', 1)
        subscription.unsubscribe()
        socket.trigger('ble_update', 2)
        expect(received).toEqual([1])
    })

    it('emits only while connected', () => {
        const service = create()
        service.emit('message', 'UP')
        expect(socket.emit).not.toHaveBeenCalled()

        socket.connected = true
        service.emit('message', 'UP')
        expect(socket.emit).toHaveBeenCalledWith('message', 'UP')
    })
})
