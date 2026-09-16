import { SettingsIcon } from './settings_icon';
import { pomodoroIconSize } from '../pomodoro_display';
import { pomodoroIcon, normalizePomodoroColor } from '../pomodoro_colors';
import { usePlugin } from '@remnote/plugin-sdk';
import { useEffect, useState, type CSSProperties } from 'react';
import { getPomodoroDays, pomodoroTiming, type PomodoroRecord } from '../pomodoro_history';
import { getLocalDateKey } from '../daily_stats';
import { withDeadline } from '../deadline';

export function PomodoroStats({ days = 1 }: { days?: 1 | 7 } = {}) {
  const plugin = usePlugin();
  const [data, setData] = useState<{ date: string; groups: { date: string; records: PomodoroRecord[] }[] }>();
  const [error, setError] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const openSettings = async () => {
    setSettingsError(false);
    try { await withDeadline(plugin.widget.openPopup('settings', { section: 'pomodoro' })); }
    catch { setSettingsError(true); }
  };
  useEffect(() => {
    let closed = false, busy = false;
    const refresh = async () => {
      if (closed || busy) return;
      busy = true;
      const date = getLocalDateKey();
      try {
        const groups = await withDeadline(getPomodoroDays(plugin, days));
        if (!closed) { setData({ date, groups }); setError(false); }
      } catch { if (!closed) setError(true); }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), days === 7 ? 15000 : 1500);
    window.addEventListener('focus', refresh);
    return () => { closed = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [plugin, days]);
  const groups = data?.date === getLocalDateKey() ? data.groups : undefined;
  const records = groups?.flatMap(group => group.records);
  const title = days === 7 ? "Pomodoros this week" : "Pomodoro";
  const root = (plugin.rootURL ?? '.').replace(/\/$/, '');
  return <section className="pomodoro-stats" aria-label={title}>
    <header className="pomodoro-stats__header"><h2>{title}</h2>
      <button type="button" className="pomodoro-window__icon-button" aria-label="Pomodoro settings"
        title="Pomodoro settings" onClick={() => void openSettings()}><SettingsIcon /></button>
    </header>
    {settingsError && <p role="alert">Could not open settings. Please try again.</p>}
    <p>{records ? `${records.length} completed ${days === 7 ? "in the last seven days" : "today"}` : error ? 'Could not load Pomodoros.' : 'Loading…'}</p>
    {error && records && <p role="status">Updates temporarily unavailable.</p>}
    {records?.length === 0 && <p className="pomodoro-stats__empty">Your finished Pomodoros will appear here.</p>}
    {days === 7 && groups ? <div className="pomodoro-week" aria-label="Pomodoros in the last seven days"
      style={{ '--pomodoro-stack-height': `${Math.max(120, ...groups.map(group => group.records.reduce((height, record) => height + pomodoroIconSize(record.durationMs, 24) + 2, 0)))}px` } as CSSProperties}>
      {[...groups].reverse().map(group => <div key={group.date} className="pomodoro-week__column">
        <div className="pomodoro-week__stack" role="list" aria-label={group.date + ' completed Pomodoros'}>
          {group.records.map(record => <span key={record.id} role="listitem" tabIndex={0} title={pomodoroTiming(record)}
            aria-label={`${normalizePomodoroColor(record.color)} Pomodoro: ${pomodoroTiming(record)}`} className="pomodoro-stats__item">
            <img src={pomodoroIcon(root, record.color)} alt="" width={pomodoroIconSize(record.durationMs, 24)} height={pomodoroIconSize(record.durationMs, 24)} />
            <span className="pomodoro-stats__tooltip" role="tooltip">{pomodoroTiming(record)}</span>
          </span>)}
        </div>
        <time dateTime={group.date} title={group.date}>{new Date(group.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</time>
        <span className="pomodoro-week__date">{new Date(group.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
      </div>)}
      <p className="pomodoro-week__caption">Completed Pomodoros · last 7 days</p>
    </div> : groups?.map(group => <div key={group.date} className="pomodoro-stats__day">
      <div className="pomodoro-stats__icons" role="list" aria-label="Today's completed Pomodoros">
      {group.records.map(record => <span key={record.id} role="listitem" tabIndex={0} title={pomodoroTiming(record)}
        aria-label={`${normalizePomodoroColor(record.color)} Pomodoro: ${pomodoroTiming(record)}`} className="pomodoro-stats__item">
        <img src={pomodoroIcon(root, record.color)} alt="" width={pomodoroIconSize(record.durationMs)} height={pomodoroIconSize(record.durationMs)} />
        <span className="pomodoro-stats__tooltip" role="tooltip">{pomodoroTiming(record)}</span>
      </span>)}
      </div>
    </div>)}
  </section>;
}
