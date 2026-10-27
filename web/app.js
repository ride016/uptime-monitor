'use strict';

const REFRESH_MS = 15000;
const HISTORY_LENGTH = 40;

const STATUS = {
  up: { label: 'Aktif', cls: 'c-up' },
  slow: { label: 'Lambat', cls: 'c-slow' },
  down: { label: 'Gangguan', cls: 'c-down' },
  pending: { label: 'Menunggu', cls: 'c-pending' },
};

function el(tag, { cls, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

const fmtMs = (ms) => (ms === null || ms === undefined ? '-' : `${ms.toLocaleString('id-ID')} ms`);
const fmtUptime = (u) =>
  u === null || u === undefined
    ? '-'
    : `${u.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmtTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function api(path, options) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.errors || ['Terjadi kesalahan']).join('. '));
  return data;
}

function renderBanner(monitors, loadFailed) {
  const banner = document.getElementById('banner');
  const downs = monitors.filter((m) => m.status === 'down');
  banner.className = 'banner';
  banner.hidden = true;

  if (loadFailed) {
    banner.className = 'banner error';
    banner.textContent = 'Tidak dapat memuat data terbaru dari server. Mencoba lagi otomatis.';
    banner.hidden = false;
  } else if (downs.length > 0) {
    banner.className = 'banner alert';
    banner.textContent = '';
    banner.append(
      el('strong', { text: `${downs.length} layanan tidak dapat dijangkau. ` }),
      document.createTextNode(downs.map((m) => m.name).join(', '))
    );
    banner.hidden = false;
  }
}

function renderSummary(monitors) {
  const up = monitors.filter((m) => m.status === 'up').length;
  const attention = monitors.filter((m) => m.status === 'slow' || m.status === 'down');
  const slow = attention.filter((m) => m.status === 'slow').length;
  const down = attention.length - slow;
  const uptimes = monitors.map((m) => m.uptime30d).filter((u) => u !== null);
  const avg = uptimes.length ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length : null;

  const cards = [
    ['Total monitor', String(monitors.length), 'Dipantau otomatis'],
    ['Aktif', String(up), 'Merespons normal'],
    ['Perlu perhatian', String(attention.length), `${slow} lambat, ${down} gangguan`],
    ['Uptime 30 hari', fmtUptime(avg), 'Rata-rata semua monitor'],
  ];
  document.getElementById('summary').replaceChildren(
    ...cards.map(([label, value, note]) =>
      el('div', { cls: 'card' }, [
        el('div', { cls: 'card-label', text: label }),
        el('div', { cls: 'card-value', text: value }),
        el('div', { cls: 'card-note', text: note }),
      ])
    )
  );
}

function renderMonitors(monitors) {
  const box = document.getElementById('monitors');
  if (monitors.length === 0) {
    box.replaceChildren(el('p', { cls: 'empty', text: 'Belum ada monitor. Tambahkan lewat formulir di samping.' }));
    return;
  }

  box.replaceChildren(
    ...monitors.map((m) => {
      const st = STATUS[m.status] || STATUS.pending;
      const history = m.history.slice(-HISTORY_LENGTH);
      const bars = [
        ...Array(HISTORY_LENGTH - history.length).fill('b-empty'),
        ...history.map((s) => `b-${s}`),
      ].map((cls) => el('span', { cls: `bar ${cls}` }));

      const respons = m.status === 'down' ? 'Tidak merespons' : fmtMs(m.responseMs);
      const del = el('button', { cls: 'btn-delete', text: 'Hapus', attrs: { type: 'button', 'aria-label': `Hapus ${m.name}` } });
      del.addEventListener('click', () => removeMonitor(m));

      return el('article', { cls: 'monitor' }, [
        el('div', { cls: 'monitor-top' }, [
          el('div', { cls: 'monitor-info' }, [
            el('h3', { cls: 'monitor-name', text: m.name }),
            el('div', { cls: 'monitor-url', text: m.url }),
          ]),
          el('span', { cls: `chip ${st.cls}`, text: st.label }),
          el('dl', { cls: 'stats' }, [
            el('div', {}, [el('dt', { text: 'Respons' }), el('dd', { text: respons })]),
            el('div', {}, [el('dt', { text: 'Uptime 30 hari' }), el('dd', { text: fmtUptime(m.uptime30d) })]),
          ]),
          del,
        ]),
        el('div', { cls: 'bars', attrs: { role: 'img', 'aria-label': `Riwayat ${HISTORY_LENGTH} pengecekan terakhir` } }, bars),
      ]);
    })
  );
}

function renderIncidents(incidents) {
  const list = document.getElementById('incidents');
  if (incidents.length === 0) {
    list.replaceChildren(el('li', { cls: 'empty', text: 'Tidak ada insiden dalam 7 hari terakhir.' }));
    return;
  }
  list.replaceChildren(
    ...incidents.map((i) => {
      const st = STATUS[i.status] || STATUS.pending;
      const note =
        i.status === 'down'
          ? i.error || `Kode status ${i.statusCode}`
          : `Waktu respons ${fmtMs(i.responseMs)}`;
      return el('li', {}, [
        el('div', { cls: 'inc-head' }, [
          el('strong', { text: i.name }),
          el('span', { cls: 'inc-time', text: fmtTime(i.checkedAt) }),
        ]),
        el('div', { cls: 'inc-note', text: note }),
        el('div', {}, [el('span', { cls: `chip ${st.cls}`, text: st.label })]),
      ]);
    })
  );
}

async function load() {
  try {
    const [monitors, incidents] = await Promise.all([api('/api/monitors'), api('/api/incidents')]);
    renderBanner(monitors, false);
    renderSummary(monitors);
    renderMonitors(monitors);
    renderIncidents(incidents);
    document.getElementById('last-updated').textContent =
      `Diperbarui ${new Date().toLocaleTimeString('id-ID')}. Halaman menyegarkan diri tiap ${REFRESH_MS / 1000} detik.`;
  } catch {
    renderBanner([], true);
  }
}

async function removeMonitor(m) {
  if (!confirm(`Hapus monitor "${m.name}" beserta seluruh riwayatnya?`)) return;
  try {
    await api(`/api/monitors/${m.id}`, { method: 'DELETE' });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('monitor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = document.getElementById('form-error');
  const button = form.querySelector('button[type="submit"]');
  errorBox.hidden = true;
  button.disabled = true;

  try {
    await api('/api/monitors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name.value, url: form.url.value }),
    });
    form.reset();
    await load();
    setTimeout(load, 2000); // ambil hasil pengecekan pertama
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
  }
});

load();
setInterval(load, REFRESH_MS);