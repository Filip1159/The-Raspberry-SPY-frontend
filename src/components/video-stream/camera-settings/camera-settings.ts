import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core'
import { HttpErrorResponse } from '@angular/common/http'
import { BACKEND_OFFLINE_MESSAGE, BackendStatusService, isBackendUnreachable } from '../../../service/backend-status.service'
import { CameraSettings, RaspberryApi } from '../../../service/raspberry.api'
import { ToastService } from '../../../service/toast.service'

type NumberKey = 'fps' | 'bitrate' | 'brightness' | 'contrast' | 'saturation' | 'sharpness'
type ChoiceKey = 'resolution' | 'exposure' | 'awb'
type FlipKey = 'hFlip' | 'vFlip'

interface RangeField {
    key: NumberKey
    label: string
    min: number
    max: number
    step: number
    format: (value: number) => string
}

interface Choice {
    key: ChoiceKey
    label: string
    options: { value: string; label: string }[]
}

// The backend validates the same ranges (app/camera_settings.py) and answers 400 for anything else
export const RANGE_FIELDS: RangeField[] = [
    { key: 'fps', label: 'Frame rate', min: 5, max: 30, step: 1, format: value => `${value} fps` },
    { key: 'bitrate', label: 'Bitrate', min: 500, max: 10000, step: 100, format: value => `${(value / 1000).toFixed(1)} Mbit/s` },
    { key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.05, format: value => value.toFixed(2) },
    { key: 'contrast', label: 'Contrast', min: 0, max: 4, step: 0.05, format: value => value.toFixed(2) },
    { key: 'saturation', label: 'Saturation', min: 0, max: 4, step: 0.05, format: value => value.toFixed(2) },
    { key: 'sharpness', label: 'Sharpness', min: 0, max: 8, step: 0.1, format: value => value.toFixed(1) },
]

export const CHOICES: Choice[] = [
    {
        key: 'resolution',
        label: 'Resolution',
        options: [
            { value: '1920x1080', label: '1920 × 1080 (Full HD)' },
            { value: '1280x720', label: '1280 × 720 (HD)' },
            { value: '854x480', label: '854 × 480' },
            { value: '640x360', label: '640 × 360' },
        ],
    },
    {
        key: 'exposure',
        label: 'Exposure',
        options: [
            { value: 'normal', label: 'Normal' },
            { value: 'short', label: 'Short (less motion blur)' },
            { value: 'long', label: 'Long (better in the dark)' },
        ],
    },
    {
        key: 'awb',
        label: 'White balance',
        options: [
            { value: 'auto', label: 'Auto' },
            { value: 'incandescent', label: 'Incandescent' },
            { value: 'tungsten', label: 'Tungsten' },
            { value: 'fluorescent', label: 'Fluorescent' },
            { value: 'indoor', label: 'Indoor' },
            { value: 'daylight', label: 'Daylight' },
            { value: 'cloudy', label: 'Cloudy' },
        ],
    },
]

@Component({
    selector: 'camera-settings',
    standalone: true,
    templateUrl: './camera-settings.html',
    styleUrl: './camera-settings.scss',
})
export class CameraSettingsCard {
    private api = inject(RaspberryApi)
    private toasts = inject(ToastService)
    backendStatus = inject(BackendStatusService)

    /** The camera service took new settings, so the stream restarts and the viewer should reconnect */
    applied = output<void>()

    rangeFields = RANGE_FIELDS
    choices = CHOICES
    offlineMessage = BACKEND_OFFLINE_MESSAGE

    loading = signal(true)
    loadFailed = signal(false)
    saving = signal(false)
    /** What the Raspberry has stored */
    private saved = signal<CameraSettings | null>(null)
    private defaults = signal<CameraSettings | null>(null)
    /** What the form shows */
    draft = signal<CameraSettings | null>(null)
    /** false: stored, but the running stream does not use it yet */
    streamUpToDate = signal(true)

    dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()))
    isDefault = computed(() => JSON.stringify(this.draft()) === JSON.stringify(this.defaults()))

    constructor() {
        this.load()
        // The Raspberry was switched off while the page opened: load the settings as soon as it is back (only the status triggers this)
        effect(() => {
            if (!this.backendStatus.isOffline() && untracked(() => this.loadFailed())) this.load()
        })
    }

    load(): void {
        this.loading.set(true)
        this.api.getCameraSettings().subscribe({
            next: response => {
                this.saved.set(response.settings)
                this.defaults.set(response.defaults)
                this.draft.set(response.settings)
                this.streamUpToDate.set(response.applied)
                this.loadFailed.set(false)
                this.loading.set(false)
            },
            error: () => {
                this.loadFailed.set(true)
                this.loading.set(false)
            },
        })
    }

    setNumber(key: NumberKey, event: Event): void {
        this.update(key, Number((event.target as HTMLInputElement).value))
    }

    setChoice(key: ChoiceKey, event: Event): void {
        this.update(key, (event.target as HTMLSelectElement).value)
    }

    setFlip(key: FlipKey, event: Event): void {
        this.update(key, (event.target as HTMLInputElement).checked)
    }

    resetToDefaults(): void {
        this.draft.set(this.defaults())
    }

    discard(): void {
        this.draft.set(this.saved())
    }

    save(): void {
        const settings = this.draft()
        if (!settings || this.saving()) return

        this.saving.set(true)
        this.api.saveCameraSettings(settings).subscribe({
            next: response => {
                this.saving.set(false)
                this.saved.set(response.settings)
                this.draft.set(response.settings)
                this.streamUpToDate.set(response.applied)
                if (response.applied) {
                    this.toasts.success('Camera settings applied, the stream restarts for a few seconds')
                    this.applied.emit()
                } else {
                    this.toasts.warning('Camera settings saved, but the camera service has not taken them yet. It keeps trying.')
                }
            },
            error: (error: unknown) => {
                this.saving.set(false)
                this.toasts.error(this.errorMessage(error))
            },
        })
    }

    private update<K extends keyof CameraSettings>(key: K, value: CameraSettings[K]): void {
        this.draft.update(draft => (draft ? { ...draft, [key]: value } : draft))
    }

    private errorMessage(error: unknown): string {
        if (isBackendUnreachable(error)) return BACKEND_OFFLINE_MESSAGE
        if (error instanceof HttpErrorResponse) {
            if (error.status === 429) return 'Too many changes, wait a minute and try again.'
            if (error.status === 400 && typeof error.error?.error === 'string') return error.error.error
        }
        return 'The camera settings could not be saved.'
    }
}
