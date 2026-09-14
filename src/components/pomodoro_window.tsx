import { usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';
import { withDeadline } from '../deadline';
import { normalizeSettings, SETTINGS_KEY, POMODORO_CONTROL_KEY, type PomodoroControl } from '../settings';
import type { StatusSnapshot } from '../tracking_service';
import '../style.css';
import { useFloatingDrag } from './use_floating_drag';

export function PomodoroWindow({ docked = false }: { docked?: boolean } = {}) {
  const plugin = usePlugin();
  const [state, setState] = useState<StatusSnapshot>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { consumeDragClick, ...dragHandlers } = useFloatingDrag(plugin, !docked, () => setError('Could not move the timer. Please try again.'));
  useEffect(() => {
    let closed = false, reading = false;
    const refresh = async () => {
      if (closed || reading) return;
      reading = true;
      try {
        const value = await withDeadline(plugin.storage.getSession<StatusSnapshot>('rr-study-timer:session:v2'));
        if (!closed) setState(value);
      } catch { if (!closed) setError('Unable to reach the timer. Retrying…'); }
      finally { reading = false; }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 500);
    return () => { closed = true; clearInterval(interval); };
  }, [plugin]);
  const control = async (action: PomodoroControl['action']) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (action === 'start') {
        const settings = normalizeSettings(await withDeadline(plugin.storage.getSynced(SETTINGS_KEY)));
        if (!settings.pomodoroEnabled) await withDeadline(plugin.storage.setSynced(SETTINGS_KEY, { ...settings, pomodoroEnabled: true }));
      }
      const id = `${Date.now()}-${Math.random()}`;
      await withDeadline(plugin.storage.setSession(POMODORO_CONTROL_KEY, { id, action, at: Date.now() }));
      // Confirm service acknowledgement instead of running a second local clock.
      const deadline = Date.now() + 6000;
      let acknowledged = false;
      while (Date.now() < deadline) {
        const value = await withDeadline(plugin.storage.getSession<StatusSnapshot>('rr-study-timer:session:v2'));
        if (value?.pomodoroControlId === id) { setState(value); acknowledged = true; break; }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!acknowledged) throw new Error('No acknowledgement');
    } catch { setError('Could not update the timer. Please try again.'); }
    finally { setBusy(false); }
  };
  const close = async () => {
    try {
      const context = await withDeadline(plugin.widget.getWidgetContext<WidgetLocation.FloatingWidget>());
      await withDeadline(plugin.window.closeFloatingWidget(context.floatingWidgetId));
    } catch { setError('Could not close the window. Please try again.'); }
  };
  const timer = state?.pomodoro;
  const seconds = Math.ceil((timer?.remainingMs ?? 25 * 60000) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const fraction = timer ? Math.max(0, Math.min(1, timer.remainingMs / timer.durationMs)) : 1;
  const running = timer?.enabled && !timer.finished && state?.pomodoroMode === 'running';
  const root = (plugin.rootURL ?? '.').replace(/\/$/, '');
  if (minimized) return <main className="pomodoro-window pomodoro-window--mini">
    <button type="button" className={`pomodoro-window__mini-clock${timer?.finished ? ' study-timer__finished' : ''}`}
      aria-label="Restore Pomodoro window" title="Drag to move; click to restore" {...dragHandlers} onClick={() => { if (!consumeDragClick()) setMinimized(false); }}>
      <img className="pomodoro-window__mini-icon" src={`${root}/pomodoro-tomato-comic.png`} alt="" draggable={false} />
      <span>{state ? time : '–:––'}</span>
    </button>
  </main>;
  return <main className={`pomodoro-window${docked ? ' pomodoro-window--docked' : ''}`}>
    <header><strong className="pomodoro-window__drag-handle" title={docked ? undefined : 'Drag to move'} {...dragHandlers}>RR Pomodoro</strong><div className="pomodoro-window__actions">
      <button type="button" aria-label="Minimize Pomodoro to clock" title="Minimize to clock" onClick={() => setMinimized(true)}>−</button>
      {!docked && <button type="button" aria-label="Close Pomodoro window" onClick={() => void close()}>×</button>}
    </div></header>
    <div className="pomodoro-window__dial">
      <svg viewBox="0 0 300 300" role="progressbar" aria-label="Pomodoro time remaining"
        aria-valuemin={0} aria-valuemax={Math.round((timer?.durationMs ?? 1500000) / 1000)} aria-valuenow={seconds}>
        <circle className="pomodoro-window__track" cx="150" cy="150" r="140" />
        <circle className="pomodoro-window__ring" cx="150" cy="150" r="140" pathLength="100"
          strokeDasharray={`${fraction * 100} 100`} transform="rotate(-90 150 150)" />
      </svg>
      <div className="pomodoro-window__center">
        <img src={`${root}/pomodoro-tomato-comic.png`} alt="Pomodoro tomato" draggable={false} />
        <button type="button" className={timer?.finished ? 'study-timer__finished' : ''}
          disabled={!timer?.finished || busy} aria-label={timer?.finished ? 'Restart Pomodoro' : 'Time remaining'}
          onClick={() => void control('start')}>{state ? time : '–:––'}</button>
      </div>
    </div>
    <p className="pomodoro-window__status">{!state ? 'Connecting…' : !timer?.enabled ? 'Ready to start' : timer.finished ? 'Time for a break' : running ? 'Running independently' : state.pomodoroMode === 'paused' ? 'Paused' : 'Following flashcard activity'}</p>
    <button type="button" className="pomodoro-window__primary" disabled={busy || !state}
      onClick={() => void control(running ? 'pause' : 'start')}>{busy ? 'Updating…' : running ? 'Pause' : timer?.finished ? 'Start next Pomodoro' : 'Start / Resume'}</button>
    {timer?.enabled && state?.pomodoroMode !== 'flashcards' && <button type="button" className="pomodoro-window__link"
      disabled={busy} onClick={() => void control('flashcards')}>Use flashcard activity</button>}
    <p className="pomodoro-window__hint">Independent timing continues until paused, even if you close this window. Flashcards show the same countdown.</p>
    {error && <p role="alert">{error}</p>}
  </main>;
}
