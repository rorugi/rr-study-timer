import type { RNPlugin } from '@remnote/plugin-sdk';

export type TrackedEntityKind = 'document' | 'folder';

/**
 * Historical learning-time bucket for one RemNote container.
 *
 * `entityId` / the map key is the durable identity. `title` is only a
 * last-known display label and is refreshed from RemNote whenever possible.
 * Renaming a document/folder therefore does not split or lose statistics.
 */
export type DailyEntityStats = {
  entityId: string;
  kind: TrackedEntityKind;
  title: string;
  activeMs: number;
  cardsCompleted: number;
};

export type DailyStudyStats = {
  date: string;
  totalActiveMs: number;
  totalCardsCompleted: number;
  entities: Record<string, DailyEntityStats>;
  updatedAt: number;
  lastMutationId?: string;
};

export type TrackedEntityInfo = {
  id: string;
  kind: TrackedEntityKind;
  title: string;
};

export type WeekStudyDay = {
  dateKey: string;
  date: Date;
  stats: DailyStudyStats;
};

const STORAGE_PREFIX = 'rr-study-timer:daily:v1:';
let writeChain: Promise<void> = Promise.resolve();

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function storageKey(dateKey: string): string {
  return `${STORAGE_PREFIX}${dateKey}`;
}

function emptyStats(dateKey: string): DailyStudyStats {
  return {
    date: dateKey,
    totalActiveMs: 0,
    totalCardsCompleted: 0,
    entities: {},
    updatedAt: Date.now(),
  };
}

function normalizeStoredEntity(key: string, value: any): DailyEntityStats {
  return {
    entityId: value?.entityId ?? key,
    kind: value?.kind === 'folder' ? 'folder' : 'document',
    title:
      value?.title ||
      (value?.kind === 'folder' ? 'Unbenannter Ordner' : 'Unbenanntes Dokument'),
    activeMs: Math.max(0, Number(value?.activeMs) || 0),
    cardsCompleted: Math.max(0, Number(value?.cardsCompleted) || 0),
  };
}

export async function getDailyStudyStats(
  plugin: RNPlugin,
  dateKey = getLocalDateKey()
): Promise<DailyStudyStats> {
  const stored = await plugin.storage.getSynced<DailyStudyStats>(storageKey(dateKey));
  if (!stored || stored.date !== dateKey) return emptyStats(dateKey);

  const entities = Object.fromEntries(
    Object.entries(stored.entities ?? {}).map(([key, value]) => [
      key,
      normalizeStoredEntity(key, value),
    ])
  );

  return {
    ...emptyStats(dateKey),
    ...stored,
    totalActiveMs: Math.max(0, Number(stored.totalActiveMs) || 0),
    totalCardsCompleted: Math.max(0, Number(stored.totalCardsCompleted) || 0),
    entities,
  };
}

/**
 * Serializes writes from the queue widget so two fast completions do not
 * overwrite each other. Only active learning time is stored; idle time is
 * removed before this function is called.
 */
export function addDailyStudyTime(
  plugin: RNPlugin,
  activeMs: number,
  entity: TrackedEntityInfo | null,
  completedCards = 0,
  dateKey = getLocalDateKey(),
  mutationId?: string
): Promise<void> {
  const safeMs = Math.max(0, Math.round(activeMs));
  const safeCards = Math.max(0, Math.round(completedCards));
  if (safeMs === 0 && safeCards === 0) return Promise.resolve();

  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const current = await getDailyStudyStats(plugin, dateKey);
      if (mutationId && current.lastMutationId === mutationId) return;
      current.totalActiveMs += safeMs;
      current.totalCardsCompleted += safeCards;
      current.updatedAt = Date.now();
      current.lastMutationId = mutationId;

      if (entity) {
        const previous = current.entities[entity.id] ?? {
          entityId: entity.id,
          kind: entity.kind,
          title:
            entity.title ||
            (entity.kind === 'folder' ? 'Unbenannter Ordner' : 'Unbenanntes Dokument'),
          activeMs: 0,
          cardsCompleted: 0,
        };

        current.entities[entity.id] = {
          ...previous,
          entityId: entity.id,
          kind: entity.kind,
          // Cache the latest known title only as a display fallback. The stable
          // Rem ID owns the historical data.
          title:
            entity.title ||
            previous.title ||
            (entity.kind === 'folder' ? 'Unbenannter Ordner' : 'Unbenanntes Dokument'),
          activeMs: previous.activeMs + safeMs,
          cardsCompleted: previous.cardsCompleted + safeCards,
        };
      }

      await plugin.storage.setSynced(storageKey(dateKey), current);
    });

  return writeChain;
}

async function titleForRem(plugin: RNPlugin, rem: any, kind: TrackedEntityKind): Promise<string> {
  const fallback = kind === 'folder' ? 'Unbenannter Ordner' : 'Unbenanntes Dokument';
  try {
    return (await plugin.richText.toString(rem.text as any)) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Resolve the stable container for a flashcard Rem. The closest document wins;
 * if no document is found before a folder, the folder itself is used.
 */
export async function resolveTrackedEntityFromRemId(
  plugin: RNPlugin,
  remId: string | undefined
): Promise<TrackedEntityInfo | null> {
  if (!remId) return null;

  try {
    let rem: any = await plugin.rem.findOne(remId);
    if (!rem) return null;

    for (let depth = 0; depth < 64; depth += 1) {
      // A folder can also be a document; test the folder flag first.
      if (await rem.isFolder()) {
        return { id: rem._id, kind: 'folder', title: await titleForRem(plugin, rem, 'folder') };
      }
      if (await rem.isDocument()) {
        return { id: rem._id, kind: 'document', title: await titleForRem(plugin, rem, 'document') };
      }
      rem = await rem.getParentRem();
      if (!rem) return null;
    }
  } catch {
    // Cards without a resolvable container still count towards today's totals.
  }

  return null;
}

/**
 * Resolve the current title/type for a stored stable Rem ID. If the Rem was
 * renamed, this returns the new name while historical totals stay attached to
 * the same ID. If it was deleted, callers can use the cached title.
 */
export async function resolveCurrentTrackedEntity(
  plugin: RNPlugin,
  entity: DailyEntityStats
): Promise<TrackedEntityInfo | null> {
  if (!entity.entityId) return null;

  try {
    const rem: any = await plugin.rem.findOne(entity.entityId);
    if (!rem) return null;

    let kind: TrackedEntityKind = entity.kind;
    try {
      if (await rem.isFolder()) kind = 'folder';
      else if (await rem.isDocument()) kind = 'document';
    } catch {
      // Keep the stored kind if the current classification cannot be read.
    }

    return {
      id: entity.entityId,
      kind,
      title: await titleForRem(plugin, rem, kind),
    };
  } catch {
    return null;
  }
}

export function getCurrentWeekDates(anchor = new Date()): Date[] {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export async function getCurrentWeekStudyStats(
  plugin: RNPlugin,
  anchor = new Date()
): Promise<WeekStudyDay[]> {
  const dates = getCurrentWeekDates(anchor);
  return await Promise.all(
    dates.map(async (date) => {
      const dateKey = getLocalDateKey(date);
      return {
        dateKey,
        date,
        stats: await getDailyStudyStats(plugin, dateKey),
      };
    })
  );
}
