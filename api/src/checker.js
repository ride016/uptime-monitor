'use strict';

const SLOW_THRESHOLD_MS = 1000;
const TIMEOUT_MS = 10000;

// Menentukan status dari hasil pengecekan: 'up' | 'slow' | 'down'
function classify({ statusCode, responseMs, error }) {
  if (error || statusCode === null || statusCode === undefined) return 'down';
  if (statusCode >= 400) return 'down';
  if (responseMs > SLOW_THRESHOLD_MS) return 'slow';
  return 'up';
}

// Mengirim request ke URL dan mengembalikan hasilnya
async function checkUrl(url, timeoutMs = TIMEOUT_MS) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'uptime-monitor/1.0' },
    });
    const responseMs = Date.now() - started;
    res.body?.cancel().catch(() => {});
    const result = { statusCode: res.status, responseMs, error: null };
    return { ...result, status: classify(result) };
  } catch (err) {
    const responseMs = Date.now() - started;
    const error =
      err.name === 'AbortError'
        ? `Timeout setelah ${timeoutMs / 1000} detik`
        : err.cause?.code || err.message;
    const result = { statusCode: null, responseMs, error };
    return { ...result, status: classify(result) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { classify, checkUrl, SLOW_THRESHOLD_MS, TIMEOUT_MS };