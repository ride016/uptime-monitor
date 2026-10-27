'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler } = require('./scheduler');

const OK = { status: 'up', statusCode: 200, responseMs: 50, error: null };

function fakePool(monitors) {
  const inserts = [];
  return {
    inserts,
    query: async (sql, params) => {
      if (sql.startsWith('SELECT id, url')) return { rows: monitors };
      if (sql.startsWith('INSERT')) inserts.push(params);
      return { rows: [] };
    },
  };
}

test('runOnce: mengecek semua monitor dan menyimpan hasilnya', async () => {
  const pool = fakePool([{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://b.com' }]);
  const s = createScheduler(pool, { check: async () => OK });
  const r = await s.runOnce();
  assert.equal(r.total, 2);
  assert.equal(r.failed, 0);
  assert.equal(pool.inserts.length, 2);
  assert.deepEqual(pool.inserts[0], [1, 'up', 200, 50, null]);
});

test('runOnce: satu monitor gagal tidak menghentikan yang lain', async () => {
  const pool = fakePool([{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://b.com' }]);
  const check = async (url) => {
    if (url === 'https://b.com') throw new Error('rusak');
    return OK;
  };
  const r = await createScheduler(pool, { check }).runOnce();
  assert.equal(r.failed, 1);
  assert.equal(pool.inserts.length, 1);
});

test('runOnce: putaran yang tumpang tindih dilewati', async () => {
  const pool = fakePool([{ id: 1, url: 'https://a.com' }]);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const s = createScheduler(pool, { check: async () => { await gate; return OK; } });

  const first = s.runOnce();
  const second = await s.runOnce();
  assert.equal(second.skipped, true);

  release();
  await first;
  assert.equal(pool.inserts.length, 1);
});