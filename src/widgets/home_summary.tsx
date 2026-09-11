import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useCallback, useEffect, useState } from 'react';
import { getDailyStudyStats, getLocalDateKey, type DailyStudyStats } from '../daily_stats';
import '../style.css';

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  if (minutes > 0) return `${minutes} Min.`;
  return totalSeconds > 0 ? `${totalSeconds} Sek.` : '0 Min.';
}

export function HomeSummary() {
  const plugin = usePlugin();
  const [stats, setStats] = useState<DailyStudyStats | null>(null);
  const [dateKey, setDateKey] = useState(getLocalDateKey());

  const refresh = useCallback(async () => {
    const currentDateKey = getLocalDateKey();
    if (currentDateKey !== dateKey) setDateKey(currentDateKey);

    try {
      setStats(await getDailyStudyStats(plugin, currentDateKey));
    } catch {
      // Keep the previous values while synced storage is temporarily busy.
    }
  }, [plugin, dateKey]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1200);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const cards = stats?.totalCardsCompleted ?? 0;
  const activeMs = stats?.totalActiveMs ?? 0;

  return (
    <section className="home-study-summary" aria-label="RR Study Timer – heute">
      <div className="home-study-summary__metric">
        <div className="home-study-summary__icon" aria-hidden="true">🎯</div>
        <div>
          <div className="home-study-summary__value">{cards}</div>
          <div className="home-study-summary__label">Karten heute gelernt</div>
        </div>
      </div>

      <div className="home-study-summary__separator" aria-hidden="true" />

      <div className="home-study-summary__metric">
        <div className="home-study-summary__icon" aria-hidden="true">⏱</div>
        <div>
          <div className="home-study-summary__value">{formatDuration(activeMs)}</div>
          <div className="home-study-summary__label">aktive Lernzeit heute</div>
        </div>
      </div>

      <div className="home-study-summary__brand">RR Study Timer</div>
    </section>
  );
}

renderWidget(HomeSummary);
