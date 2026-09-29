/* views.js — dashboard, import, entry, facility profile, settings */
(function () {
  'use strict';
  const W = window.W; const { $, $$, esc, pct } = W;
  const charts = [];
  W.destroyCharts = () => { while (charts.length) { try { charts.pop().destroy(); } catch (e) {} } };
  W.css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const ui = (W.ui = W.ui || { pid: null, year: null, period: null, cat: 'all' });
  function ensureUi() {
    const S = W.state;
    if (!ui.pid || !W.prog(ui.pid)) ui.pid = (S.programs.find((p) => (S.facilities[p.id] || []).length) || S.programs[0] || {}).id;
    if (!ui.year) ui.year = S.settings.year;
    const pr = W.prog(ui.pid);
    if (pr && (!ui.period || !W.viewPeriods(pr.freq).includes(ui.period))) ui.period = W.latestPeriod(ui.pid, ui.year);
  }
  W.ensureUi = ensureUi;
  const hasAnyData = () => Object.values(W.state.facilities).some((l) => l && l.length);

  /* ---------- shared controls ---------- */
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;
  W.programSelect = (id, sel) => `<select id="${id}">${W.state.programs.map((p) => opt(p.id, p.short || p.name, sel)).join('')}</select>`;
  W.yearSelect = (id, sel) => `<select id="${id}">${W.years().map((y) => opt(y, y, sel)).join('')}</select>`;
  W.periodSelect = (id, pid, sel, baseOnly) => {
    const pr = W.prog(pid); if (!pr) return `<select id="${id}"></select>`;
    const ps = baseOnly ? W.FREQ[pr.freq].base : W.viewPeriods(pr.freq);
    const base = W.FREQ[pr.freq].base;
    const g1 = ps.filter((p) => base.includes(p)).map((p) => opt(p, W.periodLabel(p), sel)).join('');
    const g2 = ps.filter((p) => !base.includes(p)).map((p) => opt(p, W.periodLabel(p) + ' (مجمّع)', sel)).join('');
    return `<select id="${id}">${g2 ? `<optgroup label="${esc(W.FREQ[pr.freq].label)}">${g1}</optgroup><optgroup label="فترات مجمّعة">${g2}</optgroup>` : g1}</select>`;
  };
  W.catSelect = (id, pid, sel) => `<select id="${id}">${opt('all', 'كل الفئات', sel)}${W.programCats(pid).map((c) => opt(c, W.CATS[c], sel)).join('')}</select>`;
  const emptyState = (title, text, btn) => `<div class="empty"><svg viewBox="0 0 24 24"><path d="M12 3l5 5h-3v6h-4V8H7zM5 17h14v3H5z"/></svg><h2>${esc(title)}</h2><p>${esc(text)}</p>${btn || ''}</div>`;

  /* ================= DASHBOARD ================= */
  W.renderDashboard = (main) => {
    ensureUi();
    if (!hasAnyData()) {
      main.innerHTML = `<div class="page-head"><div><div class="eyebrow">لوحة المتابعة</div><h1>ابدأ برفع ملف التراكر</h1></div></div>` +
        emptyState('لا توجد بيانات بعد', 'ارفع ملف الإكسل الشهري (Tracker for Self-assessment) وستتعرف المنصة على البرامج والمنشآت والفترات تلقائيًا، ثم تظهر النتائج هنا.', '<a class="btn" href="#import">رفع ملف الإكسل</a>');
      return;
    }
    const S = W.state; const pr = W.prog(ui.pid);
    const s = W.stats(ui.pid, ui.year, ui.period, ui.cat);
    const strip = S.programs.map((p) => {
      const lp = W.latestPeriod(p.id, ui.year); const st = W.stats(p.id, ui.year, lp, 'all');
      const status = W.status(st.avg, p.target);
      return `<button type="button" class="prog${p.id === ui.pid ? ' on' : ''}" data-pid="${p.id}">
        <div class="p-top"><span class="p-name">${esc(p.short || p.name)}</span><span class="freq">${W.FREQ[p.freq].label}</span></div>
        <div class="p-top"><span class="p-val">${pct(st.avg)}</span>${W.chip(status, status === 'none' ? 'لا بيانات' : W.STATUS_LABEL[status])}</div>
        <div class="meter"><i style="width:${st.total ? Math.round((st.reported / st.total) * 100) : 0}%"></i></div>
        <span class="p-meta">${W.periodLabel(lp)} · رفعت ${st.reported} من ${st.total} منشأة</span></button>`;
    }).join('');
    const d = s.delta;
    main.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">لوحة المتابعة · ${ui.year}</div><h1>${esc(pr.name)}</h1><p>المستهدف ${pct(pr.target, 0)} · ${W.FREQ[pr.freq].label} · ${s.total} منشأة</p></div>
        <div class="toolbar">
          <div class="field"><label for="dYear">السنة</label>${W.yearSelect('dYear', ui.year)}</div>
          <div class="field"><label for="dPeriod">الفترة</label>${W.periodSelect('dPeriod', ui.pid, ui.period)}</div>
          <div class="field"><label for="dCat">الفئة</label>${W.catSelect('dCat', ui.pid, ui.cat)}</div>
          <a class="btn" href="#reports" id="toReport"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>إنشاء تقرير</a>
        </div>
      </div>
      <div class="programs">${strip}</div>
      <div class="kpis">
        <div class="kpi ${W.status(s.avg, pr.target)}"><span class="k-lbl">متوسط الامتثال</span><span class="k-val">${pct(s.avg)}</span><span class="k-sub">${d != null ? `<span class="delta ${d >= 0 ? 'up' : 'down'}">${W.pts(d)}</span> عن ${W.periodLabel(s.prev)}` : 'المستهدف ' + pct(pr.target, 0)}</span></div>
        <div class="kpi"><span class="k-lbl">المنشآت المُبلِّغة</span><span class="k-val">${s.reported}<small class="muted" style="font-size:1rem"> / ${s.total}</small></span><span class="k-sub">تغطية ${s.total ? pct(s.reported / s.total, 0) : '—'}</span></div>
        <div class="kpi good"><span class="k-lbl">محققة للمستهدف</span><span class="k-val">${s.good}</span><span class="k-sub">${pct(s.meetPct, 0)} من المُبلِّغة</span></div>
        <div class="kpi bad"><span class="k-lbl">دون المستهدف</span><span class="k-val">${s.bad + s.warn}</span><span class="k-sub">${s.warn} قريبة · ${s.bad} بعيدة</span></div>
        <div class="kpi warn"><span class="k-lbl">لم تُرفع</span><span class="k-val">${s.missing}</span><span class="k-sub">تحتاج متابعة</span></div>
      </div>
      <div class="grid g-main">
        <div class="panel"><div class="panel-head"><h2>النتائج حسب المنشأة</h2><span class="muted small">مرتبة من الأعلى · الخط المتقطع = المستهدف</span></div>
          <div class="chart-scroll"><div style="position:relative;height:${Math.max(260, s.reported * 24 + 40)}px"><canvas id="cFac"></canvas></div></div></div>
        <div class="stack">
          <div class="panel"><div class="panel-head"><h2>الاتجاه خلال ${ui.year}</h2></div><div class="chart-box" style="height:220px"><canvas id="cTrend"></canvas></div></div>
          <div class="panel"><div class="panel-head"><h2>حسب الفئة</h2></div><div class="chart-box" style="height:${Math.max(140, s.byCat.length * 44)}px"><canvas id="cCat"></canvas></div></div>
        </div>
      </div>
      <div class="grid g3" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><h2>الأعلى أداءً</h2></div><ul class="rank">${s.top.map((r) => `<li><span>${esc(r.name)}</span><b class="num">${pct(r.v)}</b></li>`).join('') || '<li class="muted">—</li>'}</ul></div>
        <div class="panel"><div class="panel-head"><h2>الأدنى أداءً</h2></div><ul class="rank">${s.bottom.map((r) => `<li><span>${esc(r.name)}</span>${W.chip(r.st, pct(r.v))}</li>`).join('') || '<li class="muted">—</li>'}</ul></div>
        <div class="panel"><div class="panel-head"><h2>لم تُرفع (${s.missing})</h2><a class="btn sm ghost" href="#entry">إدخال يدوي</a></div><ul class="rank">${s.rows.filter((r) => r.st === 'none').slice(0, 12).map((r) => `<li><span>${esc(r.name)}</span><span class="tag">${esc(W.CATS[r.cat])}</span></li>`).join('') || '<li class="muted">كل المنشآت رفعت نتائجها</li>'}${s.missing > 12 ? `<li class="muted">و${s.missing - 12} أخرى</li>` : ''}</ul></div>
      </div>
      <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>الجدول التفصيلي</h2><input type="search" id="dSearch" placeholder="بحث عن منشأة…" aria-label="بحث"></div>
        <div class="tbl-wrap"><table><thead><tr><th>المنشأة</th><th>الفئة</th><th class="n">${esc(W.periodLabel(ui.period))}</th><th class="n">${s.prev ? esc(W.periodLabel(s.prev)) : 'السابقة'}</th><th class="n">التغير</th><th>الحالة</th><th>ملاحظات / إجراءات</th></tr></thead>
        <tbody id="dRows">${s.rows.sort((a, b) => (b.v ?? -1) - (a.v ?? -1)).map((r) => `<tr data-s="${esc((r.name + ' ' + r.en).toLowerCase())}"><td><span class="fac-name">${esc(r.name)}</span>${r.en && r.en !== r.name ? `<span class="fac-en">${esc(r.en)}</span>` : ''}</td><td><span class="tag">${esc(W.CATS[r.cat])}</span></td><td class="n"><b>${pct(r.v)}</b></td><td class="n muted">${pct(r.prev)}</td><td class="n"><span class="delta ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}">${r.delta != null ? W.pts(r.delta).replace(' نقطة', '') : ''}</span></td><td>${W.chip(r.st)}</td><td class="small muted">${esc(r.note)}</td></tr>`).join('')}</tbody></table></div></div>`;

    $$('.prog', main).forEach((b) => b.addEventListener('click', () => { ui.pid = b.dataset.pid; ui.period = null; ui.cat = 'all'; W.route(); }));
    $('#dYear').onchange = (e) => { ui.year = +e.target.value; ui.period = null; W.route(); };
    $('#dPeriod').onchange = (e) => { ui.period = e.target.value; W.route(); };
    $('#dCat').onchange = (e) => { ui.cat = e.target.value; W.route(); };
    $('#dSearch').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('#dRows tr').forEach((tr) => (tr.hidden = q && !tr.dataset.s.includes(q))); };
    drawDashCharts(s);
  };

  function statusColor(st) { return { good: W.css('--good'), warn: W.css('--warn'), bad: W.css('--bad'), none: W.css('--none') }[st]; }
  const targetLine = {
    id: 'targetLine',
    afterDatasetsDraw(chart, args, o) {
      if (o == null || o.value == null) return;
      const { ctx, chartArea: a, scales } = chart; const sc = o.axis === 'x' ? scales.x : scales.y; const px = sc.getPixelForValue(o.value * 100);
      ctx.save(); ctx.strokeStyle = o.color; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.beginPath();
      if (o.axis === 'x') { ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); } else { ctx.moveTo(a.left, px); ctx.lineTo(a.right, px); }
      ctx.stroke(); ctx.restore();
    }
  };
  W.targetLinePlugin = targetLine;
  W.chartDefaults = (ink, grid) => {
    Chart.defaults.font.family = W.css('--font') || 'sans-serif';
    Chart.defaults.color = ink; Chart.defaults.borderColor = grid;
  };
  function drawDashCharts(s) {
    W.destroyCharts();
    const ink = W.css('--ink-2'), grid = W.css('--line'), accent = W.css('--accent');
    W.chartDefaults(ink, grid);
    const rep = s.rows.filter((r) => r.v != null).sort((a, b) => b.v - a.v);
    const pctTick = { callback: (v) => v + '%' };
    charts.push(new Chart($('#cFac'), {
      type: 'bar', plugins: [targetLine],
      data: { labels: rep.map((r) => r.name), datasets: [{ data: rep.map((r) => +(r.v * 100).toFixed(1)), backgroundColor: rep.map((r) => statusColor(r.st)), borderRadius: 4, barThickness: 14 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, targetLine: { value: s.program.target, axis: 'x', color: accent }, tooltip: { rtl: true, callbacks: { label: (c) => c.raw + '%' } } },
        scales: { x: { min: 0, max: 100, reverse: true, position: 'top', ticks: pctTick, grid: { color: grid } }, y: { position: 'right', ticks: { autoSkip: false, font: { size: 12 } }, grid: { display: false } } } }
    }));
    charts.push(new Chart($('#cTrend'), {
      type: 'line', plugins: [targetLine],
      data: { labels: s.trend.map((t) => t.label), datasets: [{ data: s.trend.map((t) => (t.avg == null ? null : +(t.avg * 100).toFixed(1))), borderColor: W.css('--primary'), backgroundColor: W.css('--primary-soft'), fill: true, tension: 0.3, pointRadius: s.trend.map((t) => (t.p === s.period ? 6 : 3)), pointBackgroundColor: W.css('--primary'), spanGaps: true }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, targetLine: { value: s.program.target, axis: 'y', color: accent } }, scales: { y: { position: 'right', suggestedMin: 50, max: 100, ticks: pctTick, grid: { color: grid } }, x: { reverse: true, grid: { display: false } } } }
    }));
    charts.push(new Chart($('#cCat'), {
      type: 'bar', plugins: [targetLine],
      data: { labels: s.byCat.map((c) => c.label), datasets: [{ data: s.byCat.map((c) => (c.avg == null ? null : +(c.avg * 100).toFixed(1))), backgroundColor: s.byCat.map((c) => statusColor(W.status(c.avg, s.program.target))), borderRadius: 4, barThickness: 18 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, targetLine: { value: s.program.target, axis: 'x', color: accent } }, scales: { x: { min: 0, max: 100, reverse: true, ticks: pctTick, grid: { color: grid } }, y: { position: 'right', grid: { display: false } } } }
    }));
  }

  /* ================= IMPORT ================= */
  let pending = null;
  W.renderImport = (main) => {
    const S = W.state;
    main.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">رفع ملف الإكسل</div><h1>تحديث النتائج من ملف التراكر</h1>
        <p>ارفع الملف كما هو كل شهر. المنصة تقرأ كل ورقة، وتتعرف على البرنامج والفترات والمنشآت، وتنظّف القيم (مثل «75٫00%» أو 86.67) قبل الحفظ. الملف لا يغادر جهازك.</p></div></div>
      <label class="drop" id="drop" for="file"><svg viewBox="0 0 24 24"><path d="M12 3l5 5h-3v6h-4V8H7zM5 17h14v3H5z"/></svg>
        <strong>اسحب الملف هنا أو اضغط للاختيار</strong><span class="muted small">xlsx · xls · csv</span>
        <input type="file" id="file" accept=".xlsx,.xls,.xlsm,.csv" hidden></label>
      <div id="preview" class="stack" style="margin-top:18px"></div>
      <div class="panel" style="margin-top:18px"><div class="panel-head"><h2>سجل الاستيراد</h2></div>
        ${S.imports.length ? `<div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>الملف</th><th>ما تم تحديثه</th></tr></thead><tbody>${S.imports.map((i) => `<tr><td class="num">${esc(new Date(i.date).toLocaleString('en-GB'))}</td><td>${esc(i.file)}</td><td class="small">${i.summary.map((x) => `${esc(x.program)} ${x.year}: ${x.values} قيمة${x.added ? ` · ${x.added} منشأة جديدة` : ''}`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">لم يتم استيراد أي ملف بعد.</p>'}
      </div>`;
    const drop = $('#drop'); const input = $('#file');
    input.onchange = () => input.files[0] && handleFile(input.files[0]);
    ['dragenter', 'dragover'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (ev) => { const f = ev.dataTransfer.files[0]; if (f) handleFile(f); });
    if (pending) renderPreview();
  };
  async function handleFile(file) {
    try { pending = await W.readWorkbook(file); renderPreview(); }
    catch (e) { console.error(e); W.toast('تعذّرت قراءة الملف: ' + e.message, true); }
  }
  W._handleFile = handleFile;
  function renderPreview() {
    const box = $('#preview'); if (!box || !pending) return;
    const progOpts = (sel) => `<option value="">— تجاهل هذه الورقة —</option>` + W.state.programs.map((p) => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.short || p.name)} (${W.FREQ[p.freq].label})</option>`).join('') + `<option value="new">+ برنامج جديد من هذه الورقة</option>`;
    box.innerHTML = `<div class="panel-head"><h2>معاينة: ${esc(pending.fileName)}</h2><span class="muted small">${pending.sheets.filter((s) => s.ok).length} ورقة قابلة للاستيراد</span></div>` +
      pending.sheets.map((s, i) => s.ok ? `
      <div class="sheet-card" data-i="${i}">
        <div class="row" style="justify-content:space-between"><div><h3>${esc(s.sheetName.trim())}</h3><span class="muted small">${esc(s.title)} · ${W.FREQ[s.freq].label} · ${s.records.length} منشأة · ${s.values} قيمة · الفترات: ${s.periods.map(W.periodShort).join('، ')}</span></div>
          ${s.programId ? W.chip('good', 'تم التعرف على البرنامج') : W.chip('warn', 'غير معروف')}</div>
        <div class="set-grid">
          <div class="field"><label for="ip${i}">البرنامج</label><select id="ip${i}" data-k="programId">${progOpts(s.programId)}</select></div>
          <div class="field"><label for="iy${i}">السنة</label><input type="number" id="iy${i}" data-k="year" value="${s.year}" min="2020" max="2100"></div>
          <div class="field"><label for="im${i}">طريقة التحديث</label><select id="im${i}" data-k="mode"><option value="replace">استبدال بيانات هذه السنة بالملف (مستحسن للتراكر التراكمي)</option><option value="merge">دمج: تحديث القيم الموجودة في الملف فقط</option></select></div>
        </div>
        ${s.warnings.length ? `<details><summary>ملاحظات التنظيف (${s.warnings.length})</summary><ul class="warnlist">${s.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
      </div>` : `<div class="sheet-card skip"><h3>${esc(s.sheetName.trim())}</h3><span class="muted small">تم تجاهلها: ${esc(s.reason)}</span></div>`).join('') +
      `<div class="row"><button type="button" class="btn" id="doImport">اعتماد الاستيراد</button><button type="button" class="btn ghost" id="cancelImport">إلغاء</button></div>`;
    $('#cancelImport').onclick = () => { pending = null; W.route(); };
    $('#doImport').onclick = () => {
      const plan = $$('.sheet-card[data-i]', box).map((c) => {
        const s = pending.sheets[+c.dataset.i];
        return { sheet: s, programId: $('[data-k=programId]', c).value, year: +$('[data-k=year]', c).value || s.year, mode: $('[data-k=mode]', c).value };
      });
      const sum = W.applyImport(pending.fileName, plan);
      pending = null;
      W.toast(`تم الاستيراد: ${sum.reduce((a, x) => a + x.values, 0)} قيمة في ${sum.length} برامج`);
      ui.period = null; if (sum[0]) ui.year = sum[0].year;
      W.state.settings.year = ui.year; W.save();
      location.hash = '#dashboard'; W.route();
    };
  }

  /* ================= MANUAL ENTRY ================= */
  W.renderEntry = (main) => {
    ensureUi();
    const pr = W.prog(ui.pid); if (!pr) { main.innerHTML = emptyState('لا توجد برامج', 'أضف برنامجًا من الإعدادات أولاً.'); return; }
    const base = W.FREQ[pr.freq].base;
    if (!base.includes(ui.period)) ui.period = W.latestPeriod(ui.pid, ui.year);
    const keys = W.programFacilities(ui.pid, ui.cat);
    main.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">إدخال النتائج</div><h1>${esc(pr.name)}</h1><p>اكتب النسبة المئوية (مثال 85). يُحفظ كل تعديل تلقائيًا. الملاحظات والإجراءات تظهر في التقارير.</p></div>
        <div class="toolbar">
          <div class="field"><label for="eProg">البرنامج</label>${W.programSelect('eProg', ui.pid)}</div>
          <div class="field"><label for="eYear">السنة</label>${W.yearSelect('eYear', ui.year)}</div>
          <div class="field"><label for="ePeriod">الفترة</label>${W.periodSelect('ePeriod', ui.pid, ui.period, true)}</div>
          <div class="field"><label for="eCat">الفئة</label>${W.catSelect('eCat', ui.pid, ui.cat)}</div>
        </div></div>
      <div class="panel"><div class="panel-head"><input type="search" id="eSearch" placeholder="بحث عن منشأة…" aria-label="بحث"><div class="row"><button type="button" class="btn ghost sm" id="eAdd">+ إضافة منشأة للبرنامج</button></div></div>
      ${keys.length ? `<div class="tbl-wrap"><table><thead><tr><th>المنشأة</th><th>الفئة</th><th class="n">النسبة %</th><th>الحالة</th><th>ملاحظات / إجراءات تصحيحية</th></tr></thead><tbody id="eRows">
      ${keys.map((k) => { const v = W.rawVal(ui.pid, ui.year, ui.period, k); const st = W.status(W.val(ui.pid, ui.year, ui.period, k), pr.target);
        return `<tr data-k="${esc(k)}" data-s="${esc((W.facName(k) + ' ' + W.fac(k).en).toLowerCase())}"><td><span class="fac-name">${esc(W.facName(k))}</span><span class="fac-en">${esc(W.fac(k).en)}</span></td><td><span class="tag">${esc(W.CATS[W.facCat(k)])}</span></td>
        <td class="n"><input type="number" min="0" max="100" step="0.01" inputmode="decimal" aria-label="النسبة" value="${v == null ? '' : +(v * 100).toFixed(2)}"></td><td class="st">${W.chip(st)}</td>
        <td><input type="text" aria-label="ملاحظات" value="${esc(W.getNote(ui.pid, ui.year, ui.period, k))}" placeholder="مثال: زيارة ميدانية وتدريب 12/9"></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="muted">لا توجد منشآت في هذا البرنامج. ارفع ملف الإكسل أو أضف منشأة.</p>'}
      <div id="addBox" hidden style="margin-top:14px" class="set-grid">
        <div class="field"><label for="nfEn">الاسم بالإنجليزية</label><input type="text" id="nfEn"></div>
        <div class="field"><label for="nfAr">الاسم بالعربية</label><input type="text" id="nfAr"></div>
        <div class="field"><label for="nfCat">الفئة</label><select id="nfCat">${Object.entries(W.CATS).map(([k, v]) => opt(k, v, pr.defCat)).join('')}</select></div>
        <div class="field"><span class="lbl">&nbsp;</span><button type="button" class="btn" id="nfSave">حفظ المنشأة</button></div>
      </div></div>`;
    $('#eProg').onchange = (e) => { ui.pid = e.target.value; ui.period = null; ui.cat = 'all'; W.route(); };
    $('#eYear').onchange = (e) => { ui.year = +e.target.value; W.route(); };
    $('#ePeriod').onchange = (e) => { ui.period = e.target.value; W.route(); };
    $('#eCat').onchange = (e) => { ui.cat = e.target.value; W.route(); };
    $('#eSearch').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('#eRows tr').forEach((tr) => (tr.hidden = q && !tr.dataset.s.includes(q))); };
    $('#eAdd').onclick = () => { $('#addBox').hidden = !$('#addBox').hidden; };
    $('#nfSave').onclick = () => {
      const en = $('#nfEn').value.trim(), ar = $('#nfAr').value.trim(); if (!en && !ar) { W.toast('اكتب اسم المنشأة', true); return; }
      const key = W.canonKey(en || ar); if (!W.state.directory[key]) W.state.directory[key] = { en: en || ar, ar, cat: $('#nfCat').value };
      const l = (W.state.facilities[ui.pid] = W.state.facilities[ui.pid] || []); if (!l.includes(key)) l.push(key);
      W.save(); W.toast('تمت إضافة المنشأة'); W.route();
    };
    $$('#eRows tr').forEach((tr) => {
      const k = tr.dataset.k; const [num, note] = $$('input', tr);
      num.addEventListener('change', () => {
        const t = num.value.trim(); let v = t === '' ? null : parseFloat(t.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace('٫', '.'));
        if (v != null && (isNaN(v) || v < 0 || v > 100)) { W.toast('أدخل رقمًا بين 0 و100', true); num.focus(); return; }
        W.setVal(ui.pid, ui.year, ui.period, k, v == null ? null : v / 100); W.save();
        $('.st', tr).innerHTML = W.chip(W.status(W.val(ui.pid, ui.year, ui.period, k), pr.target)); W.toast('تم الحفظ');
      });
      note.addEventListener('change', () => { W.setNote(ui.pid, ui.year, ui.period, k, note.value.trim()); W.save(); W.toast('تم حفظ الملاحظة'); });
    });
  };

  /* ================= FACILITY PROFILE ================= */
  W.renderFacilities = (main) => {
    ensureUi();
    const S = W.state; const all = Object.keys(S.directory).filter((k) => Object.values(S.facilities).some((l) => l.includes(k)));
    if (!all.length) { main.innerHTML = emptyState('لا توجد منشآت بعد', 'ارفع ملف الإكسل أولاً.', '<a class="btn" href="#import">رفع ملف الإكسل</a>'); return; }
    all.sort((a, b) => W.facName(a).localeCompare(W.facName(b), 'ar'));
    if (!ui.fac || !all.includes(ui.fac)) ui.fac = all[0];
    const k = ui.fac; const progs = S.programs.filter((p) => (S.facilities[p.id] || []).includes(k));
    const cols = W.MONTHS.map((_, i) => 'M' + String(i + 1).padStart(2, '0'));
    const cell = (p, per) => { const v = W.val(p.id, ui.year, per, k); return `<span class="heat ${W.status(v, p.target)}">${v == null ? '·' : pct(v, 0)}</span>`; };
    main.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">ملف المنشأة · ${ui.year}</div><h1>${esc(W.facName(k))}</h1><p>${esc(W.fac(k).en)} · ${esc(W.CATS[W.facCat(k)])} · مشاركة في ${progs.length} برامج</p></div>
        <div class="toolbar"><div class="field"><label for="fSel">المنشأة</label><select id="fSel">${all.map((x) => opt(x, W.facName(x), k)).join('')}</select></div>
        <div class="field"><label for="fYear">السنة</label>${W.yearSelect('fYear', ui.year)}</div></div></div>
      <div class="panel"><div class="panel-head"><h2>خريطة الأداء عبر البرامج</h2><span class="muted small">الأخضر محقق · البرتقالي قريب · الأحمر دون المستهدف</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>البرنامج</th><th class="n">المستهدف</th>${cols.map((c) => `<th class="n">${W.periodShort(c)}</th>`).join('')}<th class="n">Q1</th><th class="n">Q2</th><th class="n">Q3</th><th class="n">Q4</th><th class="n">السنة</th></tr></thead>
      <tbody>${progs.map((p) => `<tr><td style="white-space:nowrap"><b>${esc(p.short || p.name)}</b></td><td class="n">${pct(p.target, 0)}</td>${cols.map((c) => `<td class="n">${p.freq === 'M' ? cell(p, c) : ''}</td>`).join('')}${['Q1', 'Q2', 'Q3', 'Q4'].map((q) => `<td class="n">${p.freq === 'H' ? '' : cell(p, q)}</td>`).join('')}<td class="n">${cell(p, 'Y')}</td></tr>`).join('')}</tbody></table></div>
      ${progs.filter((p) => p.freq === 'H').map((p) => `<p class="small muted" style="margin-top:10px">${esc(p.short)}: النصف الأول ${pct(W.val(p.id, ui.year, 'H1', k))} · النصف الثاني ${pct(W.val(p.id, ui.year, 'H2', k))}</p>`).join('')}</div>
      <div class="panel" style="margin-top:16px"><div class="panel-head"><h2>الملاحظات والإجراءات المسجلة</h2></div>${(() => {
        const items = []; progs.forEach((p) => Object.entries((S.notes[p.id] || {})[ui.year] || {}).forEach(([per, m]) => m[k] && items.push(`<li><span><b>${esc(p.short)}</b> · ${W.periodLabel(per)}: ${esc(m[k])}</span></li>`)));
        return items.length ? `<ul class="rank">${items.join('')}</ul>` : '<p class="muted">لا توجد ملاحظات لهذه السنة.</p>'; })()}</div>`;
    $('#fSel').onchange = (e) => { ui.fac = e.target.value; W.route(); };
    $('#fYear').onchange = (e) => { ui.year = +e.target.value; W.route(); };
  };

  /* ================= SETTINGS ================= */
  let setTab = 'general';
  W.renderSettings = (main) => {
    const S = W.state; const st = S.settings;
    const tabs = [['general', 'الجهة والتقارير'], ['programs', 'البرامج'], ['facilities', 'المنشآت'], ['data', 'البيانات والنسخ الاحتياطي']];
    main.innerHTML = `<div class="page-head"><div><div class="eyebrow">الإعدادات</div><h1>تحكّم كامل في المنصة</h1><p>عدّل بيانات الجهة، والبرامج ومستهدفاتها، وأسماء المنشآت وفئاتها، واحتفظ بنسخة احتياطية من بياناتك.</p></div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="${k === setTab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="setBody"></div>`;
    $$('[data-tab]', main).forEach((b) => (b.onclick = () => { setTab = b.dataset.tab; W.route(); }));
    const body = $('#setBody');
    if (setTab === 'general') {
      body.innerHTML = `<div class="panel stack">
        <div class="set-grid">
          <div class="field"><label for="sOrg">اسم الجهة</label><input type="text" id="sOrg" value="${esc(st.orgName)}"></div>
          <div class="field"><label for="sDept">المنطقة / الإدارة</label><input type="text" id="sDept" value="${esc(st.deptName)}"></div>
          <div class="field"><label for="sTitle">عنوان التقارير</label><input type="text" id="sTitle" value="${esc(st.reportTitle)}"></div>
          <div class="field"><label for="sBy">إعداد</label><input type="text" id="sBy" value="${esc(st.preparedBy)}" placeholder="الاسم والمسمى"></div>
          <div class="field"><label for="sYear">السنة الافتراضية</label><input type="number" id="sYear" value="${st.year}"></div>
          <div class="field"><label for="sLang">أسماء المنشآت</label><select id="sLang">${opt('ar', 'بالعربية (إن وجدت)', st.nameLang)}${opt('en', 'بالإنجليزية', st.nameLang)}${opt('both', 'عربي — إنجليزي', st.nameLang)}</select></div>
          <div class="field"><label for="sBand">نطاق «قريب من المستهدف» (نقاط)</label><input type="number" id="sBand" min="0" max="50" value="${st.amberBand}"></div>
        </div>
        <label class="switch"><input type="checkbox" id="sZero" ${st.zeroAsMissing ? 'checked' : ''}> اعتبار القيمة صفر «لم يُرفع» واستبعادها من المتوسطات (مطابق لمعادلات ملف التراكر)</label>
        <div class="row"><div class="logo-prev">${st.logo ? `<img src="${st.logo}" alt="الشعار">` : '<span class="muted small">لا شعار</span>'}</div>
          <label class="btn ghost" for="sLogo">رفع شعار (PNG/JPG)</label><input type="file" id="sLogo" accept="image/*" hidden>${st.logo ? '<button type="button" class="btn ghost" id="sLogoDel">حذف الشعار</button>' : ''}</div>
        <div><button type="button" class="btn" id="sSave">حفظ الإعدادات</button></div></div>`;
      $('#sSave').onclick = () => {
        Object.assign(st, { orgName: $('#sOrg').value.trim(), deptName: $('#sDept').value.trim(), reportTitle: $('#sTitle').value.trim(), preparedBy: $('#sBy').value.trim(), year: +$('#sYear').value || st.year, nameLang: $('#sLang').value, amberBand: Math.max(0, +$('#sBand').value || 0), zeroAsMissing: $('#sZero').checked });
        W.ui.year = st.year; W.save(true); W.applyBrand(); W.toast('تم حفظ الإعدادات');
      };
      $('#sLogo').onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        const img = new Image(); const rd = new FileReader();
        rd.onload = () => { img.onload = () => { const c = document.createElement('canvas'); const sc = Math.min(1, 400 / Math.max(img.width, img.height)); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); st.logo = c.toDataURL('image/png'); W.save(true); W.route(); }; img.src = rd.result; };
        rd.readAsDataURL(f);
      };
      if ($('#sLogoDel')) $('#sLogoDel').onclick = () => { st.logo = ''; W.save(true); W.route(); };
    } else if (setTab === 'programs') {
      body.innerHTML = `<div class="panel"><p class="muted small" style="margin-bottom:12px">«كلمات التعرّف» هي جزء من اسم ورقة الإكسل؛ تستخدمها المنصة لربط كل ورقة ببرنامجها عند الرفع.</p>
        <div class="tbl-wrap"><table><thead><tr><th>الاسم الكامل</th><th>الاسم المختصر</th><th>التكرار</th><th class="n">المستهدف %</th><th>كلمات التعرّف (افصل بفاصلة)</th><th>الفئة الافتراضية</th><th></th></tr></thead><tbody>
        ${S.programs.map((p) => `<tr data-id="${p.id}"><td><input type="text" data-f="name" value="${esc(p.name)}" aria-label="الاسم"></td><td><input type="text" data-f="short" value="${esc(p.short)}" aria-label="المختصر" style="min-width:140px"></td>
          <td><select data-f="freq" aria-label="التكرار">${Object.entries(W.FREQ).map(([k, v]) => opt(k, v.label, p.freq)).join('')}</select></td>
          <td class="n"><input type="number" data-f="target" min="0" max="100" value="${+(p.target * 100).toFixed(1)}" aria-label="المستهدف"></td>
          <td><input type="text" data-f="keywords" value="${esc((p.keywords || []).join(', '))}" aria-label="كلمات التعرف"></td>
          <td><select data-f="defCat" aria-label="الفئة">${Object.entries(W.CATS).map(([k, v]) => opt(k, v, p.defCat)).join('')}</select></td>
          <td><button type="button" class="btn sm ghost" data-del="${p.id}">حذف</button></td></tr>`).join('')}</tbody></table></div>
        <div class="row" style="margin-top:14px"><button type="button" class="btn" id="pSave">حفظ البرامج</button><button type="button" class="btn ghost" id="pAdd">+ برنامج جديد</button></div></div>`;
      $('#pSave').onclick = () => {
        $$('tr[data-id]', body).forEach((tr) => {
          const p = W.prog(tr.dataset.id); const g = (f) => $(`[data-f=${f}]`, tr).value;
          const nf = g('freq');
          if (nf !== p.freq && Object.keys(S.results[p.id] || {}).length) { W.toast(`تغيير تكرار «${p.short}» قد يخفي البيانات المرتبطة بالفترات القديمة`, true); }
          Object.assign(p, { name: g('name').trim() || p.name, short: g('short').trim(), freq: nf, target: Math.min(1, Math.max(0, (+g('target') || 0) / 100)), keywords: g('keywords').split(/[,،]/).map((x) => x.trim()).filter(Boolean), defCat: g('defCat') });
        });
        W.save(true); W.toast('تم حفظ البرامج');
      };
      $('#pAdd').onclick = () => { S.programs.push({ id: 'p_' + W.uid(), name: 'برنامج جديد', short: 'برنامج جديد', freq: 'Q', target: 0.9, keywords: [], defCat: 'moh', color: '#3D7EA6' }); W.save(true); W.route(); };
      $$('[data-del]', body).forEach((b) => (b.onclick = () => {
        if (b.dataset.armed) { const id = b.dataset.del; S.programs = S.programs.filter((p) => p.id !== id); delete S.results[id]; delete S.facilities[id]; delete S.notes[id]; W.save(true); W.toast('تم حذف البرنامج وبياناته'); W.route(); }
        else { b.dataset.armed = '1'; b.textContent = 'تأكيد الحذف؟'; b.classList.add('danger'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'حذف'; b.classList.remove('danger'); } }, 3500); }
      }));
    } else if (setTab === 'facilities') {
      const keys = Object.keys(S.directory).filter((k) => Object.values(S.facilities).some((l) => l.includes(k))).sort((a, b) => W.facCat(a).localeCompare(W.facCat(b)) || S.directory[a].en.localeCompare(S.directory[b].en));
      body.innerHTML = `<div class="panel"><div class="panel-head"><input type="search" id="fsSearch" placeholder="بحث…" aria-label="بحث"><span class="muted small">${keys.length} منشأة · التعديل يُحفظ تلقائيًا</span></div>
        <div class="tbl-wrap"><table><thead><tr><th>الاسم في ملف الإكسل</th><th>الاسم بالعربية</th><th>الفئة</th><th>البرامج</th><th></th></tr></thead><tbody id="fsRows">
        ${keys.map((k) => { const f = S.directory[k]; const ps = S.programs.filter((p) => (S.facilities[p.id] || []).includes(k)); return `<tr data-k="${esc(k)}" data-s="${esc((f.en + ' ' + f.ar).toLowerCase())}"><td class="small" dir="ltr" style="text-align:right">${esc(f.en)}</td>
          <td><input type="text" data-f="ar" value="${esc(f.ar)}" aria-label="الاسم بالعربية"></td><td><select data-f="cat" aria-label="الفئة">${Object.entries(W.CATS).map(([c, l]) => opt(c, l, f.cat)).join('')}</select></td>
          <td class="small">${ps.map((p) => `<span class="tag">${esc(p.short)}</span>`).join(' ')}</td><td><button type="button" class="btn sm ghost" data-rm="${esc(k)}">إزالة</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
      $('#fsSearch').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('#fsRows tr').forEach((tr) => (tr.hidden = q && !tr.dataset.s.includes(q))); };
      $$('#fsRows tr').forEach((tr) => $$('[data-f]', tr).forEach((el) => el.addEventListener('change', () => { S.directory[tr.dataset.k][el.dataset.f] = el.value.trim(); W.save(); W.toast('تم الحفظ'); })));
      $$('[data-rm]', body).forEach((b) => (b.onclick = () => {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'تأكيد؟'; b.classList.add('danger'); return; }
        const k = b.dataset.rm; Object.keys(S.facilities).forEach((pid) => (S.facilities[pid] = S.facilities[pid].filter((x) => x !== k))); W.save(true); W.toast('تمت إزالة المنشأة من كل البرامج'); W.route();
      }));
    } else {
      body.innerHTML = `<div class="grid g2">
        <div class="panel stack"><h2>نسخة احتياطية</h2><p class="muted">بياناتك محفوظة في هذا المتصفح فقط. نزّل نسخة احتياطية بعد كل تحديث شهري، واستعدها على أي جهاز آخر.</p>
          <div class="row"><button type="button" class="btn" id="bkDown">تنزيل نسخة احتياطية (JSON)</button><label class="btn ghost" for="bkUp">استعادة من نسخة</label><input type="file" id="bkUp" accept=".json,application/json" hidden></div></div>
        <div class="panel stack"><h2>مسح البيانات</h2><p class="muted">يحذف كل النتائج والملاحظات ويعيد الإعدادات الافتراضية. نزّل نسخة احتياطية قبلها.</p>
          <div><button type="button" class="btn danger" id="bkReset">مسح كل البيانات</button></div></div>
        <div class="panel stack"><h2>معلومات</h2><p class="muted small">الإصدار ${W.VERSION} · آخر حفظ: ${S.updatedAt ? esc(new Date(S.updatedAt).toLocaleString('en-GB')) : '—'} · ${Object.values(S.results).reduce((a, r) => a + Object.values(r).reduce((b, y) => b + Object.values(y).reduce((c, p) => c + Object.keys(p).length, 0), 0), 0)} قيمة محفوظة</p></div></div>`;
      $('#bkDown').onclick = () => W.saveFile(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), `wiqaya-backup-${new Date().toISOString().slice(0, 10)}.json`);
      $('#bkUp').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const s = JSON.parse(await f.text()); if (!s.programs || !s.results) throw new Error('ملف غير صالح'); W.replaceState(Object.assign(W.defaultState(), s)); W.toast('تمت الاستعادة'); W.applyBrand(); W.route(); }
        catch (err) { W.toast('تعذّرت الاستعادة: ' + err.message, true); }
      };
      $('#bkReset').onclick = (e) => {
        const b = e.currentTarget;
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'اضغط مرة أخرى للتأكيد'; return; }
        W.replaceState(W.defaultState()); W.ui.pid = null; W.ui.period = null; W.toast('تم مسح البيانات'); W.applyBrand(); W.route();
      };
    }
  };
})();
