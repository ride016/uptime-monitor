'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./app');

async function withApp(handler, fn) {
  const pool = { query: async (sql, params) => handler(sql, params) };
  const app = createApp(pool);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

const json = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('GET /api/health: database sehat = 200', async () => {
  await withApp(async () => ({ rows: [] }), async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('GET /api/health: database mati = 503', async () => {
  await withApp(async () => { throw new Error('db mati'); }, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 503);
  });
});

test('POST /api/monitors: input salah = 400', async () => {
  await withApp(async () => ({ rows: [] }), async (base) => {
    const res = await fetch(`${base}/api/monitors`, json({ name: 'A', url: 'x' }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).errors.length, 2);
  });
});

test('POST /api/monitors: input benar = 201', async () => {
  const row = { id: 1, name: 'Blog', url: 'https://blog.example.com' };
  await withApp(async () => ({ rows: [row] }), async (base) => {
    const res = await fetch(`${base}/api/monitors`, json({ name: 'Blog', url: row.url }));
    assert.equal(res.status, 201);
    assert.equal((await res.json()).name, 'Blog');
  });
});

test('POST /api/monitors: URL sudah ada = 409', async () => {
  await withApp(async () => { throw Object.assign(new Error('dup'), { code: '23505' }); }, async (base) => {
    const res = await fetch(`${base}/api/monitors`, json({ name: 'Blog', url: 'https://a.com' }));
    assert.equal(res.status, 409);
  });
});

test('GET /api/monitors: menggabungkan status dan riwayat', async () => {
  const handler = async (sql) => {
    if (sql.includes('LATERAL')) {
      return { rows: [{ id: 1, name: 'Blog', url: 'https://a.com', status: 'up', status_code: 200, response_ms: 120, error: null, checked_at: null, uptime: '99.50' }] };
    }
    return { rows: [{ monitor_id: 1, status: 'up' }, { monitor_id: 1, status: 'slow' }] };
  };
  await withApp(handler, async (base) => {
    const res = await fetch(`${base}/api/monitors`);
    const data = await res.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].uptime30d, 99.5);
    assert.deepEqual(data[0].history, ['up', 'slow']);
  });
});

test('DELETE /api/monitors/:id: ID bukan angka = 400', async () => {
  await withApp(async () => ({ rowCount: 0 }), async (base) => {
    const res = await fetch(`${base}/api/monitors/abc`, { method: 'DELETE' });
    assert.equal(res.status, 400);
  });
});

test('DELETE /api/monitors/:id: tidak ada = 404, ada = 204', async () => {
  await withApp(async () => ({ rowCount: 0 }), async (base) => {
    assert.equal((await fetch(`${base}/api/monitors/9`, { method: 'DELETE' })).status, 404);
  });
  await withApp(async () => ({ rowCount: 1 }), async (base) => {
    assert.equal((await fetch(`${base}/api/monitors/1`, { method: 'DELETE' })).status, 204);
  });
});