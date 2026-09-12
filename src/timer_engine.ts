import { getLocalDateKey, type TrackedEntityInfo } from './daily_stats';
import { PomodoroTimer, type PomodoroSnapshot } from './pomodoro';

export type CardContext = { id: string; entity: TrackedEntityInfo | null; lookback?: boolean };
export type Credit = { id: string; date: string; ms: number; cards: number; entity: TrackedEntityInfo | null };
export type TimerSnapshot = { sessionMs: number; cardMs: number; cards: number; averageMs: number;
  recallMs: number | null; active: boolean; paused: boolean; entity: string; error?: string; updatedAt?: number; cardId?: string;
  entityId?: string; entityKind?: 'document' | 'folder'; pomodoro?: PomodoroSnapshot };

/** One instance in the index runtime; widgets never own counters or write totals. */
export class TimerEngine {
  readonly pomodoro = new PomodoroTimer();
  private lastEntity: TrackedEntityInfo | null = null;
  private card: CardContext | null = null;
  private lastTick = 0;
  private lastActivity = 0;
  private hidden = false;
  private sessionMs = 0;
  private cardMs = 0;
  private completedMs = 0;
  private cards = 0;
  private recallMs: number | null = null;
  // RemNote can load B before delivering the completion of A. Keep A's final
  // measurements until its ID-addressed completion arrives, without stopping B.
  private awaitingCompletion = new Map<string, { card: CardContext; ms: number; recall: number | null }>();
  private sequence = 0;
  private readonly runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  readonly pending: Credit[] = [];
  constructor(public idleMs = 30000) {}

  private credit(from: number, to: number) {
    while (from < to) {
      const next = new Date(from);
      next.setHours(24, 0, 0, 0);
      const end = Math.min(to, next.getTime());
      this.pending.push({ id: `${this.runId}:${++this.sequence}`, date: getLocalDateKey(new Date(from)),
        ms: end - from, cards: 0, entity: this.card?.entity ?? null });
      from = end;
    }
  }
  advance(now: number) {
    if (now <= this.lastTick) return;
    if (this.card && !this.hidden) {
      const end = Math.min(now, this.lastActivity + this.idleMs);
      const ms = Math.max(0, end - this.lastTick);
      if (ms) {
        this.credit(this.lastTick, end);
        this.sessionMs += ms;
        this.cardMs += ms;
        this.pomodoro.advance(ms);
      }
    }
    this.lastTick = now;
  }
  activity(now: number) { this.advance(now); this.lastActivity = now; }
  visibility(hidden: boolean, now: number) {
    if (hidden === this.hidden) return;
    this.advance(now); this.hidden = hidden; this.lastTick = now;
    if (!hidden) this.lastActivity = now;
  }
  enter(now: number) {
    this.exit(now);
    this.sessionMs = this.completedMs = this.cards = this.cardMs = 0;
    this.awaitingCompletion.clear();
    this.lastEntity = null;
    this.recallMs = null; this.lastActivity = this.lastTick = now;
  }
  load(card: CardContext | null, now: number) {
    this.advance(now);
    // A rerender/reveal may announce the SAME card again. Preserve both clocks
    // and the inactivity deadline; only a new attempt starts new measurements.
    if (card && !card.lookback && this.card?.id === card.id) {
      this.card = card;
      return;
    }
    if (this.card) {
      this.awaitingCompletion.set(this.card.id, { card: this.card, ms: this.cardMs, recall: this.recallMs });
      // Bound memory for skipped cards that never receive completion events.
      if (this.awaitingCompletion.size > 32) {
        this.awaitingCompletion.delete(this.awaitingCompletion.keys().next().value!);
      }
    }
    this.card = card?.lookback ? null : card;
    this.lastEntity = this.card?.entity ?? null;
    this.cardMs = 0; this.recallMs = null;
    this.lastActivity = this.lastTick = now;
  }
  reveal(now: number, cardId?: string) {
    if (cardId && this.card?.id !== cardId) return;
    this.activity(now);
    if (this.card && this.recallMs === null) this.recallMs = this.cardMs;
  }
  complete(now: number, cardId?: string) {
    if (cardId && this.card?.id !== cardId) {
      const previous = this.awaitingCompletion.get(cardId);
      if (!previous) return;
      this.activity(now);
      this.pending.push({ id: `${this.runId}:${++this.sequence}`, date: getLocalDateKey(new Date(now)),
        ms: 0, cards: 1, entity: previous.card.entity });
      this.cards++; this.completedMs += previous.ms;
      this.awaitingCompletion.delete(cardId);
      return;
    }
    if (!this.card || (cardId && this.card.id !== cardId)) return;
    this.activity(now);
    this.pending.push({ id: `${this.runId}:${++this.sequence}`, date: getLocalDateKey(new Date(now)),
      ms: 0, cards: 1, entity: this.card.entity });
    this.cards++; this.completedMs += this.cardMs;
    if (this.recallMs === null) this.recallMs = this.cardMs;
    this.card = null;
  }
  exit(now: number) { this.advance(now); this.card = null; }
  snapshot(now: number): TimerSnapshot {
    return { sessionMs: this.sessionMs, cardMs: this.cardMs, cards: this.cards,
      averageMs: this.cards ? this.completedMs / this.cards : 0, recallMs: this.recallMs,
      active: !!this.card, paused: this.hidden || now >= this.lastActivity + this.idleMs,
      entity: this.lastEntity?.title ?? '', entityId: this.lastEntity?.id, entityKind: this.lastEntity?.kind,
      pomodoro: this.pomodoro.snapshot(), cardId: this.card?.id, updatedAt: now };
  }
}
