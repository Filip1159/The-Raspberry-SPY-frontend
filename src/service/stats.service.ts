import { inject, Injectable, signal } from '@angular/core'
import { catchError, EMPTY } from 'rxjs'
import { RaspberryApi, StatsSample } from './raspberry.api'
import { SocketService } from './socket.service'

interface BleUpdatePayload {
    humidity: number | null
    temperature: number | null
    voltage: number | null
    lastUpdated: string | null
}

interface SystemStatsUpdatePayload {
    cpuUsage: number
    cpuTemperature: number
    ramUsage: number
}

const HISTORY_LENGTH = 60

function push(history: number[], value: number | null): number[] {
    return value === null ? history : [...history, value].slice(-HISTORY_LENGTH)
}

/**
 * Live values pushed by the Raspberry every few seconds, plus a short in-memory history for the sparklines.
 * Created when the signed-in area opens, so the history keeps growing while the user switches between tabs.
 */
@Injectable({ providedIn: 'root' })
export class StatsService {
    private socket = inject(SocketService)
    private api = inject(RaspberryApi)

    readonly cpuUsage = signal<number | null>(null)
    readonly cpuTemperature = signal<number | null>(null)
    readonly ramUsage = signal<number | null>(null)
    /** Epoch milliseconds of the last system stats message */
    readonly systemUpdatedAt = signal<number | null>(null)

    readonly humidity = signal<number | null>(null)
    readonly temperature = signal<number | null>(null)
    readonly voltage = signal<number | null>(null)
    /** Time of day (HH:MM:SS) of the last reading of the BLE sensor, as reported by the Raspberry */
    readonly climateLastReading = signal<string | null>(null)

    readonly cpuHistory = signal<number[]>([])
    readonly cpuTemperatureHistory = signal<number[]>([])
    readonly ramHistory = signal<number[]>([])
    readonly temperatureHistory = signal<number[]>([])
    readonly humidityHistory = signal<number[]>([])

    constructor() {
        this.loadHistory()

        this.socket.listen<SystemStatsUpdatePayload>('system_stats_update').subscribe(payload => {
            this.cpuUsage.set(payload.cpuUsage)
            this.cpuTemperature.set(payload.cpuTemperature)
            this.ramUsage.set(payload.ramUsage)
            this.systemUpdatedAt.set(Date.now())
            this.cpuHistory.update(history => push(history, payload.cpuUsage))
            this.cpuTemperatureHistory.update(history => push(history, payload.cpuTemperature))
            this.ramHistory.update(history => push(history, payload.ramUsage))
        })

        this.socket.listen<BleUpdatePayload>('ble_update').subscribe(payload => {
            this.humidity.set(payload.humidity)
            this.temperature.set(payload.temperature)
            this.voltage.set(payload.voltage)
            this.climateLastReading.set(payload.lastUpdated)
            this.temperatureHistory.update(history => push(history, payload.temperature))
            this.humidityHistory.update(history => push(history, payload.humidity))
        })
    }

    /** Fetches what the Raspberry remembers; without it (offline, older backend) the charts simply start empty */
    private loadHistory(): void {
        this.api
            .getStatsHistory()
            .pipe(catchError(() => EMPTY))
            .subscribe(samples => {
                const series = (pick: (sample: StatsSample) => number | null) => samples.map(pick).filter((value): value is number => value !== null)
                this.cpuHistory.update(current =>
                    withEarlier(
                        series(sample => sample.cpuUsage),
                        current
                    )
                )
                this.cpuTemperatureHistory.update(current =>
                    withEarlier(
                        series(sample => sample.cpuTemperature),
                        current
                    )
                )
                this.ramHistory.update(current =>
                    withEarlier(
                        series(sample => sample.ramUsage),
                        current
                    )
                )
                this.temperatureHistory.update(current =>
                    withEarlier(
                        series(sample => sample.temperature),
                        current
                    )
                )
                this.humidityHistory.update(current =>
                    withEarlier(
                        series(sample => sample.humidity),
                        current
                    )
                )
            })
    }
}

/** Samples of the same series from before this page was opened go in front of what arrived live meanwhile */
function withEarlier(earlier: number[], current: number[]): number[] {
    return [...earlier, ...current].slice(-HISTORY_LENGTH)
}

/** Seconds since a HH:MM:SS time of day (today, or yesterday when the time is "in the future") */
export function secondsSinceTimeOfDay(timeOfDay: string, now = new Date()): number | null {
    const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(timeOfDay)
    if (!match) return null

    const then = new Date(now)
    then.setHours(Number(match[1]), Number(match[2]), Number(match[3]), 0)
    let seconds = Math.round((now.getTime() - then.getTime()) / 1000)
    if (seconds < -60) seconds += 24 * 60 * 60
    return Math.max(0, seconds)
}
