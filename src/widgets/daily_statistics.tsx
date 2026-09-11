import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type DailyEntityStats,
  type DailyStudyStats,
  type WeekStudyDay,
  getCurrentWeekStudyStats,
  getDailyStudyStats,
  getLocalDateKey,
  resolveCurrentTrackedEntity,
} from '../daily_stats';
import '../style.css';

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, milliseconds) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} Std. ${minutes} Min.`;
  if (hours > 0) return `${hours} Std.`;
  if (totalMinutes > 0) return `${totalMinutes} Min.`;

  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return seconds > 0 ? `${seconds} Sek.` : '0 Min.';
}

function formatAxisDuration(milliseconds: number): string {
  const minutes = Math.round(Math.max(0, milliseconds) / 60000);
  if (minutes >= 120 && minutes % 60 === 0) return `${minutes / 60} h`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h`;
  return `${minutes} min`;
}

function niceWeekMaxMs(maxMs: number): number {
  const maxMinutes = Math.max(1, Math.ceil(maxMs / 60000));
  let step = 5;
  if (maxMinutes > 15) step = 15;
  if (maxMinutes > 60) step = 30;
  if (maxMinutes > 180) step = 60;
  if (maxMinutes > 480) step = 120;
  return Math.ceil(maxMinutes / step) * step * 60000;
}

type DisplayEntity = DailyEntityStats & {
  currentTitle: string;
  deleted: boolean;
};

const weekdayLabels = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

export function DailyStatistics() {
  const plugin = usePlugin();
  const [stats, setStats] = useState<DailyStudyStats | null>(null);
  const [week, setWeek] = useState<WeekStudyDay[]>([]);
  const [displayEntities, setDisplayEntities] = useState<DisplayEntity[]>([]);
  const [dateKey, setDateKey] = useState(getLocalDateKey());

  const refresh = useCallback(async () => {
    const currentDateKey = getLocalDateKey();
    if (currentDateKey !== dateKey) setDateKey(currentDateKey);

    try {
      const [today, currentWeek] = await Promise.all([
        getDailyStudyStats(plugin, currentDateKey),
        getCurrentWeekStudyStats(plugin),
      ]);

      setStats(today);
      setWeek(currentWeek);

      const resolved = await Promise.all(
        Object.values(today.entities ?? {}).map(async (entity) => {
          const current = await resolveCurrentTrackedEntity(plugin, entity);
          return {
            ...entity,
            currentTitle: current?.title || entity.title,
            deleted: !current,
          };
        })
      );
      setDisplayEntities(resolved);
    } catch {
      // Keep the last successfully loaded values if storage is temporarily busy.
    }
  }, [plugin, dateKey]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1500);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const entities = useMemo(
    () =>
      displayEntities
        .filter((entity) => entity.activeMs > 0 || entity.cardsCompleted > 0)
        .sort((a, b) => b.activeMs - a.activeMs),
    [displayEntities]
  );

  const totalMs = stats?.totalActiveMs ?? 0;
  const totalCards = stats?.totalCardsCompleted ?? 0;
  const attributedMs = entities.reduce((sum, entity) => sum + entity.activeMs, 0);
  const unattributedMs = Math.max(0, totalMs - attributedMs);

  const weekTotalMs = week.reduce((sum, day) => sum + day.stats.totalActiveMs, 0);
  const activeWeekDays = week.filter((day) => day.stats.totalActiveMs > 0).length;
  const averageActiveDayMs = activeWeekDays > 0 ? weekTotalMs / activeWeekDays : 0;
  const maxDayMs = Math.max(0, ...week.map((day) => day.stats.totalActiveMs));
  const chartMaxMs = niceWeekMaxMs(maxDayMs);
  const halfChartMaxMs = chartMaxMs / 2;

  return (
    <div className="study-overview-stats">
      <section className="weekly-time" aria-label="Lernzeit diese Woche">
        <div className="weekly-time__header">
          <div>
            <div className="weekly-time__eyebrow">⏱ Lernzeit diese Woche</div>
            <div className="weekly-time__summary">{formatDuration(weekTotalMs)}</div>
          </div>
          <div className="weekly-time__average">
            {activeWeekDays > 0 ? `Ø ${formatDuration(averageActiveDayMs)} / Lerntag` : 'Noch keine Lernzeit'}
          </div>
        </div>

        <div className="weekly-time__chart-wrap">
          <div className="weekly-time__axis" aria-hidden="true">
            <span>{formatAxisDuration(chartMaxMs)}</span>
            <span>{formatAxisDuration(halfChartMaxMs)}</span>
            <span>0</span>
          </div>

          <div className="weekly-time__plot">
            <div className="weekly-time__grid weekly-time__grid--top" />
            <div className="weekly-time__grid weekly-time__grid--middle" />
            <div className="weekly-time__grid weekly-time__grid--bottom" />

            <div className="weekly-time__bars">
              {week.map((day, index) => {
                const value = day.stats.totalActiveMs;
                const height = chartMaxMs > 0 ? Math.min(100, (value / chartMaxMs) * 100) : 0;
                const dateLabel = day.date.toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                });

                return (
                  <div
                    className="weekly-time__day"
                    key={day.dateKey}
                    title={`${dateLabel}: ${formatDuration(value)}`}
                    aria-label={`${dateLabel}: ${formatDuration(value)}`}
                  >
                    <div className="weekly-time__bar-slot">
                      <div
                        className={`weekly-time__bar${day.dateKey === dateKey ? ' weekly-time__bar--today' : ''}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="weekly-time__weekday">{weekdayLabels[index]}</div>
                    <div className="weekly-time__value">{value > 0 ? Math.round(value / 60000) : '0'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="weekly-time__unit">Minuten aktive Lernzeit</div>
      </section>

      <section className="daily-stats" aria-label="Lernen heute">
        <div className="daily-stats__header">
          <div>
            <div className="daily-stats__eyebrow">Heute</div>
            <div className="daily-stats__totals-row">
              <div>
                <div className="daily-stats__total">{totalCards}</div>
                <div className="daily-stats__metric-label">Karten gelernt</div>
              </div>
              <div>
                <div className="daily-stats__total">{formatDuration(totalMs)}</div>
                <div className="daily-stats__metric-label">aktive Lernzeit</div>
              </div>
            </div>
          </div>
        </div>

        <div className="daily-stats__divider" />

        <div className="daily-stats__section-title">Zeit pro Dokument / Ordner</div>

        {entities.length === 0 && unattributedMs === 0 ? (
          <div className="daily-stats__empty">Heute wurde noch keine Lernzeit aufgezeichnet.</div>
        ) : (
          <div className="daily-stats__documents">
            {entities.map((entity) => (
              <div className="daily-stats__row" key={entity.entityId}>
                <span className="daily-stats__document" title={entity.currentTitle}>
                  {entity.kind === 'folder' ? '📁 ' : ''}
                  {entity.currentTitle}
                  {entity.deleted ? ' (nicht mehr vorhanden)' : ''}
                </span>
                <span className="daily-stats__time">{formatDuration(entity.activeMs)}</span>
              </div>
            ))}

            {unattributedMs > 0 && (
              <div className="daily-stats__row daily-stats__row--muted">
                <span className="daily-stats__document">Sonstige / ohne Dokument</span>
                <span className="daily-stats__time">{formatDuration(unattributedMs)}</span>
              </div>
            )}
          </div>
        )}

        <div className="daily-stats__note">
          Zuordnung über stabile RemNote-ID; Umbenennen verändert die Statistik nicht. Pausen und erkannte Inaktivität werden nicht mitgezählt.
        </div>
      </section>
    </div>
  );
}

renderWidget(DailyStatistics);
