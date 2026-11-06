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

export interface StatsSample {
    cpuUsage: number
    cpuTemperature: number
    ramUsage: number
    /** null while the BLE sensor is silent */
    humidity: number | null
    temperature: number | null
    /** Epoch seconds */
    timestamp: number
}

@Injectable({ providedIn: 'root' })
export class RaspberryApi {
    http = inject(HttpClient)

    login(username: string, password: string): Observable<LoginResponse> {
        // withCredentials: the answer sets the httpOnly refresh cookie of the API host
        return this.http.post<LoginResponse>(`${env.backendApiUrl}/login`, { username, password }, { withCredentials: true })
    }

    /** Trades the refresh cookie for a new access token (and a new cookie) */
    refresh(): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${env.backendApiUrl}/refresh`, {}, { withCredentials: true })
    }

    /** Revokes the refresh cookie on the server */
    logout(): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/logout`, {}, { withCredentials: true })
    }

    getAlarms(): Observable<Alarm[]> {
        return this.http.get<Alarm[]>(`${env.backendApiUrl}/alarms`)
    }

    saveAlarms(alarms: Alarm[]): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/alarms`, JSON.stringify(alarms), {
            headers: { 'Content-Type': 'application/json' },
        })
    }

    playMelody(melody: string): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/alarms/play`, JSON.stringify({ melody }), {
            headers: { 'Content-Type': 'application/json' },
        })
    }

    /** The latest stats samples (oldest first), so the charts survive a page reload */
    getStatsHistory(): Observable<StatsSample[]> {
        return this.http.get<StatsSample[]>(`${env.backendApiUrl}/stats/history`)
    }

    sendGreeting(text: string): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/greetings`, JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } })
    }
}
