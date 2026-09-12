require('ts-node/register');
const test = require('node:test');
const assert = require('node:assert/strict');
const { getStatusTotals } = require('../src/status_totals');
const { getLocalDateKey } = require('../src/daily_stats');

function fixture() {
  const hierarchy = {
    doc: { parent: 'group', folder: false }, sibling: { parent: 'group', folder: false },
    nested: { parent: 'sub', folder: false }, sub: { parent: 'group', folder: true },
    group: { folder: true }, other: { folder: false },
  };
  const times = { doc: 1000, sibling: 2000, nested: 3000, sub: 4000, group: 5000, other: 6000 };
  const find = async id => {
    const item = hierarchy[id];
    return item ? { _id: id, text: [item.name ?? id], isFolder: async () => item.folder,
      getParentRem: () => find(item.parent) } : undefined;
  };
  const plugin = { storage: { getSynced: async () => ({ date: getLocalDateKey(), totalActiveMs: 22000,
    totalCardsCompleted: 12, entities: Object.fromEntries(Object.entries(times).map(([id, activeMs]) =>
      [id, { entityId: id, title: id, activeMs }])) }) },
    rem: { findOne: find }, richText: { toString: async value => value.join('') } };
  return { plugin, hierarchy };
}

test('parent folder totals include sibling documents and nested folders without double-counting', async () => {
  const { plugin, hierarchy } = fixture();
  const totals = await getStatusTotals(plugin, 'doc', 'document');
  assert.equal(totals.todayMs, 22000); assert.equal(totals.documentMs, 1000);
  assert.equal(totals.groupMs, 15000); assert.equal(totals.groupName, 'group');
  hierarchy.group.name = 'Renamed folder';
  const renamed = await getStatusTotals(plugin, 'doc', 'document');
  assert.equal(renamed.groupMs, 15000); assert.equal(renamed.groupName, 'Renamed folder');
  const folder = await getStatusTotals(plugin, 'sub', 'folder');
  assert.equal(folder.documentMs, null); assert.equal(folder.groupMs, 7000);
});

test('missing context and failed hierarchy lookups do not invent document or group totals', async () => {
  const { plugin } = fixture();
  const absent = await getStatusTotals(plugin);
  assert.equal(absent.todayMs, 22000); assert.equal(absent.documentMs, null); assert.equal(absent.groupMs, null);
  assert.equal((await getStatusTotals(plugin, 'other', 'document')).groupMs, null);
  plugin.rem.findOne = async () => { throw Error('Unavailable'); };
  const failed = await getStatusTotals(plugin, 'doc', 'document');
  assert.equal(failed.documentMs, 1000); assert.equal(failed.groupMs, null);
});
