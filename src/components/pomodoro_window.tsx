import { PomodoroStats } from './pomodoro_stats';
import { POMODORO_COLORS, normalizePomodoroColor, pomodoroIcon, type PomodoroColor } from '../pomodoro_colors';
import { usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';
import { withDeadline } from '../deadline';
import { normalizeSettings, normalizePomodoroName, SETTINGS_KEY, POMODORO_CONTROL_KEY, type PomodoroControl } from '../settings';
import type { StatusSnapshot } from '../tracking_service';
import '../style.css';
import { useFloatingDrag } from './use_floating_drag';

export function PomodoroWindow({ docked = false }: { docked?: boolean } = {}) {
  const plugin = usePlugin();
  const [state, setState] = useState<StatusSnapshot>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [selectedName, setSelectedName] = useState<string>();
  const [savingColor, setSavingColor] = useState(false);
  const [selectedColor, setSelectedColor] = useState<PomodoroColor>();
  useEffect(() => {
    if (selectedColor && state?.settings.pomodoroColor === selectedColor) setSelectedColor(undefined);
  }, [state?.settings.pomodoroColor, selectedColor]);
  const chooseColor = async (color: PomodoroColor, closePicker = true) => {
    if (savingColor) return;
    setSavingColor(true); setError('');
    try {
      const settings = normalizeSettings(await withDeadline(plugin.storage.getSynced(SETTINGS_KEY)));
      await withDeadline(plugin.storage.setSynced(SETTINGS_KEY, { ...settings, pomodoroColor: color, pomodoroName: normalizePomodoroName(nameDraft) }));
      setSelectedColor(color); setSelectedName(normalizePomodoroName(nameDraft)); if (closePicker) setShowColors(false);
    } catch { setError('Could not save the color. Please try again.'); }
    finally { setSavingColor(false); }
  };
  const openSettings = async () => {
    try { await withDeadline(plugin.widget.openPopup('settings', { section: 'pomodoro' })); }
    catch { setError('Could not open settings. Please try again.'); }
  };
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
  const name = selectedName ?? normalizePomodoroName(state?.settings.pomodoroName);
  useEffect(() => {
    if (selectedName !== undefined && state?.settings.pomodoroName === selectedName) setSelectedName(undefined);
  }, [state?.settings.pomodoroName, selectedName]);
  const timer = state?.pomodoro;
  const color = selectedColor ?? normalizePomodoroColor(state?.settings.pomodoroColor);
  const seconds = Math.ceil((timer?.remainingMs ?? 25 * 60000) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const fraction = timer ? Math.max(0, Math.min(1, timer.remainingMs / timer.durationMs)) : 1;
  const running = timer?.enabled && !timer.finished && state?.pomodoroMode === 'running';
  const root = (plugin.rootURL ?? '.').replace(/\/$/, '');
  if (minimized) return <main className="pomodoro-window pomodoro-window--mini">
    <button type="button" className={`pomodoro-window__mini-clock${timer?.finished ? ' study-timer__finished' : ''}`}
      aria-label="Restore Pomodoro window" title={name || "Drag to move; click to restore"} {...dragHandlers} onClick={() => { if (!consumeDragClick()) setMinimized(false); }}>
      <img className="pomodoro-window__mini-icon" src={pomodoroIcon(root, color)} alt="" draggable={false} />
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
        <button type="button" className="pomodoro-window__choose-color" aria-label="Choose Pomodoro color"
          title={name || undefined} aria-expanded={showColors} aria-controls="pomodoro-colors" onClick={() => { setNameDraft(name); setShowColors(value => !value); }}>
          <img src={pomodoroIcon(root, color)} alt={`${color} Pomodoro tomato`} draggable={false} />
        </button>
        <button type="button" className={timer?.finished ? 'study-timer__finished' : ''}
          disabled={!timer?.finished || busy} aria-label={timer?.finished ? 'Restart Pomodoro' : 'Time remaining'}
          onClick={() => void control('start')}>{state ? time : '–:––'}</button>
      </div>
    </div>
    {showColors && <fieldset id="pomodoro-colors" className="pomodoro-window__colors" disabled={savingColor}
      onKeyDown={event => { if (event.key === 'Escape') setShowColors(false); }}>
      <legend>Pomodoro session</legend>
      <div className="pomodoro-window__name">
        <label htmlFor="pomodoro-name">Name</label>
        <input id="pomodoro-name" type="text" maxLength={120} value={nameDraft} placeholder="Optional" onChange={event => setNameDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void chooseColor(color, false); } }} />
        <button className="pomodoro-window__save-name" type="button"
          data-dirty={normalizePomodoroName(nameDraft) !== name}
          aria-label={normalizePomodoroName(nameDraft) !== name ? 'Save name' : 'Name saved'}
          title={normalizePomodoroName(nameDraft) !== name ? 'Save name' : 'Name saved'}
          disabled={savingColor || normalizePomodoroName(nameDraft) === name} onClick={() => void chooseColor(color, false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 3h13l4 4v14H3V3zm3 0v6h9V3M7 21v-8h10v8" />
          </svg>
        </button>
      </div>
      {POMODORO_COLORS.map(([id, label, hex]) => <button key={id} type="button" aria-pressed={color === id}
        onClick={() => void chooseColor(id)}><span style={{ backgroundColor: hex }} aria-hidden="true" />{label}{color === id ? ' ✓' : ''}</button>)}
    </fieldset>}
    <p className="pomodoro-window__status">{!state ? 'Connecting…' : !timer?.enabled ? 'Ready to start' : timer.finished ? 'Time for a break' : running ? 'Running independently' : state.pomodoroMode === 'paused' ? 'Paused' : 'Following flashcard activity'}</p>
    <div className="pomodoro-window__controls">
      <button type="button" className="pomodoro-window__primary" disabled={busy || !state}
        onClick={() => void control(running ? 'pause' : 'start')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {running ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 3 15 9-15 9z" />}
        </svg>{busy ? 'Updating…' : running ? 'Pause' : timer?.finished ? 'Start next Pomodoro' : 'Start / Resume'}
      </button>
      <button type="button" className="pomodoro-window__icon-button" aria-label="Pomodoro information" title="Pomodoro information"
        aria-expanded={showInfo} aria-controls="pomodoro-description" onClick={() => setShowInfo(value => !value)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></svg>
      </button>
      <button type="button" className="pomodoro-window__icon-button" aria-label="Pomodoro settings" title="Pomodoro settings" onClick={() => void openSettings()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d="m10 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.5v2.4l-1.5 1.5 2 3.4 1.9-.6 2 .9.5 2h4l.5-2 2-.9 1.9.6 2-3.4-1.5-1.5v-2.4l1.5-1.5-2-3.4-1.9.6-2-.9-.5-2z" /><circle cx="12" cy="11.4" r="3" />
        </svg>
      </button>
    </div>
    {showInfo && <section id="pomodoro-description" className="pomodoro-window__description" aria-label="About Pomodoro timing">
      <p>Independent timing continues until paused, even if you close this window. Flashcards show the same countdown.</p>
      <p>Flashcard activity mode counts active review time and pauses during inactivity. Completed intervals appear in your Pomodoro history.</p>
      {timer?.enabled && state?.pomodoroMode !== 'flashcards' && <button type="button" className="pomodoro-window__link"
        disabled={busy} onClick={() => void control('flashcards')}>Use flashcard activity</button>}
      <PomodoroStats />
      <PomodoroStats days={7} />
    </section>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
