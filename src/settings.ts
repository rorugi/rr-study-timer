import { normalizePomodoroColor, type PomodoroColor } from './pomodoro_colors';
export const SETTINGS_KEY = 'rr-study-timer:settings:v1';
export const POMODORO_RESTART_KEY = 'rr-study-timer:pomodoro-restart:v1';
export const POMODORO_CONTROL_KEY = 'rr-study-timer:pomodoro-control:v1';
export type PomodoroMode = 'flashcards' | 'running' | 'paused';
export type PomodoroControl = { id: string; action: 'start' | 'pause' | 'flashcards'; at: number };
export const METRICS = [
  ['session', 'Session time'],
  ['cards', 'Number of cards'],
  ['average', 'Average time per card'],
  ['today', 'Total time today'],
  ['document', 'Document time today'],
  ['group', 'Group time today'],
  ['pomodoro', 'Pomodoro time'],
] as const;
export type Metric = typeof METRICS[number][0];
export function normalizePomodoroName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}
export type TimerSettings = {
  positions: Metric[];
  pomodoroEnabled: boolean;
  pomodoroMinutes: number;
  pomodoroColor: PomodoroColor;
  pomodoroName: string;
  restartToken: string;
};
export function defaultSettings(): TimerSettings {
  return { positions: ['session', 'cards', 'average'], pomodoroEnabled: false,
    pomodoroMinutes: 25, pomodoroColor: 'red', pomodoroName: '', restartToken: '' };
}
export function normalizeSettings(value: unknown): TimerSettings {
  const defaults = defaultSettings();
  if (!value || typeof value !== 'object') return defaults;
  const input = value as Partial<TimerSettings>;
  const positions = Array.isArray(input.positions)
    ? input.positions.filter((id): id is Metric => METRICS.some(([key]) => key === id)) : [];
  const minutes = input.pomodoroMinutes;
  return {
    positions: positions.length ? positions : defaults.positions,
    pomodoroEnabled: input.pomodoroEnabled === true,
    pomodoroColor: normalizePomodoroColor(input.pomodoroColor),
    pomodoroName: normalizePomodoroName(input.pomodoroName),
    pomodoroMinutes: typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440
      ? minutes : defaults.pomodoroMinutes,
    restartToken: typeof input.restartToken === 'string' ? input.restartToken : '',
  };
}
