'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMonitor } = require('./validate');

test('validateMonitor: input benar diterima', () => {
  const r = validateMonitor({ name: 'Blog', url: 'https://blog.example.com' });
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
});

test('validateMonitor: spasi di pinggir dipangkas', () => {
  const r = validateMonitor({ name: '  Blog  ', url: '  https://a.com  ' });
  assert.equal(r.value.name, 'Blog');
  assert.equal(r.value.url, 'https://a.com');
});

test('validateMonitor: nama terlalu pendek ditolak', () => {
  assert.equal(validateMonitor({ name: 'A', url: 'https://a.com' }).valid, false);
});

test('validateMonitor: URL tanpa http/https ditolak', () => {
  assert.equal(validateMonitor({ name: 'Blog', url: 'ftp://a.com' }).valid, false);
  assert.equal(validateMonitor({ name: 'Blog', url: 'a.com' }).valid, false);
});

test('validateMonitor: body kosong ditolak', () => {
  assert.equal(validateMonitor(undefined).valid, false);
  assert.equal(validateMonitor({}).errors.length, 2);
});