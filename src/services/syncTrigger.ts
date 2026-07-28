let trigger: (() => void) | undefined;

export function registerSyncTrigger(next: (() => void) | undefined): void {
  trigger = next;
}

export function signalSyncNeeded(): void {
  trigger?.();
}
