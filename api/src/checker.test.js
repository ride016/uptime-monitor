'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { classify, checkUrl } = require('./checker');

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  server.closeAllConnections();
  server.close();
}

test('classify: status 200 dan cepat = up', () => {
  assert.equal(classify({ statusCode: 200, responseMs: 120, error: null }), 'up');
});

test('classify: tepat 1000 ms masih up', () => {
  assert.equal(classify({ statusCode: 200, responseMs: 1000, error: null }), 'up');
});

test('classify: status 200 tetapi lambat = slow', () => {
  assert.equal(classify({ statusCode: 200, responseMs: 1500, error: null }), 'slow');
});

test('classify: status 500 = down', () => {
  assert.equal(classify({ statusCode: 500, responseMs: 100, error: null }), 'down');
});

test('classify: status 404 = down', () => {
  assert.equal(classify({ statusCode: 404, responseMs: 100, error: null }), 'down');
});

test('classify: ada error = down', () => {
  assert.equal(classify({ statusCode: null, responseMs: 50, error: 'ENOTFOUND' }), 'down');
});

test('checkUrl: server sehat = up', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  try {
    const r = await checkUrl(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(r.status, 'up');
    assert.equal(r.statusCode, 200);
    assert.equal(r.error, null);
  } finally {
    stopServer(server);
  }
});

test('checkUrl: server membalas 500 = down', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(500);
    res.end();
  });
  try {
    const r = await checkUrl(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(r.status, 'down');
    assert.equal(r.statusCode, 500);
  } finally {
    stopServer(server);
  }
});

test('checkUrl: server tidak menjawab = down karena timeout', async () => {
  const server = await startServer(() => {});
  try {
    const r = await checkUrl(`http://127.0.0.1:${server.address().port}/`, 300);
    assert.equal(r.status, 'down');
    assert.match(r.error, /Timeout/);
  } finally {
    stopServer(server);
  }
});

test('checkUrl: host tidak ada = down', async () => {
  const r = await checkUrl('http://tidak-ada.invalid/', 3000);
  assert.equal(r.status, 'down');
  assert.equal(r.statusCode, null);
});