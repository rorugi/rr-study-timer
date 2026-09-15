import { usePlugin } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';
import { getDailyPomodoros, pomodoroTiming, type PomodoroRecord } from '../pomodoro_history';
import { getLocalDateKey } from '../daily_stats';
import { withDeadline } from '../deadline';

export function PomodoroStats() {
  const plugin = usePlugin();
  const [data, setData] = useState<{ date: string; records: PomodoroRecord[] }>();
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
        const records = await withDeadline(getDailyPomodoros(plugin, date));
        if (!closed) { setData({ date, records }); setError(false); }
      } catch { if (!closed) setError(true); }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    window.addEventListener('focus', refresh);
    return () => { closed = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [plugin]);
  const records = data?.date === getLocalDateKey() ? data.records : undefined;
  const root = (plugin.rootURL ?? '.').replace(/\/$/, '');
  return <section className="pomodoro-stats" aria-label="Pomodoro">
    <header className="pomodoro-stats__header"><h2>Pomodoro</h2>
      <button type="button" className="pomodoro-window__icon-button" aria-label="Pomodoro settings"
        title="Pomodoro settings" onClick={() => void openSettings()}>⚙</button>
    </header>
    {settingsError && <p role="alert">Could not open settings. Please try again.</p>}
    <p>{records ? `${records.length} completed today` : error ? 'Could not load Pomodoros.' : 'Loading…'}</p>
    {error && records && <p role="status">Updates temporarily unavailable.</p>}
    {records?.length === 0 && <p className="pomodoro-stats__empty">Your finished Pomodoros will appear here.</p>}
    <div className="pomodoro-stats__icons" role="list" aria-label="Today's completed Pomodoros">
      {records?.map(record => <span key={record.id} role="listitem" tabIndex={0} title={pomodoroTiming(record)}
        aria-label={pomodoroTiming(record)} className="pomodoro-stats__item">
        <img src={`${root}/pomodoro-tomato-comic.png`} alt="" width="40" height="40" />
        <span className="pomodoro-stats__tooltip" role="tooltip">{pomodoroTiming(record)}</span>
      </span>)}
    </div>
  </section>;
}
