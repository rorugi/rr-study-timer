import { pomodoroIcon, normalizePomodoroColor, type PomodoroColor } from '../pomodoro_colors';
import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { CSSProperties, useEffect, useRef, useState } from 'react';
import '../style.css';

const confetti = Array.from({ length: 80 }, (_, i) => {
  const angle = i * 2.39996;
  const radius = 100 + (i * 47 % 150);
  return {
    '--burst-x': `${Math.cos(angle) * radius}px`,
    '--burst-y': `${Math.sin(angle) * radius - 70}px`,
    '--fall-y': `${Math.sin(angle) * radius + 320}px`,
    '--spin': `${(i % 2 ? 1 : -1) * (360 + i * 29)}deg`,
    backgroundColor: ['#ff5252', '#ffca28', '#40c4ff', '#69f0ae', '#b388ff', '#ff80ab'][i % 6],
    animationDelay: `${i % 5 * 35}ms`,
    borderRadius: i % 3 === 0 ? '50%' : '1px',
  } as CSSProperties;
});

export function PomodoroComplete() {
  const plugin = usePlugin();
  const [color, setColor] = useState<PomodoroColor>('red');
  useEffect(() => { void plugin.widget.getWidgetContext<WidgetLocation.Popup>().then(context => setColor(normalizePomodoroColor(context?.contextData?.color))).catch(() => {}); }, [plugin]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const closing = useRef(false);
  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    try { await plugin.widget.closePopup(); }
    catch { closing.current = false; setError('Could not close. Click to try again.'); }
  };
  const root = (plugin.rootURL ?? '.').replace(/\/$/, '');
  return <div className="pomodoro-celebration">
    {(loaded || failed) && <div className="pomodoro-confetti" aria-hidden="true">
      {confetti.map((style, i) => <i key={i} style={style} />)}
    </div>}
    <button type="button" className={`pomodoro-celebration__button${loaded || failed ? ' pomodoro-celebration__button--ready' : ''}`}
      aria-label="Pomodoro complete. Click to close." onClick={() => void close()}>
      {!failed && <img src={pomodoroIcon(root, color)} alt="Smiling tomato giving a thumbs-up"
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} draggable={false} />}
      {failed && <span className="pomodoro-celebration__fallback">🍅<br />Pomodoro complete!<br /><small>Click to close</small></span>}
    </button>
    {!loaded && !failed && <span role="status">Pomodoro complete…</span>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
renderWidget(PomodoroComplete);
