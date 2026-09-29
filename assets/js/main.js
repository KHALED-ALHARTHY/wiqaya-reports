/* main.js — routing, theme, boot */
(function () {
  'use strict';
  const W = window.W; const { $, $$ } = W;
  const ROUTES = { dashboard: W.renderDashboard, import: W.renderImport, entry: W.renderEntry, facilities: W.renderFacilities, reports: W.renderReports, settings: W.renderSettings };

  W.route = () => {
    const r = (location.hash || '#dashboard').slice(1);
    const name = ROUTES[r] ? r : 'dashboard';
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    W.destroyCharts();
    const main = $('#main');
    const y = window.scrollY;
    try { ROUTES[name](main); } catch (e) { console.error(e); main.innerHTML = `<div class="empty"><h2>حدث خطأ في عرض الصفحة</h2><p>${W.esc(e.message)}</p></div>`; }
    if (W._lastRoute !== name) window.scrollTo(0, 0); else window.scrollTo(0, y);
    W._lastRoute = name;
    const u = W.state.updatedAt; $('#lastUpdate').textContent = u ? 'آخر تحديث: ' + new Date(u).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  };

  W.applyTheme = () => {
    const t = W.state.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    $$('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.themeSet === t));
  };
  W.applyBrand = () => {
    const st = W.state.settings;
    $('#brandSub').textContent = st.deptName || 'برامج الوقاية ومكافحة العدوى';
  };

  function boot() {
    W.applyTheme(); W.applyBrand();
    $$('#themeSeg button').forEach((b) => (b.onclick = () => { W.state.settings.theme = b.dataset.themeSet; W.save(); W.applyTheme(); W.route(); }));
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => W.route());
    window.addEventListener('hashchange', W.route);
    // optional bundled workbook (used only by the preview build)
    if (window.WIQAYA_SEED && !Object.keys(W.state.facilities).length) {
      try {
        const bin = atob(window.WIQAYA_SEED.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const file = new File([u8], window.WIQAYA_SEED.name);
        W.readWorkbook(file).then((wb) => {
          W.applyImport(wb.fileName, wb.sheets.filter((s) => s.ok).map((s) => ({ sheet: s, programId: s.programId, year: s.year, mode: 'replace' })));
          W.ui.year = W.state.settings.year = wb.sheets.find((s) => s.ok)?.year || W.state.settings.year; W.save(true); W.route();
        });
      } catch (e) { console.warn(e); }
    }
    W.route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
