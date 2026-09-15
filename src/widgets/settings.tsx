import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { useEffect, useRef, useState } from 'react';
import { defaultSettings, METRICS, normalizeSettings, SETTINGS_KEY, type Metric, type TimerSettings } from '../settings';
import { withDeadline } from '../deadline';
import '../style.css';

export function Settings() {
  const plugin = usePlugin();
  const [draft, setDraft] = useState<TimerSettings>(defaultSettings);
  const [minutes, setMinutes] = useState('25');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restartOnSave, setRestartOnSave] = useState(false);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const pomodoroSection = useRef<HTMLFieldSetElement>(null);
  const root = (plugin.rootURL ?? '.').replace(/\/$/, '');
  useEffect(() => {
    if (!loaded) return;
    let closed = false;
    void withDeadline(plugin.widget.getWidgetContext<WidgetLocation.Popup>()).then(context => {
      if (closed || context?.contextData?.section !== 'pomodoro' || !body.current || !pomodoroSection.current) return;
      body.current.scrollTop += pomodoroSection.current.getBoundingClientRect().top - body.current.getBoundingClientRect().top;
    }).catch(() => { /* Normal settings entry points open at the top. */ });
    return () => { closed = true; };
  }, [plugin, loaded]);
  useEffect(() => {
    let closed = false;
    setError('');
    void withDeadline(plugin.storage.getSynced(SETTINGS_KEY)).then(value => {
      if (closed) return;
      const settings = normalizeSettings(value);
      setDraft(settings); setMinutes(String(settings.pomodoroMinutes)); setLoaded(true);
    }).catch(() => { if (!closed) setError('Settings could not be loaded. Please try again.'); });
    return () => { closed = true; };
  }, [plugin, loadAttempt]);
  const validMinutes = minutes.trim() !== '' && Number.isFinite(Number(minutes)) && Number(minutes) >= 1 && Number(minutes) <= 1440;
  const save = async () => {
    if (!loaded || saving || !validMinutes) return;
    setSaving(true); setError('');
    try {
      await withDeadline(plugin.storage.setSynced(SETTINGS_KEY, { ...draft, pomodoroMinutes: Number(minutes),
        restartToken: restartOnSave && draft.pomodoroEnabled ? `${Date.now()}-${Math.random()}` : draft.restartToken }));
      await plugin.widget.closePopup();
    } catch { setError('Could not finish saving. Your selections are still here; please try Save again.'); }
    finally { setSaving(false); }
  };
  return <main className="timer-settings" aria-labelledby="timer-settings-title">
    <header><h1 id="timer-settings-title">RR Study Timer</h1><p>Choose what appears during flashcard review.</p></header>
    <div className="timer-settings__body" ref={body}>
      {!loaded && !error && <p role="status">Loading settings…</p>}
      {error && <p className="timer-settings__error" role="alert">{error}</p>}
      {!loaded && error && <button onClick={() => setLoadAttempt(value => value + 1)}>Try again</button>}
      <fieldset disabled={!loaded || saving}>
        <legend>Status bar</legend>
        <p>Positions run from left to right. Every position offers the same choices, including duplicates.</p>
        {draft.positions.map((metric, index) => <div className="timer-settings__position" key={index}>
          <label htmlFor={`position-${index}`}>Position {index + 1}</label>
          <select id={`position-${index}`} value={metric} onChange={event => {
            const value = event.target.value as Metric;
            setDraft(previous => ({ ...previous, positions: previous.positions.map((item, i) => i === index ? value : item) }));
          }}>{METRICS.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
          <button aria-label={`Remove position ${index + 1}`} disabled={draft.positions.length <= 1}
            onClick={() => setDraft(previous => ({ ...previous, positions: previous.positions.filter((_, i) => i !== index) }))}>×</button>
        </div>)}
        <div className="timer-settings__actions">
          <button onClick={() => setDraft(previous => ({ ...previous, positions: [...previous.positions, 'session'] }))}>Add position</button>
          <button onClick={() => setDraft(previous => ({ ...previous, positions: defaultSettings().positions }))}>Restore default layout</button>
        </div>
        <p className="timer-settings__hint">Group time includes today's study in the current document's parent folder and its subfolders.</p>
      </fieldset>
      <fieldset disabled={!loaded || saving} ref={pomodoroSection}>
        <legend><span className="timer-settings__pomodoro-title"><img src={`${root}/pomodoro-tomato-comic.png`} width="20" height="20" alt="" />Pomodoro Timer</span></legend>
        <label className="timer-settings__toggle"><input type="checkbox" checked={draft.pomodoroEnabled}
          onChange={event => setDraft(previous => ({ ...previous, pomodoroEnabled: event.target.checked }))} />Enable Pomodoro Timer</label>
        <label className="timer-settings__duration" htmlFor="pomodoro-minutes">Duration in minutes
          <input id="pomodoro-minutes" type="number" min="1" max="1440" step="any" value={minutes}
            aria-invalid={!validMinutes} onChange={event => setMinutes(event.target.value)} />
        </label>
        {!validMinutes && <p role="alert">Enter a duration from 1 to 1,440 minutes.</p>}
        <p>Flashcard activity mode pauses during inactivity and outside review. Independent timing runs until paused in the Pomodoro window. At zero, the time blinks and RemNote shows a notification.</p>
        <p className="timer-settings__hint">The blue line shows the remaining time. Select “Pomodoro time” in any position to see the countdown.</p>
        <label className="timer-settings__toggle"><input type="checkbox" checked={restartOnSave}
          disabled={!draft.pomodoroEnabled} onChange={event => setRestartOnSave(event.target.checked)} />Restart Pomodoro on Save</label>
        {restartOnSave && draft.pomodoroEnabled && <p className="timer-settings__hint">Saving applies your duration and any requested restart. Layout changes alone keep the current countdown.</p>}
      </fieldset>
    </div>
    <footer>
      <button disabled={saving} onClick={() => void plugin.widget.closePopup()}>Cancel</button>
      <button className="timer-settings__save" disabled={!loaded || saving || !validMinutes} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
    </footer>
  </main>;
}
renderWidget(Settings);
