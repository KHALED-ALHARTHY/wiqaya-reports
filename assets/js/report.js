/* report.js — report model (slides), HTML deck renderer, reports page, presenter */
(function () {
  'use strict';
  const W = window.W; const { $, $$, esc, pct } = W;
  const SC = { primary: '#0E6F68', ink: '#10292B', ink2: '#4A6164', line: '#DCE5E2', good: '#1E8A4C', warn: '#D08A10', bad: '#C0392B', none: '#A7B3B4', accent: '#B7791F', soft: '#EEF4F2' };
  W.SC = SC;
  const rc = (W.rcfg = W.rcfg || { type: 'program', pid: null, year: null, period: null, cat: 'all', refP: null, inc: { facChart: true, table: true, recs: true, notes: true } });

  const FAC_CHUNK = 24, TABLE_CHUNK = 12;
  const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out.length ? out : [[]]; };

  /* ---------- model ---------- */
  W.buildReport = (cfg) => {
    const S = W.state; const st = S.settings; const slides = [];
    const today = W.fmtDate(new Date());
    if (cfg.type === 'program') {
      const pr = W.prog(cfg.pid); const s = W.stats(cfg.pid, cfg.year, cfg.period, cfg.cat);
      const catTxt = cfg.cat && cfg.cat !== 'all' ? ' · ' + W.CATS[cfg.cat] : '';
      const periodTxt = W.periodLabel(cfg.period, cfg.year);
      const foot = `${pr.short || pr.name} · ${periodTxt}`;
      slides.push({ kind: 'cover', title: pr.name, sub: periodTxt + catTxt, meta: [today, st.preparedBy ? 'إعداد: ' + st.preparedBy : '', `${s.total} منشأة`].filter(Boolean) });
      slides.push({ kind: 'summary', title: 'الملخص التنفيذي', s, insights: W.insights(s), foot });
      if (cfg.inc.facChart) {
        const rep = s.rows.filter((r) => r.v != null).sort((a, b) => b.v - a.v);
        const parts = chunk(rep, FAC_CHUNK);
        parts.forEach((rows, i) => slides.push({ kind: 'facChart', title: 'النتائج حسب المنشأة' + (parts.length > 1 ? ` (${i + 1}/${parts.length})` : ''), rows, s, foot }));
      }
      slides.push({ kind: 'trendCat', title: 'الاتجاه والمقارنة بين الفئات', s, foot });
      slides.push({ kind: 'rank', title: 'الأعلى والأدنى أداءً', s, foot });
      if (cfg.inc.table) {
        const rows = [...s.rows].sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
        const parts = chunk(rows, TABLE_CHUNK);
        parts.forEach((r, i) => slides.push({ kind: 'table', title: 'الجدول التفصيلي' + (parts.length > 1 ? ` (${i + 1}/${parts.length})` : ''), rows: r, s, foot, notes: cfg.inc.notes }));
      }
      if (s.missing) slides.push({ kind: 'missing', title: `منشآت لم ترفع نتائجها (${s.missing})`, rows: s.rows.filter((r) => r.st === 'none'), s, foot });
      if (cfg.inc.recs) slides.push({ kind: 'recs', title: 'التوصيات والإجراءات', recs: W.recommendations(s), notes: cfg.inc.notes ? s.rows.filter((r) => r.note).map((r) => ({ name: r.name, note: r.note })) : [], foot });
      return { name: `${pr.short || pr.name} - ${periodTxt}`, slides, stats: [s] };
    }
    // comprehensive
    const ref = cfg.refP; // e.g. Q3 or H1 or M08
    const items = S.programs.filter((p) => (S.facilities[p.id] || []).length).map((p) => {
      let per = ref;
      const vp = W.viewPeriods(p.freq);
      if (!vp.includes(per)) { // map to coarser/containing period
        const ms = W.monthsOf(ref); per = vp.find((x) => x[0] === 'H' && W.monthsOf(x).includes(ms[0])) || 'Y';
      }
      return { pr: p, period: per, s: W.stats(p.id, cfg.year, per, 'all') };
    });
    const periodTxt = W.periodLabel(ref, cfg.year);
    slides.push({ kind: 'cover', title: st.reportTitle || 'تقرير برامج الوقاية ومكافحة العدوى', sub: periodTxt, meta: [today, st.preparedBy ? 'إعداد: ' + st.preparedBy : '', `${items.length} برامج`].filter(Boolean) });
    slides.push({ kind: 'overview', title: 'نظرة عامة على البرامج', items, foot: 'تقرير شامل · ' + periodTxt });
    items.forEach((it) => {
      const foot = `${it.pr.short || it.pr.name} · ${W.periodLabel(it.period, cfg.year)}`;
      slides.push({ kind: 'progSummary', title: it.pr.name, sub: W.periodLabel(it.period, cfg.year), s: it.s, insights: W.insights(it.s), foot });
      slides.push({ kind: 'attention', title: `${it.pr.short || it.pr.name}: منشآت تحتاج متابعة`, s: it.s, recs: W.recommendations(it.s).slice(0, 3), foot });
    });
    return { name: `تقرير شامل - ${periodTxt}`, slides, stats: items.map((i) => i.s) };
  };

  /* ---------- HTML rendering ---------- */
  const pill = (st, t) => `<span class="s-pill ${st}">${esc(t || W.STATUS_LABEL[st])}</span>`;
  function head(sl) {
    const st = W.state.settings;
    return `<div class="s-head"><div><div class="s-kicker">${esc(st.orgName)}${st.deptName ? ' · ' + esc(st.deptName) : ''}</div><div class="s-title">${esc(sl.title)}</div>${sl.sub ? `<div class="s-kicker" style="color:${SC.accent}">${esc(sl.sub)}</div>` : ''}</div>${st.logo ? `<img class="s-logo" src="${st.logo}" alt="">` : ''}</div>`;
  }
  const foot = (sl, i, n) => `<div class="s-foot"><span>${esc(sl.foot || '')}</span><span class="num">${i + 1} / ${n}</span></div>`;
  function kpis(s) {
    const t = s.program.target;
    return `<div class="s-kpis">
      <div class="s-kpi ${W.status(s.avg, t)}"><span class="l">متوسط الامتثال</span><span class="v">${pct(s.avg)}</span><span class="d">المستهدف ${pct(t, 0)}${s.delta != null ? ' · ' + W.pts(s.delta) : ''}</span></div>
      <div class="s-kpi"><span class="l">المنشآت المُبلِّغة</span><span class="v">${s.reported}<span style="font-size:22px;color:${SC.ink2}"> / ${s.total}</span></span><span class="d">تغطية ${s.total ? pct(s.reported / s.total, 0) : '—'}</span></div>
      <div class="s-kpi good"><span class="l">محققة للمستهدف</span><span class="v">${s.good}</span><span class="d">${pct(s.meetPct, 0)} من المُبلِّغة</span></div>
      <div class="s-kpi bad"><span class="l">دون المستهدف / لم تُرفع</span><span class="v">${s.bad + s.warn}<span style="font-size:22px;color:${SC.ink2}"> / ${s.missing}</span></span><span class="d">${s.warn} قريبة من المستهدف</span></div></div>`;
  }
  const msgs = (list) => `<ul class="s-msgs">${list.map((m) => `<li class="${m.c}">${esc(m.t)}</li>`).join('')}</ul>`;

  function slideHTML(sl, i, n) {
    const st = W.state.settings;
    switch (sl.kind) {
      case 'cover':
        return `<div class="slide cover"><div class="cv-shape"></div>${st.logo ? `<img class="cv-logo" src="${st.logo}" alt="">` : ''}<div class="cv-inner">
          <div class="cv-org">${esc(st.orgName)}${st.deptName ? ' · ' + esc(st.deptName) : ''}</div><div class="cv-title">${esc(sl.title)}</div><div class="cv-sub">${esc(sl.sub)}</div>
          <div class="cv-meta">${sl.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div></div><div class="cv-band"></div></div>`;
      case 'summary':
        return `<div class="slide">${head(sl)}<div class="s-body">${kpis(sl.s)}<div class="s-card" style="flex:1"><h4>أبرز النتائج</h4>${msgs(sl.insights)}</div></div>${foot(sl, i, n)}</div>`;
      case 'facChart':
        return `<div class="slide">${head(sl)}<div class="s-body"><div class="s-chart" data-chart="fac" data-i="${i}"><canvas></canvas></div>
          <div class="s-note">الخط المتقطع يمثل المستهدف ${pct(sl.s.program.target, 0)} · الأخضر محقق · البرتقالي قريب (ضمن ${st.amberBand} نقاط) · الأحمر دون المستهدف</div></div>${foot(sl, i, n)}</div>`;
      case 'trendCat':
        return `<div class="slide">${head(sl)}<div class="s-cols"><div class="s-card"><h4>متوسط الامتثال عبر الفترات</h4><div class="s-chart" data-chart="trend" data-i="${i}"><canvas></canvas></div></div>
          <div class="s-card"><h4>المتوسط حسب الفئة</h4><div class="s-chart" data-chart="cat" data-i="${i}"><canvas></canvas></div></div></div>${foot(sl, i, n)}</div>`;
      case 'rank': {
        const li = (arr, f) => arr.length ? arr.map((r) => `<li><span>${esc(r.name)}</span>${f(r)}</li>`).join('') : `<li><span style="color:${SC.ink2}">لا يوجد</span></li>`;
        return `<div class="slide">${head(sl)}<div class="s-cols" style="grid-template-columns:repeat(2,1fr)">
          <div class="s-card"><h4>الأعلى أداءً</h4><ul class="s-rank">${li(sl.s.top, (r) => `<b style="color:${SC.good}">${pct(r.v)}</b>`)}</ul><h4 style="margin-top:8px">الأكثر تحسنًا</h4><ul class="s-rank">${li(sl.s.improved.slice(0, 3), (r) => `<b style="color:${SC.good}">${W.pts(r.delta)}</b>`)}</ul></div>
          <div class="s-card"><h4>الأدنى أداءً</h4><ul class="s-rank">${li(sl.s.bottom, (r) => pill(r.st, pct(r.v)))}</ul><h4 style="margin-top:8px">الأكثر تراجعًا</h4><ul class="s-rank">${li(sl.s.declined.slice(0, 3), (r) => `<b style="color:${SC.bad}">${W.pts(r.delta)}</b>`)}</ul></div></div>${foot(sl, i, n)}</div>`;
      }
      case 'table':
        return `<div class="slide">${head(sl)}<div class="s-body"><table class="s-table"><thead><tr><th>المنشأة</th><th>الفئة</th><th class="n">${esc(W.periodShort(sl.s.period))}</th><th class="n">${sl.s.prev ? esc(W.periodShort(sl.s.prev)) : 'السابقة'}</th><th class="n">التغير</th><th>الحالة</th>${sl.notes ? '<th>ملاحظات</th>' : ''}</tr></thead><tbody>
          ${sl.rows.map((r) => `<tr><td>${esc(r.name)}</td><td style="font-size:13px;color:${SC.ink2}">${esc(W.CATS[r.cat])}</td><td class="n"><b>${pct(r.v)}</b></td><td class="n" style="color:${SC.ink2}">${pct(r.prev)}</td><td class="n" style="color:${r.delta > 0 ? SC.good : r.delta < 0 ? SC.bad : SC.ink2}">${r.delta != null ? W.pts(r.delta).replace(' نقطة', '') : ''}</td><td>${pill(r.st)}</td>${sl.notes ? `<td style="font-size:13px">${esc(r.note)}</td>` : ''}</tr>`).join('')}
          </tbody></table></div>${foot(sl, i, n)}</div>`;
      case 'missing':
        return `<div class="slide">${head(sl)}<div class="s-body"><p style="font-size:18px;color:${SC.ink2}">هذه المنشآت لم تُرفع نتائجها لـ${esc(W.periodLabel(sl.s.period, sl.s.year))}، وتحتاج متابعة لاستكمال الرفع.</p>
          <div class="s-tags">${sl.rows.slice(0, 80).map((r) => `<span>${esc(r.name)}</span>`).join('')}${sl.rows.length > 80 ? `<span>و${sl.rows.length - 80} أخرى</span>` : ''}</div></div>${foot(sl, i, n)}</div>`;
      case 'recs':
        return `<div class="slide">${head(sl)}<div class="s-cols" style="grid-template-columns:${sl.notes.length ? '1.3fr 1fr' : '1fr'}"><div class="s-card"><h4>التوصيات</h4>${msgs(sl.recs.map((t) => ({ c: 'info', t })))}</div>
          ${sl.notes.length ? `<div class="s-card"><h4>الإجراءات المسجلة للمنشآت</h4><ul class="s-rank">${sl.notes.slice(0, 9).map((x) => `<li style="flex-direction:column;gap:2px"><b style="font-weight:600">${esc(x.name)}</b><span style="font-size:14px;color:${SC.ink2}">${esc(x.note)}</span></li>`).join('')}</ul></div>` : ''}</div>${foot(sl, i, n)}</div>`;
      case 'overview':
        return `<div class="slide">${head(sl)}<div class="s-body"><table class="s-table" style="font-size:17px"><thead><tr><th>البرنامج</th><th>الفترة</th><th class="n">المتوسط</th><th class="n">المستهدف</th><th class="n">المُبلِّغة</th><th class="n">محققة</th><th class="n">دون المستهدف</th><th>الحالة</th></tr></thead><tbody>
          ${sl.items.map((it) => `<tr><td><b>${esc(it.pr.name)}</b></td><td>${esc(W.periodLabel(it.period))}</td><td class="n"><b>${pct(it.s.avg)}</b></td><td class="n">${pct(it.pr.target, 0)}</td><td class="n">${it.s.reported}/${it.s.total}</td><td class="n" style="color:${SC.good}">${it.s.good}</td><td class="n" style="color:${SC.bad}">${it.s.bad + it.s.warn}</td><td>${pill(W.status(it.s.avg, it.pr.target), it.s.avg == null ? 'لا بيانات' : null)}</td></tr>`).join('')}
          </tbody></table><div class="s-chart" data-chart="overview" data-i="${i}" style="min-height:220px"><canvas></canvas></div></div>${foot(sl, i, n)}</div>`;
      case 'progSummary':
        return `<div class="slide">${head(sl)}<div class="s-body">${kpis(sl.s)}<div class="s-cols" style="grid-template-columns:1.2fr 1fr"><div class="s-card"><h4>أبرز النتائج</h4>${msgs(sl.insights.slice(0, 4))}</div><div class="s-card"><h4>الاتجاه</h4><div class="s-chart" data-chart="trend" data-i="${i}"><canvas></canvas></div></div></div></div>${foot(sl, i, n)}</div>`;
      case 'attention': {
        const low = sl.s.rows.filter((r) => r.st === 'bad' || r.st === 'warn').sort((a, b) => a.v - b.v).slice(0, 10);
        const miss = sl.s.rows.filter((r) => r.st === 'none');
        return `<div class="slide">${head(sl)}<div class="s-cols" style="grid-template-columns:1fr 1fr"><div class="s-card"><h4>دون المستهدف (${sl.s.bad + sl.s.warn})</h4><ul class="s-rank">${low.map((r) => `<li><span>${esc(r.name)}</span>${pill(r.st, pct(r.v))}</li>`).join('') || `<li><span style="color:${SC.good}">كل المنشآت المُبلِّغة حققت المستهدف</span></li>`}</ul></div>
          <div class="s-card"><h4>لم تُرفع (${miss.length})</h4><div class="s-tags">${miss.slice(0, 24).map((r) => `<span>${esc(r.name)}</span>`).join('') || `<span>لا يوجد</span>`}${miss.length > 24 ? `<span>و${miss.length - 24} أخرى</span>` : ''}</div><h4 style="margin-top:6px">التوصيات</h4>${msgs(sl.recs.map((t) => ({ c: 'info', t })))}</div></div>${foot(sl, i, n)}</div>`;
      }
    }
    return '';
  }

  /* ---------- slide charts (fixed light palette) ---------- */
  const stC = (st) => ({ good: SC.good, warn: SC.warn, bad: SC.bad, none: SC.none }[st]);
  const barLabels = {
    id: 'barLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart; ctx.save(); ctx.font = '600 13px ' + (W.css('--font') || 'sans-serif'); ctx.fillStyle = SC.ink;
      chart.data.datasets.forEach((ds, di) => chart.getDatasetMeta(di).data.forEach((el, j) => {
        const v = ds.data[j]; if (v == null || ds.type === 'line') return;
        const horiz = chart.options.indexAxis === 'y';
        const rev = horiz && chart.scales.x.options.reverse;
        ctx.textAlign = horiz ? (rev ? 'right' : 'left') : 'center'; ctx.textBaseline = horiz ? 'middle' : 'bottom';
        ctx.fillText(v + '%', horiz ? el.x + (rev ? -6 : 6) : el.x, horiz ? el.y : el.y - 4);
      }));
      ctx.restore();
    }
  };
  function slideChart(box, sl, deckCharts) {
    const kind = box.dataset.chart; const cv = $('canvas', box); const s = sl.s; const t = s ? s.program.target : null;
    const base = { responsive: true, maintainAspectRatio: false, animation: false, devicePixelRatio: 2, plugins: { legend: { display: false }, tooltip: { enabled: false } } };
    const pctAxis = (o) => Object.assign({ min: 0, max: 100, ticks: { callback: (v) => v + '%', color: SC.ink2, font: { size: 13 } }, grid: { color: SC.line } }, o || {});
    let cfg;
    if (kind === 'fac') {
      cfg = { type: 'bar', plugins: [W.targetLinePlugin, barLabels], data: { labels: sl.rows.map((r) => r.name), datasets: [{ data: sl.rows.map((r) => +(r.v * 100).toFixed(1)), backgroundColor: sl.rows.map((r) => stC(r.st)), borderRadius: 3, barPercentage: 0.75, categoryPercentage: 0.9 }] },
        options: Object.assign({}, base, { indexAxis: 'y', plugins: Object.assign({}, base.plugins, { targetLine: { value: t, axis: 'x', color: SC.accent } }), scales: { x: pctAxis({ max: 110, reverse: true, ticks: { callback: (v) => (v <= 100 ? v + '%' : ''), color: SC.ink2 } }), y: { position: 'right', ticks: { autoSkip: false, color: SC.ink, font: { size: 13 } }, grid: { display: false } } } }) };
    } else if (kind === 'trend') {
      const tr = s.trend;
      cfg = { type: 'line', plugins: [W.targetLinePlugin], data: { labels: tr.map((x) => x.label), datasets: [{ data: tr.map((x) => (x.avg == null ? null : +(x.avg * 100).toFixed(1))), borderColor: SC.primary, backgroundColor: 'rgba(14,111,104,.12)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: tr.map((x) => (x.p === s.period ? 7 : 4)), pointBackgroundColor: SC.primary, spanGaps: true }] },
        options: Object.assign({}, base, { plugins: Object.assign({}, base.plugins, { targetLine: { value: t, axis: 'y', color: SC.accent } }), scales: { y: pctAxis({ position: 'right', min: Math.max(0, Math.floor((Math.min(...tr.filter((x) => x.avg != null).map((x) => x.avg * 100), t * 100) - 10) / 10) * 10) }), x: { reverse: true, ticks: { color: SC.ink, font: { size: 13 } }, grid: { display: false } } } }) };
    } else if (kind === 'cat') {
      cfg = { type: 'bar', plugins: [W.targetLinePlugin, barLabels], data: { labels: s.byCat.map((c) => c.label), datasets: [{ data: s.byCat.map((c) => (c.avg == null ? null : +(c.avg * 100).toFixed(1))), backgroundColor: s.byCat.map((c) => stC(W.status(c.avg, t))), borderRadius: 4, barPercentage: 0.6 }] },
        options: Object.assign({}, base, { indexAxis: 'y', plugins: Object.assign({}, base.plugins, { targetLine: { value: t, axis: 'x', color: SC.accent } }), scales: { x: pctAxis({ max: 110, reverse: true, ticks: { callback: (v) => (v <= 100 ? v + '%' : ''), color: SC.ink2 } }), y: { position: 'right', ticks: { color: SC.ink, font: { size: 14 } }, grid: { display: false } } } }) };
    } else if (kind === 'overview') {
      const its = sl.items;
      cfg = { type: 'bar', plugins: [barLabels], data: { labels: its.map((x) => x.pr.short || x.pr.name), datasets: [
        { label: 'المتوسط', data: its.map((x) => (x.s.avg == null ? null : +(x.s.avg * 100).toFixed(1))), backgroundColor: its.map((x) => stC(W.status(x.s.avg, x.pr.target))), borderRadius: 4, barPercentage: 0.5 },
        { label: 'المستهدف', type: 'line', data: its.map((x) => +(x.pr.target * 100).toFixed(1)), borderColor: SC.accent, borderDash: [6, 4], pointRadius: 5, pointBackgroundColor: SC.accent, showLine: false }] },
        options: Object.assign({}, base, { scales: { y: pctAxis({ position: 'right', max: 110, ticks: { callback: (v) => (v <= 100 ? v + '%' : ''), color: SC.ink2 } }), x: { reverse: true, ticks: { color: SC.ink, font: { size: 14 } }, grid: { display: false } } } }) };
    }
    if (cfg) deckCharts.push(new Chart(cv, cfg));
  }

  // render a deck into container; returns {charts}
  W.renderDeck = (container, rep, opts) => {
    opts = opts || {};
    const n = rep.slides.length;
    container.innerHTML = rep.slides.map((sl, i) => `<div class="slide-frame" data-i="${i}">${slideHTML(sl, i, n)}</div>`).join('');
    const deckCharts = [];
    $$('.slide-frame', container).forEach((fr) => { const sl = rep.slides[+fr.dataset.i]; $$('[data-chart]', fr).forEach((b) => slideChart(b, sl, deckCharts)); });
    if (!opts.noScale) W.scaleSlides(container);
    return deckCharts;
  };
  W.scaleSlides = (container) => $$('.slide-frame', container).forEach((fr) => { const sl = $('.slide', fr); if (sl) sl.style.transform = `scale(${fr.clientWidth / 1280})`; });

  /* ---------- reports page ---------- */
  let previewCharts = [];
  W.currentReport = null;
  W.renderReports = (main) => {
    W.ensureUi();
    const S = W.state;
    if (!rc.pid || !W.prog(rc.pid)) rc.pid = W.ui.pid;
    if (!rc.year) rc.year = W.ui.year;
    const pr = W.prog(rc.pid);
    if (!pr) { main.innerHTML = '<div class="empty"><h2>لا توجد برامج</h2></div>'; return; }
    if (!rc.period || !W.viewPeriods(pr.freq).includes(rc.period)) rc.period = W.ui.pid === rc.pid && W.ui.period ? W.ui.period : W.latestPeriod(rc.pid, rc.year);
    if (!rc.refP) { const lp = W.latestPeriod(W.state.programs.find((p) => p.freq === 'Q')?.id || rc.pid, rc.year); rc.refP = lp && lp[0] === 'Q' ? lp : 'Q' + Math.ceil((new Date().getMonth() + 1) / 3); }
    const refOpts = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Y'].map((p) => `<option value="${p}"${p === rc.refP ? ' selected' : ''}>${W.periodLabel(p)}</option>`).join('');
    main.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">التقارير والعروض</div><h1>إنشاء تقرير جاهز للعرض</h1><p>اختر البرنامج والفترة، راجع الشرائح، ثم نزّلها بصيغة PowerPoint أو PDF أو Excel، أو اعرضها مباشرة بملء الشاشة.</p></div></div>
      <div class="panel stack">
        <div class="tabs" role="tablist" style="margin-bottom:0"><button type="button" data-rt="program" class="${rc.type === 'program' ? 'on' : ''}">تقرير برنامج</button><button type="button" data-rt="all" class="${rc.type === 'all' ? 'on' : ''}">تقرير شامل لكل البرامج</button></div>
        <div class="toolbar">
          ${rc.type === 'program' ? `<div class="field"><label for="rProg">البرنامج</label>${W.programSelect('rProg', rc.pid)}</div>` : ''}
          <div class="field"><label for="rYear">السنة</label>${W.yearSelect('rYear', rc.year)}</div>
          ${rc.type === 'program' ? `<div class="field"><label for="rPeriod">الفترة</label>${W.periodSelect('rPeriod', rc.pid, rc.period)}</div><div class="field"><label for="rCat">الفئة</label>${W.catSelect('rCat', rc.pid, rc.cat)}</div>`
            : `<div class="field"><label for="rRef">الفترة المرجعية</label><select id="rRef">${refOpts}</select></div>`}
        </div>
        ${rc.type === 'program' ? `<div class="row">
          <label class="switch"><input type="checkbox" data-inc="facChart" ${rc.inc.facChart ? 'checked' : ''}> رسم كل المنشآت</label>
          <label class="switch"><input type="checkbox" data-inc="table" ${rc.inc.table ? 'checked' : ''}> الجدول التفصيلي</label>
          <label class="switch"><input type="checkbox" data-inc="recs" ${rc.inc.recs ? 'checked' : ''}> التوصيات</label>
          <label class="switch"><input type="checkbox" data-inc="notes" ${rc.inc.notes ? 'checked' : ''}> الملاحظات والإجراءات</label></div>` : `<p class="muted small">البرامج الشهرية والربعية تُعرض للفترة المختارة، والبرامج نصف السنوية تُعرض للنصف الذي يحتويها.</p>`}
        <div class="row">
          <button type="button" class="btn accent" id="xPptx"><svg viewBox="0 0 24 24"><path d="M4 4h16v12H4zm7 14h2v2h4v2H7v-2h4z"/></svg>تنزيل PowerPoint</button>
          <button type="button" class="btn" id="xPdf"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>تنزيل PDF</button>
          <button type="button" class="btn soft" id="xXlsx"><svg viewBox="0 0 24 24"><path d="M4 3h16v18H4zm2 4v2h5V7zm7 0v2h5V7zm-7 4v2h5v-2zm7 0v2h5v-2zm-7 4v2h5v-2zm7 0v2h5v-2z"/></svg>تنزيل Excel</button>
          <button type="button" class="btn ghost" id="xShow"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>عرض بملء الشاشة</button>
          <span class="muted small" id="xStatus"></span>
        </div>
      </div>
      <div class="deck" id="deck" style="margin-top:18px"></div>`;
    $$('[data-rt]', main).forEach((b) => (b.onclick = () => { rc.type = b.dataset.rt; W.route(); }));
    if ($('#rProg')) $('#rProg').onchange = (e) => { rc.pid = e.target.value; rc.period = null; rc.cat = 'all'; W.route(); };
    $('#rYear').onchange = (e) => { rc.year = +e.target.value; rc.period = null; W.route(); };
    if ($('#rPeriod')) $('#rPeriod').onchange = (e) => { rc.period = e.target.value; W.route(); };
    if ($('#rCat')) $('#rCat').onchange = (e) => { rc.cat = e.target.value; W.route(); };
    if ($('#rRef')) $('#rRef').onchange = (e) => { rc.refP = e.target.value; W.route(); };
    $$('[data-inc]', main).forEach((c) => (c.onchange = () => { rc.inc[c.dataset.inc] = c.checked; W.route(); }));

    previewCharts.forEach((c) => c.destroy());
    const rep = (W.currentReport = W.buildReport(rc));
    previewCharts = W.renderDeck($('#deck'), rep);
    const busy = async (btn, fn) => {
      const all = $$('#xPptx,#xPdf,#xXlsx'); all.forEach((b) => (b.disabled = true)); $('#xStatus').textContent = 'جارٍ التجهيز…';
      try { await fn(); $('#xStatus').textContent = 'تم التنزيل'; } catch (e) { console.error(e); W.toast('تعذّر التصدير: ' + e.message, true); $('#xStatus').textContent = ''; }
      finally { all.forEach((b) => (b.disabled = false)); }
    };
    $('#xPptx').onclick = (e) => busy(e.currentTarget, () => W.exportPptx(rep));
    $('#xPdf').onclick = (e) => busy(e.currentTarget, () => W.exportPdf(rep));
    $('#xXlsx').onclick = (e) => busy(e.currentTarget, () => W.exportXlsx(rep, rc));
    $('#xShow').onclick = () => W.present(rep);
  };

  /* ---------- presenter ---------- */
  let pIdx = 0, pRep = null, pCharts = [];
  function fitPresenter() {
    const stage = $('#presenterStage'); const fr = $('.slide-frame:not([hidden])', stage); if (!fr) return;
    const w = Math.min(stage.clientWidth, (stage.clientHeight * 16) / 9); fr.style.width = w + 'px'; W.scaleSlides(stage);
  }
  function showSlide(i) {
    const frames = $$('#presenterStage .slide-frame'); pIdx = Math.max(0, Math.min(frames.length - 1, i));
    frames.forEach((f, j) => (f.hidden = j !== pIdx)); $('#pCount').textContent = `${pIdx + 1} / ${frames.length}`; fitPresenter();
  }
  W.present = (rep) => {
    pRep = rep; const p = $('#presenter'); p.hidden = false;
    pCharts.forEach((c) => c.destroy()); pCharts = W.renderDeck($('#presenterStage'), rep, { noScale: true });
    showSlide(0); try { p.requestFullscreen && p.requestFullscreen().catch(() => {}); } catch (e) {}
  };
  function closePresenter() { $('#presenter').hidden = true; pCharts.forEach((c) => c.destroy()); pCharts = []; $('#presenterStage').innerHTML = ''; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
  document.addEventListener('DOMContentLoaded', () => {
    $('#pNext').onclick = () => showSlide(pIdx + 1); $('#pPrev').onclick = () => showSlide(pIdx - 1); $('#pClose').onclick = closePresenter;
    $('#presenterStage').addEventListener('click', (e) => showSlide(pIdx + (e.clientX < window.innerWidth / 2 ? 1 : -1)));
    document.addEventListener('keydown', (e) => {
      if ($('#presenter').hidden) return;
      if (['ArrowLeft', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); showSlide(pIdx + 1); }
      if (['ArrowRight', 'PageUp'].includes(e.key)) { e.preventDefault(); showSlide(pIdx - 1); }
      if (e.key === 'Escape') closePresenter();
    });
    window.addEventListener('resize', () => { if (!$('#presenter').hidden) fitPresenter(); else if ($('#deck')) W.scaleSlides($('#deck')); });
  });
})();
