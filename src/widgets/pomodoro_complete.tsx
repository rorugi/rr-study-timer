import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useRef, useState } from 'react';
import '../style.css';

export function PomodoroComplete() {
  const plugin = usePlugin();
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
    <button type="button" className={`pomodoro-celebration__button${loaded || failed ? ' pomodoro-celebration__button--ready' : ''}`}
      aria-label="Pomodoro complete. Click to close." onClick={() => void close()}>
      {!failed && <img src={`${root}/pomodoro-tomato-comic.png`} alt="Smiling tomato giving a thumbs-up"
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} draggable={false} />}
      {failed && <span className="pomodoro-celebration__fallback">🍅<br />Pomodoro complete!<br /><small>Click to close</small></span>}
    </button>
    {!loaded && !failed && <span role="status">Pomodoro complete…</span>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
renderWidget(PomodoroComplete);
