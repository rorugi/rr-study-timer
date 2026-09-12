import type { TimerSettings } from './settings';

export type PomodoroSnapshot = { enabled: boolean; durationMs: number; remainingMs: number; finished: boolean };

/** Owned by the tracking service, independent of widget mounts and queue sessions. */
export class PomodoroTimer {
  private enabled = false;
  private durationMs = 25 * 60000;
  private remainingMs = this.durationMs;
  private restartToken = '';
  private notificationPending = false;

  configure(settings: TimerSettings) {
    const duration = settings.pomodoroMinutes * 60000;
    if (settings.pomodoroEnabled !== this.enabled || duration !== this.durationMs || settings.restartToken !== this.restartToken) {
      this.remainingMs = duration;
      this.notificationPending = false;
    }
    this.enabled = settings.pomodoroEnabled;
    this.durationMs = duration;
    this.restartToken = settings.restartToken;
  }
  advance(activeMs: number) {
    if (!this.enabled || this.remainingMs <= 0 || activeMs <= 0) return;
    this.remainingMs = Math.max(0, this.remainingMs - activeMs);
    if (this.remainingMs === 0) this.notificationPending = true;
  }
  takeNotification() {
    const pending = this.notificationPending;
    this.notificationPending = false;
    return pending;
  }
  snapshot(): PomodoroSnapshot {
    return { enabled: this.enabled, durationMs: this.durationMs, remainingMs: this.remainingMs,
      finished: this.enabled && this.remainingMs === 0 };
  }
}
