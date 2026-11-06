import { Component, effect, HostListener, inject, OnInit, signal, untracked } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms'
import { AlarmComponent } from './alarm/alarm.component'
import { Alarm, RaspberryApi } from '../../service/raspberry.api'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../service/backend-status.service'
import { ToastService } from '../../service/toast.service'
import { HasUnsavedChanges } from '../../service/unsaved-changes.guard'

@Component({
    selector: 'alarm-manager',
    standalone: true,
    imports: [AlarmComponent],
    templateUrl: './alarm-manager.component.html',
    styleUrl: './alarm-manager.component.scss',
})
export class AlarmManagerComponent implements OnInit, HasUnsavedChanges {
    private api = inject(RaspberryApi)
    private formBuilder = inject(FormBuilder)
    private toasts = inject(ToastService)
    backendStatus = inject(BackendStatusService)

    alarms: FormArray<FormGroup> = this.formBuilder.array<FormGroup>([])
    alarmsSignal = signal<FormGroup[]>([])

    placeholders = [1, 2, 3, 4, 5, 6, 7]
    loading = signal(true)
    loadError = signal<string | null>(null)
    saving = signal(false)
    dirty = signal(false)

    /** The alarms as last loaded from or saved to the Raspberry, to detect unsaved changes and to discard them */
    private savedAlarms: Alarm[] = []

    constructor() {
        this.alarms.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.dirty.set(JSON.stringify(this.alarms.value) !== JSON.stringify(this.savedAlarms)))

        // Reload automatically when the Raspberry comes back after the initial load failed
        effect(() => {
            if (this.backendStatus.status() === 'online' && untracked(() => this.loadError())) {
                untracked(() => this.loadAlarms())
            }
        })
    }

    ngOnInit(): void {
        this.loadAlarms()
    }

    loadAlarms(): void {
        this.loading.set(true)
        this.loadError.set(null)
        this.api.getAlarms().subscribe({
            next: res => {
                this.setAlarms(res)
                this.loading.set(false)
            },
            error: err => {
                console.error('Get alarms failed', err)
                this.loading.set(false)
                this.loadError.set(isBackendUnreachable(err) ? BACKEND_OFFLINE_MESSAGE : 'Could not load the alarms. Please try again later.')
            },
        })
    }

    private setAlarms(alarms: Alarm[]): void {
        this.alarms.clear({ emitEvent: false })
        alarms.forEach(alarm => this.alarms.push(this.createAlarmGroup(alarm), { emitEvent: false }))
        this.savedAlarms = this.alarms.value
        this.alarmsSignal.set([...this.alarms.controls])
        this.dirty.set(false)
    }

    private createAlarmGroup(alarm: Alarm): FormGroup {
        return this.formBuilder.group({
            day: [alarm.day],
            hour: [alarm.hour, [Validators.required, Validators.min(0), Validators.max(23)]],
            minute: [alarm.minute, [Validators.required, Validators.min(0), Validators.max(59)]],
            enabled: [alarm.enabled],
            melody: [alarm.melody, Validators.required],
        })
    }

    save(): void {
        if (this.alarms.invalid) {
            this.alarms.markAllAsTouched()
            this.toasts.error('Some alarms have an invalid time.')
            return
        }

        this.saving.set(true)
        this.api.saveAlarms(this.alarms.value).subscribe({
            next: () => {
                this.saving.set(false)
                this.savedAlarms = this.alarms.value
                this.dirty.set(false)
                this.toasts.success('Alarms saved.')
            },
            error: err => {
                console.error('Save failed', err)
                this.saving.set(false)
                this.toasts.error(isBackendUnreachable(err) ? BACKEND_OFFLINE_MESSAGE : 'Saving the alarms failed. Please try again.')
            },
        })
    }

    discard(): void {
        this.alarms.patchValue(this.savedAlarms)
        this.dirty.set(false)
    }

    hasUnsavedChanges(): boolean {
        return this.dirty()
    }

    // Closing or reloading the tab with unsaved alarms
    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent): void {
        if (this.dirty()) event.preventDefault()
    }
}
