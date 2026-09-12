import type { RNPlugin } from '@remnote/plugin-sdk';
import { getDailyStudyStats, getLocalDateKey } from './daily_stats';
import { withDeadline } from './deadline';

export type StatusTotals = {
  date: string; entityId?: string; todayMs: number; documentMs: number | null;
  groupMs: number | null; groupName?: string;
};

// Resolve current hierarchy so existing v1 statistics work without a migration.
async function foldersFor(plugin: RNPlugin, id: string): Promise<Array<{ id: string; title: string }>> {
  const result: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();
  let rem = await withDeadline(plugin.rem.findOne(id));
  for (let depth = 0; rem && depth < 64 && !seen.has(rem._id); depth++) {
    seen.add(rem._id);
    if (await withDeadline(rem.isFolder())) {
      result.push({ id: rem._id, title: await withDeadline(plugin.richText.toString(rem.text ?? [])) });
    }
    rem = await withDeadline(rem.getParentRem());
  }
  return result;
}

export async function getStatusTotals(plugin: RNPlugin, entityId?: string, entityKind?: string): Promise<StatusTotals> {
  const date = getLocalDateKey();
  const stats = await withDeadline(getDailyStudyStats(plugin, date));
  const totals: StatusTotals = { date, entityId, todayMs: stats.totalActiveMs,
    documentMs: entityId && entityKind === 'document' ? stats.entities[entityId]?.activeMs ?? 0 : null,
    groupMs: null };
  if (!entityId) return totals;
  try {
    const folders = await foldersFor(plugin, entityId);
    // A directly tracked folder is its own group; documents use their nearest parent folder.
    const group = folders[0];
    if (!group) return totals;
    let groupMs = 0;
    for (const entity of Object.values(stats.entities)) {
      if (entity.entityId === group.id || (await foldersFor(plugin, entity.entityId)).some(folder => folder.id === group.id)) {
        groupMs += entity.activeMs;
      }
    }
    totals.groupMs = groupMs;
    totals.groupName = group.title;
  } catch {
    // Never present an incomplete folder sum as a successful zero or partial total.
    totals.groupMs = null;
  }
  return totals;
}
