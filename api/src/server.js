'use strict';

const { Pool } = require('pg');
const { createApp } = require('./app');
const { createScheduler } = require('./scheduler');

const port = Number(process.env.PORT) || 3000;
const intervalSeconds = Math.max(10, Number(process.env.CHECK_INTERVAL_SECONDS) || 60);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
});
pool.on('error', (err) => console.error('Kesalahan koneksi database:', err.message));

const scheduler = createScheduler(pool, { intervalSeconds });

const app = createApp(pool, {
  onMonitorCreated: (monitor) =>
    scheduler.checkMonitor(monitor).catch((err) =>
      console.error('Pengecekan awal gagal:', err.message)
    ),
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API berjalan di port ${port}, interval pengecekan ${intervalSeconds} detik`);
  scheduler.start();
});

// Berhenti dengan rapi saat container dimatikan
function shutdown(signal) {
  console.log(`${signal} diterima, menutup server...`);
  scheduler.stop();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));