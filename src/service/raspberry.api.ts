import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { env } from './../environment'

interface LoginResponse {
    access_token: string
}

export interface Alarm {
    day: string
    hour: number
    minute: number
    melody: string
    enabled: boolean
}

@Injectable({ providedIn: 'root' })
export class RaspberryApi {
    http = inject(HttpClient)

    login(username: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${env.backendApiUrl}/login`, { username, password })
    }

    getAlarms(token: string): Observable<Alarm[]> {
        return this.http.get<Alarm[]>(`${env.backendApiUrl}/alarms`, { headers: { Authorization: `Bearer ${token}` } })
    }

    saveAlarms(token: string, alarms: Alarm[]): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/alarms`, JSON.stringify(alarms), {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
    }

    playMelody(token: string, melody: string): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/alarms/play`, JSON.stringify({ melody }), {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
    }

    sendGreeting(text: string): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/greetings`, JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } })
    }
}
