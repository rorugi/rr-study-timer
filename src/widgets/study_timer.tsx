import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';
import { withDeadline } from '../deadline';
import type { TimerSnapshot } from '../timer_engine';
import '../style.css';
function clock(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export function StudyTimer() {
  const plugin = usePlugin();
  const [state, setState] = useState<TimerSnapshot>();
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
        const value = await withDeadline(plugin.storage.getSession<TimerSnapshot>('rr-study-timer:session:v2'));
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
  return <div className="study-timer" aria-label="Lernstatistik">
    <span>{state?.paused ? '⏸' : '⏱'} {clock(state?.sessionMs ?? 0)}</span>
    <span>{state?.cards ?? 0} Karten</span>
    <span title="Durchschnittliche aktive Zeit bis zur Bewertung, nur abgeschlossene Karten">Ø {state?.cards ? (state.averageMs / 1000).toFixed(1) + ' s' : '–'}</span>
  </div>;
}
renderWidget(StudyTimer);
