import { Component, effect, ElementRef, HostListener, inject, signal } from '@angular/core'
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faBolt, faMicrochip } from '@fortawesome/free-solid-svg-icons'
import { faCloud } from '@fortawesome/free-regular-svg-icons'
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons'
import { SocketService } from '../../../service/socket.service'
import { AuthService } from '../../../service/auth.service'
import { faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons'

interface BleUpdatePayload {
    humidity: number
    temperature: number
    voltage: number
    lastUpdated: string
}

interface SystemStatsUpdatePayload {
    cpuUsage: number
    cpuTemperature: number
    ramUsage: number
}

@Component({
    selector: 'mobile-stats',
    standalone: true,
    imports: [FontAwesomeModule],
    templateUrl: './mobile-stats.html',
    styleUrl: './mobile-stats.scss',
})
export class MobileStats {
    faBluetoothB = faBluetoothB
    faBolt = faBolt
    faCloud = faCloud
    faMicrochip = faMicrochip
    faArrowRightFromBracket = faArrowRightFromBracket

    private eRef = inject(ElementRef)
    private auth = inject(AuthService)
    private socketService = inject(SocketService)

    isVisible = signal(false)

    cpuUsage = signal<number | null>(null)
    cpuTemperature = signal<number | null>(null)
    ramUsage = signal<number | null>(null)

    humidity = signal<number | null>(null)
    temperature = signal<number | null>(null)
    voltage = signal<number | null>(null)
    lastUpdated = signal<string | null>(null)

    constructor() {
        effect(() => {
            this.socketService.listen<SystemStatsUpdatePayload>('system_stats_update').subscribe(payload => {
                this.cpuUsage.set(payload.cpuUsage)
                this.cpuTemperature.set(payload.cpuTemperature)
                this.ramUsage.set(payload.ramUsage)
            })
            this.socketService.listen<BleUpdatePayload>('ble_update').subscribe(payload => {
                this.humidity.set(payload.humidity)
                this.temperature.set(payload.temperature)
                this.voltage.set(payload.voltage)
                this.lastUpdated.set(payload.lastUpdated)
            })
        })
    }

    logout() {
        this.auth.logout()
    }
}
