'use strict';

const { checkUrl } = require('./checker');

function createScheduler(pool, { intervalSeconds = 60, check = checkUrl } = {}) {
  let timer = null;
  let running = false;

  // Cek satu monitor lalu simpan hasilnya
  async function checkMonitor(monitor) {
    const r = await check(monitor.url);
    await pool.query(
      'INSERT INTO checks (monitor_id, status, status_code, response_ms, error) VALUES ($1, $2, $3, $4, $5)',
      [monitor.id, r.status, r.statusCode, r.responseMs, r.error]
    );
    return r;
  }

  // Satu putaran: cek semua monitor secara paralel
  async function runOnce() {
    if (running) return { skipped: true };
    running = true;
    try {
      const { rows } = await pool.query('SELECT id, url FROM monitors');
      const results = await Promise.allSettled(rows.map((m) => checkMonitor(m)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      // Hapus riwayat lebih dari 31 hari agar tabel tidak membengkak
      await pool.query("DELETE FROM checks WHERE checked_at < NOW() - INTERVAL '31 days'");
      return { total: rows.length, failed };
    } finally {
      running = false;
    }
  }

  function logError(err) {
    console.error('Putaran pengecekan gagal:', err.message);
  }

  function start() {
    if (timer) return;
    runOnce().catch(logError);
    timer = setInterval(() => runOnce().catch(logError), intervalSeconds * 1000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  return { start, stop, runOnce, checkMonitor };
}

module.exports = { createScheduler };