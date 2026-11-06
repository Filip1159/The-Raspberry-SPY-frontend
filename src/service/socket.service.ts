import { effect, inject, Injectable } from '@angular/core'
import { io, Socket } from 'socket.io-client'
import { Observable } from 'rxjs'
import { env } from './../environment'
import { AuthService } from './auth.service'
import { BackendStatusService } from './backend-status.service'

@Injectable({
    providedIn: 'root',
})
export class SocketService {
    private auth = inject(AuthService)
    private backendStatus = inject(BackendStatusService)

    // The backend requires a valid JWT in the handshake. The socket stays disconnected until the user is logged in
    private socket: Socket = io(env.websocketUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        upgrade: false,
        autoConnect: false,
        auth: callback => callback({ token: this.auth.token() }),
    })

    constructor() {
        this.socket.on('connect', () => this.backendStatus.markOnline())

        this.socket.on('connect_error', error => {
            if (error.message === 'unauthorized') {
                this.auth.logout()
            } else {
                this.backendStatus.checkIfOnline()
            }
        })

        // A deliberate disconnect (logout, server-side session expiry) says nothing about the backend being down
        this.socket.on('disconnect', reason => {
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
