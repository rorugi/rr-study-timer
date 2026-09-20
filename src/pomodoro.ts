import { normalizePomodoroColor, type PomodoroColor } from './pomodoro_colors';
import { normalizePomodoroName, type TimerSettings } from './settings';
import type { PomodoroRecord } from './pomodoro_history';

export type PomodoroCheckpoint = {
  version: 1; enabled: boolean; durationMs: number; remainingMs: number;
  restartToken: string; startedAt: number | null; intervalId: string;
  completed: PomodoroRecord[];
};
export type PomodoroSnapshot = { enabled: boolean; durationMs: number; remainingMs: number; finished: boolean; color: PomodoroColor };

/** Owned by the tracking service, independent of widget mounts and queue sessions. */
export class PomodoroTimer {
  private enabled = false;
  private color: PomodoroColor = 'red';
  private name = '';
  private durationMs = 25 * 60000;
  private remainingMs = this.durationMs;
  private restartToken = '';
  private notificationPending = false;
  private startedAt: number | null = null;
  private intervalId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  readonly completed: PomodoroRecord[] = [];

  configure(settings: TimerSettings) {
    const duration = settings.pomodoroMinutes * 60000;
    if (settings.pomodoroEnabled !== this.enabled || duration !== this.durationMs || settings.restartToken !== this.restartToken) {
      this.remainingMs = duration;
      this.notificationPending = false;
      this.startedAt = null;
      this.intervalId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    this.color = normalizePomodoroColor(settings.pomodoroColor);
    this.name = normalizePomodoroName(settings.pomodoroName);
    this.enabled = settings.pomodoroEnabled;
    this.durationMs = duration;
    this.restartToken = settings.restartToken;
  }
  advance(activeMs: number, intervalEnd = Date.now()) {
    if (!this.enabled || this.remainingMs <= 0 || activeMs <= 0) return;
    if (this.startedAt === null) this.startedAt = intervalEnd - activeMs;
    const usedMs = Math.min(activeMs, this.remainingMs);
    this.remainingMs = Math.max(0, this.remainingMs - activeMs);
    if (this.remainingMs === 0) {
      this.notificationPending = true;
      this.completed.push({ id: this.intervalId, startedAt: this.startedAt,
        completedAt: intervalEnd - activeMs + usedMs, durationMs: this.durationMs, color: this.color, name: this.name });
    }
  }
  takeNotification() {
    const pending = this.notificationPending;
    this.notificationPending = false;
    return pending;
  }
  restartCompleted() {
    if (!this.enabled || this.remainingMs !== 0) return false;
    this.remainingMs = this.durationMs;
    this.notificationPending = false;
    this.startedAt = null;
    this.intervalId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return true;
  }
  checkpoint(): PomodoroCheckpoint {
    return { version: 1, enabled: this.enabled, durationMs: this.durationMs,
      remainingMs: this.remainingMs, restartToken: this.restartToken,
      startedAt: this.startedAt, intervalId: this.intervalId,
      completed: this.completed.map(record => ({ ...record })) };
  }
  restore(value: unknown): boolean {
    const data = value as Partial<PomodoroCheckpoint> | null;
    if (!data || data.version !== 1 || data.enabled !== this.enabled ||
      data.durationMs !== this.durationMs || data.restartToken !== this.restartToken ||
      typeof data.remainingMs !== 'number' || !Number.isFinite(data.remainingMs) ||
      data.remainingMs < 0 || data.remainingMs > this.durationMs ||
      typeof data.intervalId !== 'string' || !data.intervalId ||
      !(data.startedAt === null || (typeof data.startedAt === 'number' && Number.isFinite(data.startedAt))) ||
      !Array.isArray(data.completed) || data.completed.some(record => !record ||
        typeof record.id !== 'string' || !Number.isFinite(record.startedAt) ||
        !Number.isFinite(record.completedAt) || record.completedAt < record.startedAt ||
        !Number.isFinite(record.durationMs) || record.durationMs <= 0)) return false;
    this.remainingMs = data.remainingMs;
    this.startedAt = data.startedAt!;
    this.intervalId = data.intervalId;
    this.completed.push(...data.completed.map(record => ({ ...record })));
    this.notificationPending = false;
    return true;
  }
  snapshot(): PomodoroSnapshot {
    return { enabled: this.enabled, durationMs: this.durationMs, remainingMs: this.remainingMs,
      color: this.color, finished: this.enabled && this.remainingMs === 0 };
  }
}
