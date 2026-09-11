import {
  QueueEvent,
  QueueItemType,
  renderWidget,
  useAPIEventListener,
  usePlugin,
  useTracker,
} from '@remnote/plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDailyStudyTime,
  type TrackedEntityInfo,
  resolveTrackedEntityFromRemId,
} from '../daily_stats';
import '../style.css';

const DEFAULT_IDLE_TIMEOUT_SECONDS = 30;

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatSeconds(milliseconds: number): string {
  return `${(Math.max(0, milliseconds) / 1000).toFixed(1)} s`;
}

export function StudyTimer() {
  const plugin = usePlugin();
  const configuredIdleSeconds = useTracker(() =>
    plugin.settings.getSetting<number>('idle-timeout-seconds')
  );
  const idleTimeoutMs = Math.max(
    5,
    configuredIdleSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS
  ) * 1000;

  // Time is accumulated only while the user is considered active.
  const sessionActiveMsRef = useRef(0);
  const cardActiveMsRef = useRef(0);
  const lastTickAtRef = useRef(Date.now());
  const lastActivityAtRef = useRef(Date.now());
  const hiddenRef = useRef(typeof document !== 'undefined' ? document.hidden : false);

  const activeCard = useRef(false);
  const currentDocumentRef = useRef<TrackedEntityInfo | null>(null);
  const currentRemIdRef = useRef<string | null>(null);
  const cardGenerationRef = useRef(0);
  const recallMsRef = useRef<number | null>(null);
  const answerRevealedRef = useRef(false);

  const [displayTick, setDisplayTick] = useState(0);
  const [cardsCompleted, setCardsCompleted] = useState(0);
  const [totalCardMs, setTotalCardMs] = useState(0);
  const [recallMs, setRecallMs] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [isHidden, setIsHidden] = useState(hiddenRef.current);

  const advanceTime = useCallback(
    (timestamp: number) => {
      const from = lastTickAtRef.current;
      if (timestamp <= from) return;

      if (!hiddenRef.current) {
        // Once the inactivity timeout is reached, no further time is credited
        // until activity resumes. If a tick crosses the boundary, only the
        // active portion before that boundary is counted.
        const activeUntil = Math.min(timestamp, lastActivityAtRef.current + idleTimeoutMs);
        const creditedMs = Math.max(0, activeUntil - from);

        sessionActiveMsRef.current += creditedMs;
        if (activeCard.current) {
          cardActiveMsRef.current += creditedMs;
        }
      }

      lastTickAtRef.current = timestamp;
    },
    [idleTimeoutMs]
  );

  const markActivity = useCallback(
    (timestamp = Date.now()) => {
      // First close the previous interval so an idle gap is not counted.
      advanceTime(timestamp);
      lastActivityAtRef.current = timestamp;
      lastTickAtRef.current = timestamp;
      setDisplayTick((tick) => tick + 1);
    },
    [advanceTime]
  );

  const resetSession = useCallback(() => {
    const timestamp = Date.now();
    sessionActiveMsRef.current = 0;
    cardActiveMsRef.current = 0;
    lastTickAtRef.current = timestamp;
    lastActivityAtRef.current = timestamp;
    hiddenRef.current = typeof document !== 'undefined' ? document.hidden : false;
    activeCard.current = false;
    currentDocumentRef.current = null;
    currentRemIdRef.current = null;
    cardGenerationRef.current += 1;
    recallMsRef.current = null;
    answerRevealedRef.current = false;

    setCardsCompleted(0);
    setTotalCardMs(0);
    setRecallMs(null);
    setAnswerRevealed(false);
    setIsHidden(hiddenRef.current);
    setDisplayTick((tick) => tick + 1);
  }, []);

  const resolveDocument = useCallback(
    async (remId: string | null): Promise<TrackedEntityInfo | null> => {
      return await resolveTrackedEntityFromRemId(plugin, remId ?? undefined);
    },
    [plugin]
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      advanceTime(Date.now());
      setDisplayTick((tick) => tick + 1);
    }, 250);

    return () => window.clearInterval(interval);
  }, [advanceTime]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const timestamp = Date.now();
      const hidden = document.hidden;

      if (hidden) {
        // Credit active time right up to the moment RemNote becomes hidden,
        // then pause immediately.
        advanceTime(timestamp);
        hiddenRef.current = true;
      } else {
        // Do not count any background interval. Returning to RemNote counts as
        // activity and starts a fresh active interval.
        hiddenRef.current = false;
        lastTickAtRef.current = timestamp;
        lastActivityAtRef.current = timestamp;
      }

      setIsHidden(hidden);
      setDisplayTick((tick) => tick + 1);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [advanceTime]);

  useEffect(() => {
    const handleActivity = () => markActivity(Date.now());
    const eventNames: Array<keyof DocumentEventMap> = [
      'keydown',
      'pointerdown',
      'touchstart',
      'wheel',
    ];

    // Widgets can be sandboxed. We always observe the widget document itself,
    // and, when RemNote exposes a same-origin parent document, we observe that
    // too so clicks/keys anywhere in the queue reset the inactivity timer.
    const documents: Document[] = [document];
    try {
      if (window.parent !== window && window.parent.document) {
        documents.push(window.parent.document);
      }
    } catch {
      // Cross-origin/sandboxed parent: queue events below still reliably resume
      // the timer when the learner reveals or rates a card.
    }

    const uniqueDocuments = Array.from(new Set(documents));
    for (const targetDocument of uniqueDocuments) {
      for (const eventName of eventNames) {
        targetDocument.addEventListener(eventName, handleActivity, { passive: true });
      }
    }

    return () => {
      for (const targetDocument of uniqueDocuments) {
        for (const eventName of eventNames) {
          targetDocument.removeEventListener(eventName, handleActivity);
        }
      }
    };
  }, [markActivity]);

  useAPIEventListener(QueueEvent.QueueEnter, 'rr-study-timer-enter', () => {
    resetSession();
  });

  useAPIEventListener(QueueEvent.QueueLoadCard, 'rr-study-timer-load-card', async () => {
    const timestamp = Date.now();
    markActivity(timestamp);

    cardActiveMsRef.current = 0;
    activeCard.current = true;
    currentDocumentRef.current = null;
    currentRemIdRef.current = null;
    const generation = ++cardGenerationRef.current;
    recallMsRef.current = null;
    answerRevealedRef.current = false;
    setRecallMs(null);
    setAnswerRevealed(false);
    setDisplayTick((tick) => tick + 1);

    try {
      const currentCard = await plugin.queue.getCurrentCard();
      const remId = currentCard?.remId ?? null;
      if (generation === cardGenerationRef.current) {
        currentRemIdRef.current = remId;
      }
      const document = await resolveDocument(remId);
      if (generation === cardGenerationRef.current) {
        currentDocumentRef.current = document;
      }
    } catch {
      // The card time will still be stored in today's total.
    }
  });

  useAPIEventListener(QueueEvent.RevealAnswer, 'rr-study-timer-reveal-answer', () => {
    if (!activeCard.current || recallMsRef.current !== null) return;

    markActivity(Date.now());
    const value = cardActiveMsRef.current;
    recallMsRef.current = value;
    answerRevealedRef.current = true;
    setRecallMs(value);
    setAnswerRevealed(true);
  });

  useAPIEventListener(QueueEvent.QueueCompleteCard, 'rr-study-timer-complete-card', async () => {
    if (!activeCard.current) return;

    // QueueCompleteCard can also fire for RemNote queue system screens. Only
    // count real forward/backward/cloze flashcards as learned cards.
    const queueItemType = await plugin.queue.getCurrentQueueScreenType();
    const isActualFlashcard =
      queueItemType === QueueItemType.ForwardCard ||
      queueItemType === QueueItemType.BackwardCard ||
      queueItemType === QueueItemType.ClozeCard;

    markActivity(Date.now());
    const cardMs = cardActiveMsRef.current;
    activeCard.current = false;

    if (!isActualFlashcard) {
      cardActiveMsRef.current = 0;
      return;
    }

    // If the answer was completed without a reveal event, use the active total
    // card time as recall time.
    if (recallMsRef.current === null) {
      recallMsRef.current = cardMs;
      setRecallMs(cardMs);
    }

    const document =
      currentDocumentRef.current ?? (await resolveDocument(currentRemIdRef.current));

    // Persist only active time; inactivity has already been removed by
    // advanceTime(). The overview widget reads these daily totals.
    void addDailyStudyTime(plugin, cardMs, document, 1);

    setCardsCompleted((count: number) => count + 1);
    setTotalCardMs((total: number) => total + cardMs);
    setDisplayTick((tick) => tick + 1);
  });

  useAPIEventListener(QueueEvent.QueueExit, 'rr-study-timer-exit', async () => {
    if (!activeCard.current) return;

    // Preserve time spent on an unfinished final card when the learner leaves
    // the queue. It does not increment the completed-card counter.
    advanceTime(Date.now());
    const unfinishedMs = cardActiveMsRef.current;
    activeCard.current = false;

    if (unfinishedMs > 0) {
      const document =
        currentDocumentRef.current ?? (await resolveDocument(currentRemIdRef.current));
      void addDailyStudyTime(plugin, unfinishedMs, document, 0);
    }
  });

  // displayTick intentionally forces a repaint while the mutable timing refs run.
  void displayTick;

  const sessionMs = sessionActiveMsRef.current;
  const averageMs = cardsCompleted > 0 ? totalCardMs / cardsCompleted : 0;
  const idle = isHidden || Date.now() - lastActivityAtRef.current >= idleTimeoutMs;

  const currentRecallMs = activeCard.current
    ? answerRevealed && recallMs !== null
      ? recallMs
      : cardActiveMsRef.current
    : recallMs ?? 0;

  const pauseReason = isHidden
    ? 'RemNote is in the background'
    : `No activity for ${Math.round(idleTimeoutMs / 1000)} seconds`;

  return (
    <div
      className={`study-timer${idle ? ' study-timer--paused' : ''}`}
      title={
        idle
          ? `Study Timer paused: ${pauseReason}`
          : `Study Timer: active session time · completed cards · average active card time · active recall time. Pauses after ${Math.round(
              idleTimeoutMs / 1000
            )} s inactivity.`
      }
    >
      <span className="study-timer__item">
        <span aria-hidden="true">{idle ? '⏸' : '⏱'}</span>
        <span className="study-timer__value">{formatClock(sessionMs)}</span>
      </span>

      <span className="study-timer__item">
        <span className="study-timer__label study-timer__label--optional">Karten</span>
        <span className="study-timer__value">{cardsCompleted}</span>
      </span>

      <span className="study-timer__item">
        <span className="study-timer__label">Ø</span>
        <span className="study-timer__value">
          {cardsCompleted ? formatSeconds(averageMs) : '–'}
        </span>
      </span>

      <span className="study-timer__item study-timer__recall">
        <span className="study-timer__label study-timer__label--optional">Recall</span>
        <span className="study-timer__value">{formatSeconds(currentRecallMs)}</span>
      </span>

      {idle && (
        <span className="study-timer__paused-label" aria-label={`Paused: ${pauseReason}`}>
          Pause
        </span>
      )}
    </div>
  );
}

renderWidget(StudyTimer);
