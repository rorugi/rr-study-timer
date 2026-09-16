export const POMODORO_COLORS = [
  ['red', 'Red', '#f92015'], ['gray', 'Gray', '#808080'],
  ['orange', 'Orange', '#f28c28'], ['yellow', 'Yellow', '#f4d03f'],
  ['green', 'Green', '#43a047'], ['black', 'Black', '#151515'],
  ['white', 'White', '#ffffff'], ['blue', 'Blue', '#2584ed'],
  ['purple', 'Purple', '#9755dd'],
] as const;
export type PomodoroColor = typeof POMODORO_COLORS[number][0];
export function normalizePomodoroColor(value: unknown): PomodoroColor {
  return POMODORO_COLORS.some(([id]) => id === value) ? value as PomodoroColor : 'red';
}
export function pomodoroIcon(root: string | undefined, color: unknown): string {
  return `${(root ?? '.').replace(/\/$/, '')}/pomodoro-colors/${normalizePomodoroColor(color)}.svg`;
}
