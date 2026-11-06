import { TestBed } from '@angular/core/testing'
import { Subject } from 'rxjs'
import { SocketService } from './socket.service'
import { secondsSinceTimeOfDay, StatsService } from './stats.service'

describe('StatsService', () => {
    const events: Record<string, Subject<unknown>> = {
        system_stats_update: new Subject(),
        ble_update: new Subject(),
    }

    let service: StatsService

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [{ provide: SocketService, useValue: { listen: (name: string) => events[name].asObservable() } }],
        })
        service = TestBed.inject(StatsService)
    })

    it('publishes the system stats and remembers when they arrived', () => {
        events['system_stats_update'].next({ cpuUsage: 12, cpuTemperature: 48, ramUsage: 33 })

        expect([service.cpuUsage(), service.cpuTemperature(), service.ramUsage()]).toEqual([12, 48, 33])
        expect(service.systemUpdatedAt()).not.toBeNull()
        expect(service.cpuHistory()).toEqual([12])
    })

    it('keeps only the last 60 samples', () => {
        for (let i = 0; i < 70; i++) events['system_stats_update'].next({ cpuUsage: i, cpuTemperature: 40, ramUsage: 30 })

        expect(service.cpuHistory().length).toBe(60)
        expect(service.cpuHistory()[59]).toBe(69)
        expect(service.cpuHistory()[0]).toBe(10)
    })

    it('ignores missing sensor values in the history', () => {
        events['ble_update'].next({ humidity: null, temperature: null, voltage: null, lastUpdated: null })
        events['ble_update'].next({ humidity: 45, temperature: 22, voltage: 3, lastUpdated: '10:00:00' })

        expect(service.temperatureHistory()).toEqual([22])
        expect(service.humidityHistory()).toEqual([45])
        expect(service.climateLastReading()).toBe('10:00:00')
    })
})

describe('secondsSinceTimeOfDay', () => {
    const now = new Date(2026, 10, 6, 12, 0, 30)

    it('measures the age of a time of day today', () => {
        expect(secondsSinceTimeOfDay('11:59:00', now)).toBe(90)
    })

    it('treats a time that is later today as yesterday', () => {
        expect(secondsSinceTimeOfDay('23:59:50', new Date(2026, 10, 6, 0, 0, 10))).toBe(20)
    })

    it('rejects text that is not a time of day', () => {
        expect(secondsSinceTimeOfDay('soon', now)).toBeNull()
    })
})
