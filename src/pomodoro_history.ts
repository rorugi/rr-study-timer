import { normalizePomodoroName } from './settings';
import type { PomodoroColor } from './pomodoro_colors';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { getLocalDateKey } from './daily_stats';

export type PomodoroRecord = { id: string; startedAt: number; completedAt: number; durationMs: number; color?: PomodoroColor; name?: string };
export const POMODORO_HISTORY_PREFIX = 'rr-study-timer:pomodoros:v1:';
let writes: Promise<void> = Promise.resolve();

function validRecord(value: any): value is PomodoroRecord {
  return value && typeof value.id === 'string' && Number.isFinite(value.startedAt) &&
    Number.isFinite(value.completedAt) && value.completedAt >= value.startedAt &&
    Number.isFinite(value.durationMs) && value.durationMs > 0;
}
export async function getDailyPomodoros(plugin: RNPlugin, date = getLocalDateKey()): Promise<PomodoroRecord[]> {
  const data = await plugin.storage.getSynced<Record<string, PomodoroRecord>>(POMODORO_HISTORY_PREFIX + date);
  return Object.values(data ?? {}).filter(validRecord).sort((a, b) => a.completedAt - b.completedAt);
}
export function savePomodoro(plugin: RNPlugin, record: PomodoroRecord): Promise<void> {
  const date = getLocalDateKey(new Date(record.completedAt));
  writes = writes.catch(() => undefined).then(async () => {
    const records = await getDailyPomodoros(plugin, date);
    if (records.some(item => item.id === record.id)) return;
    const data = Object.fromEntries([...records, record].map(item => [item.id, item]));
    await plugin.storage.setSynced(POMODORO_HISTORY_PREFIX + date, data);
  });
  return writes;
}
export function pomodoroTiming(record: PomodoroRecord): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium' };
  const name = normalizePomodoroName(record.name);
  return `${name ? name + ' · ' : ''}${new Date(record.startedAt).toLocaleString(undefined, options)} – ${new Date(record.completedAt).toLocaleString(undefined, options)} · ${Number((record.durationMs / 60000).toFixed(2))} min active`;
}

export async function getPomodoroDays(plugin: RNPlugin, days = 7, now = new Date()) {
  return Promise.all(Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index);
    const key = getLocalDateKey(date);
    return getDailyPomodoros(plugin, key).then(records => ({ date: key, records }));
  }));
}
