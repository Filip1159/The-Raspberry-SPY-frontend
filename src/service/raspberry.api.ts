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

/** The parameters of the camera stream; the Raspberry restarts the stream for a few seconds when they change */
export interface CameraSettings {
    /** `<width>x<height>` */
    resolution: string
    fps: number
    /** kbit/s */
    bitrate: number
    hFlip: boolean
    vFlip: boolean
    brightness: number
    contrast: number
    saturation: number
    sharpness: number
    exposure: string
    awb: string
}

export interface CameraSettingsResponse {
    settings: CameraSettings
    defaults: CameraSettings
    /** false while the camera service did not take the settings yet (the Raspberry keeps retrying) */
    applied: boolean
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

    getCameraSettings(): Observable<CameraSettingsResponse> {
        return this.http.get<CameraSettingsResponse>(`${env.backendApiUrl}/camera/settings`)
    }

    saveCameraSettings(settings: CameraSettings): Observable<CameraSettingsResponse> {
        return this.http.put<CameraSettingsResponse>(`${env.backendApiUrl}/camera/settings`, settings)
    }

    sendGreeting(text: string): Observable<void> {
        return this.http.post<void>(`${env.backendApiUrl}/greetings`, JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } })
    }
}
