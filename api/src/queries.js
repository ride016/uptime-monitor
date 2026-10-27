'use strict';

// Monitor + hasil pengecekan terakhir + uptime 30 hari
const MONITORS_SQL = `
  SELECT m.id, m.name, m.url,
         l.status, l.status_code, l.response_ms, l.error, l.checked_at,
         u.uptime
  FROM monitors m
  LEFT JOIN LATERAL (
    SELECT status, status_code, response_ms, error, checked_at
    FROM checks WHERE monitor_id = m.id
    ORDER BY checked_at DESC LIMIT 1
  ) l ON TRUE
  LEFT JOIN LATERAL (
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'down')
                 / NULLIF(COUNT(*), 0), 2) AS uptime
    FROM checks
    WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '30 days'
  ) u ON TRUE
  ORDER BY m.id
`;

// 40 pengecekan terakhir tiap monitor (untuk batang riwayat)
const HISTORY_SQL = `
  SELECT monitor_id, status FROM (
    SELECT monitor_id, status, checked_at,
           ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY checked_at DESC) AS rn
    FROM checks
  ) t
  WHERE rn <= 40
  ORDER BY monitor_id, checked_at ASC
`;

// Insiden = saat status BERUBAH menjadi slow atau down (7 hari terakhir)
const INCIDENTS_SQL = `
  SELECT id, name, status, status_code, response_ms, error, checked_at FROM (
    SELECT c.id, m.name, c.status, c.status_code, c.response_ms, c.error, c.checked_at,
           LAG(c.status) OVER (PARTITION BY c.monitor_id ORDER BY c.checked_at) AS prev
    FROM checks c
    JOIN monitors m ON m.id = c.monitor_id
    WHERE c.checked_at > NOW() - INTERVAL '7 days'
  ) t
  WHERE status <> 'up' AND (prev IS NULL OR prev <> status)
  ORDER BY checked_at DESC
  LIMIT 10
`;

module.exports = { MONITORS_SQL, HISTORY_SQL, INCIDENTS_SQL };