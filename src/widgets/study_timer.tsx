import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';
import { withDeadline } from '../deadline';
import type { StatusSnapshot } from '../tracking_service';
import { defaultSettings, METRICS, type Metric } from '../settings';
import { getStatusTotals, type StatusTotals } from '../status_totals';
import { getLocalDateKey } from '../daily_stats';
import '../style.css';
function clock(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export function StudyTimer() {
  const plugin = usePlugin();
  const [state, setState] = useState<StatusSnapshot>();
  const [totals, setTotals] = useState<StatusTotals>();
  const settings = state?.settings ?? defaultSettings();
  const needsTotals = settings.positions.some(value => ['today', 'document', 'group'].includes(value));
  const entityId = state?.entityId;
  const entityKind = state?.entityKind;
  const date = getLocalDateKey();
  useEffect(() => {
    let closed = false, busy = false;
    if (!needsTotals) return;
    const refresh = async () => {
      if (closed || busy) return;
      busy = true;
      try {
        const value = await getStatusTotals(plugin, entityId, entityKind);
        if (!closed) setTotals(value);
      } catch (error) { console.error('RR Study Timer daily totals', error); }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { closed = true; clearInterval(timer); };
  }, [plugin, entityId, entityKind, needsTotals, date]);
  useEffect(() => {
    let closed = false, busy = false, presenceBusy = false;
    const reportVisibility = async () => {
      if (closed || presenceBusy) return;
      presenceBusy = true;
      try {
        await withDeadline(plugin.storage.setSession('rr-study-timer:queue-visibility:v1', {
          visible: !document.hidden, at: Date.now(),
        }));
      } catch (error) { console.error('RR Study Timer visibility', error); }
      finally { presenceBusy = false; }
    };
    const refresh = async () => {
      if (closed) return;
      void reportVisibility();
      if (busy) return;
      busy = true;
      try {
        const value = await withDeadline(plugin.storage.getSession<StatusSnapshot>('rr-study-timer:session:v2'));
        if (!closed) setState(value);
      } catch (error) { console.error('RR Study Timer display', error); }
      finally { busy = false; }
    };
    document.addEventListener('visibilitychange', reportVisibility);
    void refresh();
    const timer = setInterval(() => void refresh(), 500);
    return () => {
      closed = true; clearInterval(timer);
      document.removeEventListener('visibilitychange', reportVisibility);
    };
  }, [plugin]);
  const matchingTotals = totals?.date === date && totals.entityId === entityId ? totals : undefined;
  const pomodoro = state?.pomodoro;
  const dailyTime = (ms: number | null | undefined) => ms == null ? '–' : clock(ms);
  const content = (metric: Metric) => {
    switch (metric) {
      case 'session': return <><Icon type="clock" />{clock(state?.sessionMs ?? 0)}</>;
      case 'cards': return <>{state?.cards ?? 0} cards</>;
      case 'average': return <>Ø {state?.cards ? (state.averageMs / 1000).toFixed(1) + ' s' : '–'}</>;
      case 'today': return <><Icon type="calendar" />{dailyTime(totals?.date === date ? totals.todayMs : undefined)}</>;
      case 'document': return <><Icon type="document" />{dailyTime(matchingTotals?.documentMs)}</>;
      case 'group': return <><Icon type="folder" />{dailyTime(matchingTotals?.groupMs)}</>;
      case 'pomodoro': return <><Icon type="pomodoro" />{pomodoro?.enabled ? clock(Math.ceil(pomodoro.remainingMs / 1000) * 1000) : 'Off'}</>;
    }
  };
  const metricTitle = (metric: Metric) => {
    if (metric === 'document') return `Document time today${state?.entityKind === 'document' && state.entity ? ': ' + state.entity : ' (no document)'}`;
    if (metric === 'group') return `Group time today${matchingTotals?.groupName ? ': ' + matchingTotals.groupName : ' (no parent folder available)'}`;
    if (metric === 'average') return 'Average active time per completed card review';
    if (metric === 'session') return `Session time${state?.paused ? ' (paused)' : ''}`;
    return METRICS.find(([id]) => id === metric)?.[1];
  };
  return <div className="study-timer" aria-label="RR Study Timer">
    {pomodoro?.enabled && <div className="study-timer__progress" role="progressbar" aria-label="Pomodoro time remaining"
      aria-valuemin={0} aria-valuemax={Math.round(pomodoro.durationMs / 1000)} aria-valuenow={Math.ceil(pomodoro.remainingMs / 1000)}>
      <div style={{ transform: `scaleX(${pomodoro.remainingMs / pomodoro.durationMs})` }} />
    </div>}
    {settings.positions.map((metric, index) => <span key={index} title={metricTitle(metric)} aria-label={metricTitle(metric)}
      className={`study-timer__metric${metric === 'pomodoro' && pomodoro?.finished ? ' study-timer__finished' : ''}`}>{content(metric)}</span>)}
    {pomodoro?.finished && <span className="study-timer__completion" role="status">
      {!settings.positions.includes('pomodoro') && <span className="study-timer__finished">0:00 </span>}Pomodoro complete
    </span>}
  </div>;
}

function Icon({ type }: { type: 'clock' | 'calendar' | 'document' | 'folder' | 'pomodoro' }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    {type === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M9 14h2v4M8 18h6" /></>}
    {type === 'document' && <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h8" /></>}
    {type === 'folder' && <path d="M3 7V4h7l2 3h9v13H3z" />}
    {type === 'pomodoro' && <><circle cx="12" cy="14" r="8" /><path d="M9 2h6m-3 0v4m6 1 2-2m-8 5v5" /></>}
  </svg>;
}
renderWidget(StudyTimer);
