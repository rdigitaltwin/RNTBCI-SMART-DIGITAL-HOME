/**
 * Device panel close gate.
 *
 * Survives React remounts (Strict Mode / Fast Refresh) so a closed panel
 * cannot be auto-reopened by leftover ?device= query params, store ticks,
 * or the click that falls through onto a card under the X.
 *
 * Dismissals expire quickly so a later intentional deep-link still works.
 */

const dismissedUntil = new Map<string, number>();
let suppressOpenUntil = 0;
const SUPPRESS_MS = 1200;
const DISMISS_MS = 8000;

export function dismissDevicePanel(id: string | null | undefined) {
  if (id) dismissedUntil.set(id, Date.now() + DISMISS_MS);
  suppressOpenUntil = Date.now() + SUPPRESS_MS;
}

export function allowDevicePanel(id: string) {
  dismissedUntil.delete(id);
}

export function canAutoOpenDevicePanel(id: string) {
  if (Date.now() < suppressOpenUntil) return false;
  const until = dismissedUntil.get(id);
  if (until && Date.now() < until) return false;
  return true;
}

export function canManuallyOpenDevicePanel() {
  return Date.now() >= suppressOpenUntil;
}
