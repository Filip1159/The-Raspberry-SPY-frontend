import { effect, inject, Injectable, InjectionToken, signal } from '@angular/core'
import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client'
import { Observable } from 'rxjs'
import { env } from './../environment'
import { AuthService } from './auth.service'
import { BackendStatusService } from './backend-status.service'

/** Creates the socket; replaced in tests so that no real connection is opened */
export const SOCKET_FACTORY = new InjectionToken<(url: string, options: Partial<ManagerOptions & SocketOptions>) => Socket>('SOCKET_FACTORY', {
    providedIn: 'root',
    factory: () => io,
})

@Injectable({
    providedIn: 'root',
})
export class SocketService {
    private auth = inject(AuthService)
    private backendStatus = inject(BackendStatusService)

    // The backend requires a valid JWT in the handshake. The socket stays disconnected until the user is logged in
    private socket: Socket = inject(SOCKET_FACTORY)(env.websocketUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        upgrade: false,
        autoConnect: false,
        auth: callback => callback({ token: this.auth.token() }),
    })

    /** True while the websocket to the Raspberry is open */
    readonly connected = signal(false)

    constructor() {
        this.socket.on('connect', () => {
            this.connected.set(true)
            this.backendStatus.markOnline()
        })

        this.socket.on('connect_error', error => {
            this.connected.set(false)
            if (error.message === 'unauthorized') {
                this.auth.logout()
            } else {
                this.backendStatus.checkIfOnline()
            }
        })

        // A deliberate disconnect (logout, server-side session expiry) says nothing about the backend being down
        this.socket.on('disconnect', reason => {
            this.connected.set(false)
            if (reason === 'transport close' || reason === 'transport error' || reason === 'ping timeout') {
                this.backendStatus.checkIfOnline()
            }
        })

        effect(() => {
            if (this.auth.token()) {
                this.socket.connect()
            } else {
                this.socket.disconnect()
            }
        })
    }

    listen<T>(eventName: string): Observable<T> {
        return new Observable(subscriber => {
            const handler = (data: T) => subscriber.next(data)
            this.socket.on(eventName, handler)
            return () => this.socket.off(eventName, handler)
        })
    }

    emit(eventName: string, data: string) {
        if (!this.socket.connected) return
        this.socket.emit(eventName, data)
    }
}
