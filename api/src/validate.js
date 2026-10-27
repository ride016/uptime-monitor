'use strict';

function validateMonitor(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const url = typeof body?.url === 'string' ? body.url.trim() : '';

  if (name.length < 2 || name.length > 100) {
    errors.push('Nama harus 2 sampai 100 karakter');
  }

  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    errors.push('URL harus diawali http:// atau https://');
  }
  if (url.length > 500) {
    errors.push('URL maksimal 500 karakter');
  }

  return { valid: errors.length === 0, errors, value: { name, url } };
}

module.exports = { validateMonitor };