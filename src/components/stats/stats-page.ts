import { isPlatformBrowser } from '@angular/common'
import { Component, computed, inject, OnDestroy, PLATFORM_ID, signal } from '@angular/core'
import { SocketService } from '../../service/socket.service'
import { secondsSinceTimeOfDay, StatsService } from '../../service/stats.service'
import { Sparkline } from '../sparkline/sparkline'

const STALE_AFTER_SECONDS = 20
const SENSOR_STALE_AFTER_SECONDS = 120

type Level = 'ok' | 'warm' | 'hot'

@Component({
    selector: 'stats-page',
    standalone: true,
    imports: [Sparkline],
    templateUrl: './stats-page.html',
    styleUrl: './stats-page.scss',
})
export class StatsPage implements OnDestroy {
    stats = inject(StatsService)
    private socket = inject(SocketService)

    connected = this.socket.connected
    private now = signal(Date.now())
    private timer = isPlatformBrowser(inject(PLATFORM_ID)) ? setInterval(() => this.now.set(Date.now()), 1000) : null

    secondsSinceUpdate = computed(() => {
        const updatedAt = this.stats.systemUpdatedAt()
        return updatedAt === null ? null : Math.max(0, Math.round((this.now() - updatedAt) / 1000))
    })

    isStale = computed(() => {
        const seconds = this.secondsSinceUpdate()
        return this.connected() && seconds !== null && seconds > STALE_AFTER_SECONDS
    })

    sensorAgeSeconds = computed(() => {
        this.now()
        const reading = this.stats.climateLastReading()
        return reading ? secondsSinceTimeOfDay(reading) : null
    })

    sensorIsStale = computed(() => {
        const age = this.sensorAgeSeconds()
        return age !== null && age > SENSOR_STALE_AFTER_SECONDS
    })

    temperatureLevel = computed<Level>(() => {
        const temperature = this.stats.cpuTemperature()
        if (temperature === null) return 'ok'
        return temperature >= 75 ? 'hot' : temperature >= 60 ? 'warm' : 'ok'
    })

    ageText(seconds: number | null): string {
        if (seconds === null) return 'no data yet'
        if (seconds < 5) return 'just now'
        if (seconds < 60) return `${seconds} s ago`
        return `${Math.floor(seconds / 60)} min ago`
    }

    ngOnDestroy(): void {
        if (this.timer) clearInterval(this.timer)
    }
}
