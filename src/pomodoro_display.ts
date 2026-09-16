/** Standard size for 20–30 minutes; proportional scaling capped at 50–150%. */
export function pomodoroScale(durationMs: number): number {
  const minutes = durationMs / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return 1;
  if (minutes < 20) return Math.max(.5, minutes / 20);
  if (minutes > 30) return Math.min(1.5, minutes / 30);
  return 1;
}
export function pomodoroIconSize(durationMs: number, base = 40): number {
  return base * pomodoroScale(durationMs);
}
