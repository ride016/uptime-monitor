'use strict';

const express = require('express');
const { validateMonitor } = require('./validate');
const { MONITORS_SQL, HISTORY_SQL, INCIDENTS_SQL } = require('./queries');

function createApp(pool, { onMonitorCreated } = {}) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  // Pemeriksaan kesehatan (dipakai Docker dan CI)
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', error: 'Database tidak dapat dijangkau' });
    }
  });

  // Daftar monitor beserta status terakhir, uptime, dan riwayat
  app.get('/api/monitors', async (req, res) => {
    const monitors = await pool.query(MONITORS_SQL);
    const history = await pool.query(HISTORY_SQL);

    const byMonitor = new Map();
    for (const h of history.rows) {
      if (!byMonitor.has(h.monitor_id)) byMonitor.set(h.monitor_id, []);
      byMonitor.get(h.monitor_id).push(h.status);
    }

    res.json(
      monitors.rows.map((r) => ({
        id: r.id,
        name: r.name,
        url: r.url,
        status: r.status || 'pending',
        statusCode: r.status_code,
        responseMs: r.response_ms,
        error: r.error,
        checkedAt: r.checked_at,
        uptime30d: r.uptime === null ? null : Number(r.uptime),
        history: byMonitor.get(r.id) || [],
      }))
    );
  });

  // Tambah monitor
  app.post('/api/monitors', async (req, res) => {
    const { valid, errors, value } = validateMonitor(req.body);
    if (!valid) return res.status(400).json({ errors });

    try {
      const { rows } = await pool.query(
        'INSERT INTO monitors (name, url) VALUES ($1, $2) RETURNING id, name, url, created_at',
        [value.name, value.url]
      );
      if (onMonitorCreated) onMonitorCreated(rows[0]);
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ errors: ['URL tersebut sudah dipantau'] });
      }
      throw err;
    }
  });

  // Hapus monitor
  app.delete('/api/monitors/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ errors: ['ID tidak valid'] });
    }
    const result = await pool.query('DELETE FROM monitors WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ errors: ['Monitor tidak ditemukan'] });
    }
    res.status(204).end();
  });

  // Insiden terbaru
  app.get('/api/incidents', async (req, res) => {
    const { rows } = await pool.query(INCIDENTS_SQL);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        statusCode: r.status_code,
        responseMs: r.response_ms,
        error: r.error,
        checkedAt: r.checked_at,
      }))
    );
  });

  // Penanganan error umum
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      errors: [status >= 500 ? 'Terjadi kesalahan pada server' : 'Permintaan tidak valid'],
    });
  });

  return app;
}

module.exports = { createApp };