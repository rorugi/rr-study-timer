import { QueueEvent, type RNPlugin } from '@remnote/plugin-sdk';
import { addDailyStudyTime, resolveTrackedEntityFromRemId } from './daily_stats';
import { TimerEngine } from './timer_engine';
import { withDeadline } from './deadline';
import { defaultSettings, normalizeSettings, SETTINGS_KEY, POMODORO_RESTART_KEY, POMODORO_CONTROL_KEY, type PomodoroControl, type PomodoroMode, type TimerSettings } from './settings';
import type { TimerSnapshot } from './timer_engine';
import type { PomodoroCheckpoint } from './pomodoro';
import { savePomodoro } from './pomodoro_history';

export const POMODORO_CHECKPOINT_KEY = 'rr-study-timer:pomodoro-checkpoint:v1';
type SavedPomodoro = { timer: PomodoroCheckpoint; mode: PomodoroMode; savedAt: number };
export const TIMER_STATE_KEY = 'rr-study-timer:session:v2';
export type StatusSnapshot = TimerSnapshot & { settings: TimerSettings; pomodoroMode?: PomodoroMode; pomodoroControlId?: string };

export async function startTracking(plugin: RNPlugin, options = { rpcTimeoutMs: 3000, pollIntervalMs: 1000 }) {
  const rpc = <T,>(value: Promise<T>) => withDeadline(value, options.rpcTimeoutMs);
  const configured = Number(await rpc(plugin.settings.getSetting('idle-timeout-seconds')).catch(() => 30));
  const engine = new TimerEngine((Number.isFinite(configured) ? Math.max(5, configured) : 30) * 1000);
  let chain = Promise.resolve();
  let error: string | undefined;
  let stopped = false;
  let revision = 0;
  let lastCompletedId: string | undefined;
  let lastFlush = 0;
  let flushing: Promise<void> | undefined;
  let publishing: Promise<void> | undefined;
  let polling = false;
  let checkingVisibility = false;
  let checkingSettings = false;
  let displaySettings = defaultSettings();
  let checkpointReady = false;
  let checkpointWriting: Promise<void> | undefined;
  let lastCheckpointAt = 0;
  let lastCheckpointState = '';
  let lastCheckpointChange = '';
  let checkpointRetryAfter = 0;
  let lastRestartRequest: string | undefined;
  let lastControlRequest: string | undefined;
  const serviceStartedAt = Date.now();
  const listeners: Array<[string, (data?: unknown) => void]> = [];
  // Bound storage RPCs inside the writer, so its own serialization can recover.
  const writer = { storage: {
    getSynced: (key: string) => rpc(plugin.storage.getSynced(key)),
    setSynced: (key: string, value: unknown) => rpc(plugin.storage.setSynced(key, value)),
  }} as RNPlugin;

  const saveCheckpoint = (force = false): Promise<void> => {
    if (!checkpointReady) return Promise.resolve();
    if (checkpointWriting) return checkpointWriting;
    const timer = engine.pomodoro.checkpoint();
    const record: SavedPomodoro = { timer, mode: engine.pomodoroMode, savedAt: Date.now() };
    const state = JSON.stringify({ timer, mode: record.mode, name: displaySettings.pomodoroName, color: displaySettings.pomodoroColor });
    const change = JSON.stringify([timer.enabled, timer.durationMs, timer.restartToken,
      timer.intervalId, timer.remainingMs === 0, record.mode,
      displaySettings.pomodoroName, displaySettings.pomodoroColor]);
    if (state === lastCheckpointState || (!force && (Date.now() < checkpointRetryAfter ||
      (change === lastCheckpointChange && Date.now() - lastCheckpointAt < 30000)))) return Promise.resolve();
    checkpointWriting = rpc(plugin.storage.setSynced(POMODORO_CHECKPOINT_KEY, record))
      .then(() => { lastCheckpointAt = record.savedAt; lastCheckpointState = state; lastCheckpointChange = change; checkpointRetryAfter = 0; })
      .catch(cause => { checkpointRetryAfter = Date.now() + 5000; console.error('RR Study Timer checkpoint', cause); })
      .finally(() => { checkpointWriting = undefined; });
    return checkpointWriting;
  };

  const publish = () => {
    if (publishing) return publishing;
    publishing = rpc(plugin.storage.setSession(TIMER_STATE_KEY, { ...engine.snapshot(Date.now()), settings: displaySettings,
      pomodoroMode: engine.pomodoroMode, pomodoroControlId: lastControlRequest, error }))
      .catch(cause => console.error('RR Study Timer status', cause))
      .finally(() => { publishing = undefined; });
    return publishing;
  };
  const flush = () => {
    if (flushing) return flushing;
    // Finite snapshot: ongoing timer ticks cannot keep this loop alive forever.
    const batch = engine.pending.slice();
    const completions = engine.pomodoro.completed.slice();
    flushing = (async () => {
      try {
        for (const record of completions) {
          await savePomodoro(writer, record);
          engine.pomodoro.completed.shift();
        }
        for (const item of batch) {
          await addDailyStudyTime(writer, item.ms, item.entity, item.cards, item.date, item.id);
          engine.pending.shift();
        }
        error = undefined;
      } catch (cause) {
        error = 'Speicherung verzögert – Timer läuft weiter, erneuter Versuch folgt.';
        console.error('RR Study Timer storage', cause);
      }
    })().finally(() => { flushing = undefined; });
    return flushing;
  };
  const enqueue = (work: () => void | Promise<void>, persist = false) => {
    chain = chain.then(async () => {
      try { await work(); }
      catch (cause) { error = 'Kartenabfrage verzögert – erneuter Versuch folgt.'; console.error('RR Study Timer queue', cause); }
      if (engine.pomodoro.takeNotification()) {
        const color = engine.pomodoro.completed[engine.pomodoro.completed.length - 1]?.color;
        void flush();
        // Consume once in the service, even if several status widgets are mounted.
        void rpc(plugin.app.toast('RR Study Timer: Pomodoro complete — time for a break!'))
          .catch(cause => console.error('RR Study Timer notification', cause));
        void rpc(plugin.widget.openPopup('pomodoro_complete', { color }, false))
          .catch(cause => console.error('RR Study Timer completion popup', cause));
      }
      void saveCheckpoint();
      // Neither persistence nor the session bridge blocks subsequent events/ticks.
      if (persist) void flush();
      void publish();
    });
    return chain;
  };
  const eventCardId = (data: unknown): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    const id = (data as { cardId?: unknown }).cardId;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  };
  const listen = (event: string, callback: (data?: unknown) => void) => {
    plugin.event.addListener(event, undefined, callback); listeners.push([event, callback]);
  };
  const capture = (expectedCardId?: string) => Promise.all([
    rpc(plugin.queue.getCurrentCard()), rpc(plugin.queue.inLookbackMode()),
  ]).then(async ([current, lookback]) => {
    const card = expectedCardId && current?._id !== expectedCardId
      ? await rpc(plugin.card.findOne(expectedCardId)) : current;
    return card ? { id: card._id, lookback: !!lookback,
      entity: await rpc(resolveTrackedEntityFromRemId(plugin, card.remId)).catch(() => null) } : null;
  });
  const load = (data?: unknown) => {
    revision++;
    const now = Date.now();
    const captured = capture(eventCardId(data)).then(value => ({ value }), cause => ({ cause }));
    void enqueue(async () => {
      const result = await captured;
      if ('cause' in result) throw result.cause;
      lastCompletedId = undefined;
      // A real queue event can resume an obsolete hidden state immediately.
      engine.visibility(false, now);
      engine.load(result.value, now);
    }, true);
  };
  const reconcile = () => {
    if (polling || stopped) return;
    polling = true;
    const expectedRevision = revision;
    // Capture first; never put a polling RPC on the event/timer chain.
    void capture().then(card => {
      if (stopped || revision !== expectedRevision) return;
      void enqueue(() => {
        if (stopped || revision !== expectedRevision) return;
        const currentId = engine.snapshot(Date.now()).cardId;
        // Polling the same card is not user activity and must not defeat idle.
        if (card?.id === currentId || (card && card.id === lastCompletedId)) return;
        if (card || currentId) engine.load(card, Date.now());
      });
    }).catch(cause => console.error('RR Study Timer reconcile', cause))
      .finally(() => { polling = false; });
  };
  listen(QueueEvent.QueueEnter, () => {
    revision++; lastCompletedId = undefined;
    const now = Date.now(); void enqueue(() => engine.enter(now), true);
  });
  listen(QueueEvent.QueueLoadCard, load);
  listen(QueueEvent.RevealAnswer, data => {
    const now = Date.now(), cardId = eventCardId(data);
    void enqueue(() => { engine.visibility(false, now); engine.reveal(now, cardId); });
  });
  listen(QueueEvent.QueueCompleteCard, data => {
    revision++;
    const now = Date.now(), cardId = eventCardId(data);
    void enqueue(() => {
      lastCompletedId = cardId ?? engine.snapshot(now).cardId;
      engine.visibility(false, now);
      engine.complete(now, cardId);
    }, true);
  });
  listen(QueueEvent.QueueExit, () => {
    revision++;
    const now = Date.now(); void enqueue(() => engine.exit(now), true);
  });
  const checkQueueVisibility = () => {
    if (checkingVisibility || stopped) return;
    checkingVisibility = true;
    // The index iframe's visibility is NOT the visibility of the review UI.
    // Only the actual queue widget reports whether the review surface is visible.
    void rpc(plugin.storage.getSession<{ visible: boolean; at: number }>('rr-study-timer:queue-visibility:v1'))
      .then(presence => {
        if (stopped) return;
        const fresh = !!presence && Date.now() - presence.at < 5000;
        // A delayed/missing heartbeat is not proof that the learner left.
        // QueueExit and inactivity handle absence; only fresh visibility is used.
        if (!fresh) return;
        const now = Date.now();
        void enqueue(() => {
          engine.visibility(!presence?.visible, now);
        });
      }).catch(cause => console.error('RR Study Timer visibility', cause))
      .finally(() => { checkingVisibility = false; });
  };
  const checkSettings = () => {
    if (checkingSettings || stopped) return;
    checkingSettings = true;
    void (checkpointReady ? Promise.resolve() : rpc(plugin.app?.waitForInitialSync?.() ?? Promise.resolve())).then(() => Promise.all([rpc(plugin.storage.getSynced(SETTINGS_KEY)),
      rpc(plugin.storage.getSession<{ id?: string }>(POMODORO_RESTART_KEY)),
      rpc(plugin.storage.getSession<PomodoroControl>(POMODORO_CONTROL_KEY)),
      checkpointReady ? Promise.resolve(undefined) : rpc(plugin.storage.getSynced<SavedPomodoro>(POMODORO_CHECKPOINT_KEY))])).then(([value, restart, control, saved]) => {
      if (stopped) return;
      const settings = normalizeSettings(value);
      void enqueue(() => {
        engine.advance(Date.now());
        engine.pomodoro.configure(settings);
        if (!checkpointReady) {
          const restored = saved && Number.isFinite(saved.savedAt) &&
            ['running', 'paused', 'flashcards'].includes(saved.mode) && engine.pomodoro.restore(saved.timer);
          if (restored) engine.setPomodoroMode(saved.mode === 'running' ? 'paused' : saved.mode, Date.now());
          checkpointReady = true;
          lastRestartRequest = restart?.id;
          // Do not overwrite synchronized progress merely because this client opened.
          lastCheckpointState = JSON.stringify({ timer: engine.pomodoro.checkpoint(), mode: engine.pomodoroMode, name: settings.pomodoroName, color: settings.pomodoroColor });
          const timer = engine.pomodoro.checkpoint();
          lastCheckpointChange = JSON.stringify([timer.enabled, timer.durationMs, timer.restartToken,
            timer.intervalId, timer.remainingMs === 0, engine.pomodoroMode, settings.pomodoroName, settings.pomodoroColor]);
          lastCheckpointAt = Date.now();
        }
        if (!settings.pomodoroEnabled) engine.setPomodoroMode('flashcards', Date.now());
        displaySettings = settings;
        if (typeof control?.id === 'string' && control.id !== lastControlRequest &&
          Number.isFinite(control.at) && control.at >= serviceStartedAt && control.at <= Date.now() &&
          ['start', 'pause', 'flashcards'].includes(control.action) &&
          (settings.pomodoroEnabled || control.action !== 'start')) {
          lastControlRequest = control.id;
          if (settings.pomodoroEnabled) {
            engine.setPomodoroMode(control.action === 'start' ? 'running' : control.action === 'pause' ? 'paused' : 'flashcards', Date.now());
            if (control.action === 'start') engine.pomodoro.restartCompleted();
          }
        }
        if (typeof restart?.id === 'string' && restart.id !== lastRestartRequest) {
          lastRestartRequest = restart.id;
          if (engine.pomodoro.restartCompleted()) {
            if (engine.pomodoroMode === 'paused') engine.setPomodoroMode('running', Date.now());
            engine.visibility(false, Date.now());
            engine.activity(Date.now());
          }
        }
      });
    }).catch(cause => console.error('RR Study Timer settings', cause))
      .finally(() => { checkingSettings = false; });
  };
  const saveOnHide = () => { void enqueue(() => engine.advance(Date.now())).then(() => saveCheckpoint(true)); };
  const saveOnVisibility = () => { if (document.hidden) saveOnHide(); };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', saveOnHide);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', saveOnVisibility);
  checkSettings();
  load();
  const timer = setInterval(() => {
    if (stopped) return;
    const now = Date.now();
    const persist = now - lastFlush >= 5000;
    if (persist) lastFlush = now;
    void enqueue(() => engine.advance(now), persist);
    reconcile();
    checkQueueVisibility();
    checkSettings();
  }, options.pollIntervalMs);
  return async () => {
    stopped = true; revision++; clearInterval(timer);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', saveOnHide);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', saveOnVisibility);
    for (const [event, callback] of listeners) plugin.event.removeListener(event, undefined, callback);
    const now = Date.now();
    await enqueue(() => engine.exit(now));
    await checkpointWriting;
    await saveCheckpoint(true);
    await flushing;
    await flush();
    await publishing;
    await publish();
  };
}
