import { CanDeactivateFn } from '@angular/router'

export interface HasUnsavedChanges {
    hasUnsavedChanges(): boolean
}

/** Asks before leaving a page that still has changes that were not saved */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component =>
    !component.hasUnsavedChanges() || confirm('You have unsaved changes. Leave this page without saving them?')
