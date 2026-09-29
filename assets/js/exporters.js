/* exporters.js — PowerPoint (native, editable), PDF (from slides), Excel (formatted) */
(function () {
  'use strict';
  const W = window.W; const { $, $$, pct } = W;

  W.saveFile = (blob, name) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  const waitLib = async (name) => { for (let i = 0; i < 100 && !window[name]; i++) await new Promise((r) => setTimeout(r, 100)); if (!window[name]) throw new Error('المكتبة ' + name + ' لم تُحمَّل'); };

  /* ================= PowerPoint ================= */
  const C = { primary: '0E6F68', ink: '10292B', ink2: '4A6164', line: 'DCE5E2', soft: 'EEF4F2', good: '1E8A4C', warn: 'D08A10', bad: 'C0392B', none: 'A7B3B4', accent: 'B7791F', dark: '0C2D30', white: 'FFFFFF' };
  const F = 'Arial';
  const stHex = (st) => ({ good: C.good, warn: C.warn, bad: C.bad, none: C.none }[st]);
  const T = (o) => Object.assign({ fontFace: F, color: C.ink, rtlMode: true, align: 'right', valign: 'top', margin: 0 }, o);

  function pHead(pptx, slide, sl) {
    const st = W.state.settings;
    slide.background = { color: C.white };
    slide.addText(`${st.orgName}${st.deptName ? ' · ' + st.deptName : ''}`, T({ x: 0.6, y: 0.35, w: 10.2, h: 0.3, fontSize: 12, color: C.primary, bold: true }));
    slide.addText(sl.title, T({ x: 0.6, y: 0.62, w: 10.2, h: 0.55, fontSize: 24, bold: true }));
    if (sl.sub) slide.addText(sl.sub, T({ x: 0.6, y: 1.15, w: 10.2, h: 0.3, fontSize: 13, color: C.accent, bold: true }));
    if (st.logo) slide.addImage({ data: st.logo, x: 0.6, y: 0.35, w: 1.4, h: 0.8, sizing: { type: 'contain', w: 1.4, h: 0.8 } });
  }
  function pFoot(slide, sl, i, n) {
    slide.addShape('line', { x: 0.6, y: 7.0, w: 12.13, h: 0, line: { color: C.line, width: 1 } });
    slide.addText(sl.foot || '', T({ x: 4.5, y: 7.05, w: 8.23, h: 0.3, fontSize: 10, color: C.ink2 }));
    slide.addText(`${i + 1} / ${n}`, T({ x: 0.6, y: 7.05, w: 1.5, h: 0.3, fontSize: 10, color: C.ink2, align: 'left', rtlMode: false }));
  }
  function pKpis(slide, s, y) {
    const t = s.program.target; const w = 2.85, gap = 0.24, x0 = 12.73 - w;
    const items = [
      ['متوسط الامتثال', pct(s.avg), `المستهدف ${pct(t, 0)}${s.delta != null ? ' · ' + W.pts(s.delta) : ''}`, stHex(W.status(s.avg, t))],
      ['المنشآت المُبلِّغة', `${s.reported} / ${s.total}`, `تغطية ${s.total ? pct(s.reported / s.total, 0) : '—'}`, C.ink],
      ['محققة للمستهدف', String(s.good), `${pct(s.meetPct, 0)} من المُبلِّغة`, C.good],
      ['دون المستهدف / لم تُرفع', `${s.bad + s.warn} / ${s.missing}`, `${s.warn} قريبة من المستهدف`, C.bad]
    ];
    items.forEach(([l, v, d, col], i) => {
      const x = x0 - i * (w + gap);
      slide.addShape('roundRect', { x, y, w, h: 1.35, fill: { color: C.soft }, line: { color: C.soft }, rectRadius: 0.12 });
      slide.addText(l, T({ x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontSize: 12, color: C.ink2 }));
      slide.addText(v, T({ x: x + 0.2, y: y + 0.4, w: w - 0.4, h: 0.55, fontSize: 28, bold: true, color: col, rtlMode: false }));
      slide.addText(d, T({ x: x + 0.2, y: y + 0.97, w: w - 0.4, h: 0.28, fontSize: 10.5, color: C.ink2 }));
    });
  }
  function pBullets(slide, list, box) {
    const runs = list.map((m) => ({ text: typeof m === 'string' ? m : m.t, options: { bullet: { code: '25A0' }, color: C.ink, breakLine: true, paraSpaceAfter: 8 } }));
    slide.addText(runs.length ? runs : [{ text: '—' }], T(Object.assign({ fontSize: 15, lineSpacingMultiple: 1.15 }, box)));
  }
  const pctData = (arr) => arr.map((v) => (v == null ? 0 : +v.toFixed(4)));
  function pFacChart(pptx, slide, rows, t, box) {
    const labels = rows.map((r) => r.name);
    const ser = ['good', 'warn', 'bad'].map((st) => ({ name: W.STATUS_LABEL[st], labels, values: rows.map((r) => (r.st === st ? +r.v.toFixed(4) : 0)) }));
    slide.addChart(pptx.ChartType.bar, ser, Object.assign({
      barDir: 'bar', barGrouping: 'stacked', chartColors: [C.good, C.warn, C.bad], catAxisOrientation: 'maxMin', valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: '0%',
      valAxisLabelFontSize: 10, catAxisLabelFontSize: rows.length > 16 ? 9 : 11, catAxisLabelFontFace: F, showLegend: true, legendPos: 'b', legendFontSize: 10, legendFontFace: F,
      showValue: true, dataLabelFormatCode: '0.0%;;;', dataLabelFontSize: 9, dataLabelPosition: 'inEnd', dataLabelColor: C.white, barGapWidthPct: 40, valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' }
    }, box));
  }
  function pTrend(pptx, slide, s, box) {
    const labels = s.trend.map((x) => x.label);
    slide.addChart(pptx.ChartType.line, [
      { name: 'متوسط الامتثال', labels, values: s.trend.map((x) => (x.avg == null ? null : +x.avg.toFixed(4))) },
      { name: 'المستهدف', labels, values: s.trend.map(() => s.program.target) }
    ], Object.assign({ chartColors: [C.primary, C.accent], lineSize: 2.5, lineDataSymbolSize: 7, valAxisLabelFormatCode: '0%', valAxisMaxVal: 1, valAxisMinVal: Math.max(0, Math.floor((Math.min(...s.trend.filter((x) => x.avg != null).map((x) => x.avg), s.program.target) - 0.1) * 10) / 10),
      showLegend: true, legendPos: 'b', legendFontSize: 10, legendFontFace: F, catAxisLabelFontFace: F, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, showValue: false, valGridLine: { color: C.line, size: 0.5 }, displayBlanksAs: 'gap' }, box));
  }
  function pCat(pptx, slide, s, box) {
    const labels = s.byCat.map((c) => c.label);
    slide.addChart(pptx.ChartType.bar, [{ name: 'المتوسط', labels, values: s.byCat.map((c) => (c.avg == null ? 0 : +c.avg.toFixed(4))) }], Object.assign({
      barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: [C.primary], valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: '0%', showValue: true, dataLabelFormatCode: '0.0%', dataLabelFontSize: 11,
      catAxisLabelFontFace: F, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, barGapWidthPct: 60, valGridLine: { color: C.line, size: 0.5 } }, box));
  }
  const cell = (text, o) => ({ text: String(text == null ? '' : text), options: Object.assign({ fontFace: F, fontSize: 11, color: C.ink, rtlMode: true, align: 'right', valign: 'middle', border: { type: 'solid', color: C.line, pt: 0.5 } }, o || {}) });
  const hcell = (t) => cell(t, { bold: true, color: C.ink2, fill: { color: C.soft }, fontSize: 10.5 });
  const stCell = (st, txt) => cell(txt || W.STATUS_LABEL[st], { color: stHex(st), bold: true, align: 'center' });
  // pptx tables are LTR: reverse so the first logical column sits on the right
  const rtlRow = (r) => [...r].reverse();

  W.exportPptx = async (rep) => {
    await waitLib('PptxGenJS');
    const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.rtlMode = true; pptx.title = rep.name; pptx.company = W.state.settings.orgName;
    const n = rep.slides.length; const st = W.state.settings;
    rep.slides.forEach((sl, i) => {
      const slide = pptx.addSlide();
      if (sl.kind === 'cover') {
        slide.background = { color: C.dark };
        slide.addShape('ellipse', { x: -1.6, y: -1.0, w: 7, h: 7, fill: { color: C.dark }, line: { color: '17494C', width: 40 } });
        if (st.logo) slide.addImage({ data: st.logo, x: 10.9, y: 0.5, w: 1.8, h: 0.9, sizing: { type: 'contain', w: 1.8, h: 0.9 } });
        slide.addText(`${st.orgName}${st.deptName ? ' · ' + st.deptName : ''}`, T({ x: 1, y: 2.0, w: 11.3, h: 0.45, fontSize: 18, color: '9FD3CC' }));
        slide.addText(sl.title, T({ x: 1, y: 2.5, w: 11.3, h: 1.6, fontSize: 40, bold: true, color: C.white, valign: 'middle' }));
        slide.addText(sl.sub, T({ x: 1, y: 4.15, w: 11.3, h: 0.55, fontSize: 22, bold: true, color: 'E7C88F' }));
        slide.addText(sl.meta.join('     ·     '), T({ x: 1, y: 4.9, w: 11.3, h: 0.4, fontSize: 14, color: 'C9DEDA' }));
        [[C.accent, 0], [C.primary, 4.444], ['5FD0C3', 8.889]].forEach(([c, x]) => slide.addShape('rect', { x, y: 7.3, w: 4.445, h: 0.2, fill: { color: c }, line: { color: c } }));
        return;
      }
      pHead(pptx, slide, sl);
      const top = sl.sub ? 1.6 : 1.4;
      switch (sl.kind) {
        case 'summary':
          pKpis(slide, sl.s, top);
          slide.addText('أبرز النتائج', T({ x: 0.6, y: top + 1.6, w: 12.13, h: 0.35, fontSize: 16, bold: true }));
          pBullets(slide, sl.insights, { x: 0.6, y: top + 2.0, w: 12.13, h: 3.3 });
          break;
        case 'facChart':
          pFacChart(pptx, slide, sl.rows, sl.s.program.target, { x: 0.6, y: top, w: 12.13, h: 6.9 - top });
          break;
        case 'trendCat':
          slide.addText('متوسط الامتثال عبر الفترات', T({ x: 6.8, y: top, w: 5.93, h: 0.35, fontSize: 15, bold: true }));
          pTrend(pptx, slide, sl.s, { x: 6.8, y: top + 0.4, w: 5.93, h: 6.8 - top - 0.4 });
          slide.addText('المتوسط حسب الفئة', T({ x: 0.6, y: top, w: 5.93, h: 0.35, fontSize: 15, bold: true }));
          pCat(pptx, slide, sl.s, { x: 0.6, y: top + 0.4, w: 5.93, h: 6.8 - top - 0.4 });
          break;
        case 'rank': {
          const tbl = (title, rows, f, x) => {
            const data = [rtlRow([hcell(title), hcell('')])].concat((rows.length ? rows : [{ name: 'لا يوجد' }]).map((r) => rtlRow([cell(r.name), f(r)])));
            slide.addTable(data, { x, y: top, w: 5.9, colW: [1.6, 4.3].reverse(), rowH: 0.36 });
          };
          tbl('الأعلى أداءً', sl.s.top.concat(sl.s.improved.slice(0, 3).map((r) => Object.assign({}, r, { name: '↑ ' + r.name, _d: true }))), (r) => (r.v == null ? cell('') : cell(r._d ? W.pts(r.delta) : pct(r.v), { color: C.good, bold: true, align: 'center' })), 6.83);
          tbl('الأدنى أداءً', sl.s.bottom.concat(sl.s.declined.slice(0, 3).map((r) => Object.assign({}, r, { name: '↓ ' + r.name, _d: true }))), (r) => (r.v == null ? cell('') : r._d ? cell(W.pts(r.delta), { color: C.bad, bold: true, align: 'center' }) : stCell(r.st, pct(r.v))), 0.6);
          slide.addText('↑ الأكثر تحسنًا   ·   ↓ الأكثر تراجعًا مقارنة بالفترة السابقة', T({ x: 0.6, y: 6.55, w: 12.13, h: 0.3, fontSize: 10, color: C.ink2 }));
          break;
        }
        case 'table': {
          const hdr = ['المنشأة', 'الفئة', W.periodShort(sl.s.period), sl.s.prev ? W.periodShort(sl.s.prev) : 'السابقة', 'التغير', 'الحالة'].concat(sl.notes ? ['ملاحظات'] : []);
          const colW = sl.notes ? [3.4, 1.9, 1.0, 1.0, 1.0, 1.5, 2.33] : [4.4, 2.6, 1.2, 1.2, 1.1, 1.63];
          const rows = [rtlRow(hdr.map(hcell))].concat(sl.rows.map((r) => rtlRow([cell(r.name), cell(W.CATS[r.cat], { fontSize: 9.5, color: C.ink2 }), cell(pct(r.v), { bold: true, align: 'center' }), cell(pct(r.prev), { align: 'center', color: C.ink2 }),
            cell(r.delta != null ? W.pts(r.delta).replace(' نقطة', '') : '', { align: 'center', color: r.delta > 0 ? C.good : r.delta < 0 ? C.bad : C.ink2 }), stCell(r.st)].concat(sl.notes ? [cell(r.note, { fontSize: 9.5 })] : []))));
          slide.addTable(rows, { x: 0.6, y: top, w: 12.13, colW: [...colW].reverse(), rowH: 0.36, autoPage: false });
          break;
        }
        case 'missing':
          slide.addText(`هذه المنشآت لم تُرفع نتائجها لـ${W.periodLabel(sl.s.period, sl.s.year)}، وتحتاج متابعة لاستكمال الرفع.`, T({ x: 0.6, y: top, w: 12.13, h: 0.4, fontSize: 15, color: C.ink2 }));
          slide.addText(sl.rows.map((r) => r.name).join('   ·   '), T({ x: 0.6, y: top + 0.55, w: 12.13, h: 6.8 - top - 0.55, fontSize: sl.rows.length > 50 ? 11 : 14, lineSpacingMultiple: 1.4, fit: 'shrink' }));
          break;
        case 'recs':
          if (sl.notes.length) {
            slide.addText('التوصيات', T({ x: 5.6, y: top, w: 7.13, h: 0.35, fontSize: 16, bold: true }));
            pBullets(slide, sl.recs, { x: 5.6, y: top + 0.45, w: 7.13, h: 6.8 - top - 0.45, fontSize: 14 });
            slide.addText('الإجراءات المسجلة للمنشآت', T({ x: 0.6, y: top, w: 4.7, h: 0.35, fontSize: 16, bold: true }));
            slide.addText(sl.notes.slice(0, 9).map((x) => [{ text: x.name + ': ', options: { bold: true, color: C.ink } }, { text: x.note, options: { color: C.ink2, breakLine: true } }]).flat(), T({ x: 0.6, y: top + 0.45, w: 4.7, h: 6.8 - top - 0.45, fontSize: 12, paraSpaceAfter: 6, fit: 'shrink' }));
          } else {
            pBullets(slide, sl.recs, { x: 0.6, y: top, w: 12.13, h: 6.8 - top, fontSize: 16 });
          }
          break;
        case 'overview': {
          const hdr = ['البرنامج', 'الفترة', 'المتوسط', 'المستهدف', 'المُبلِّغة', 'محققة', 'دون المستهدف', 'الحالة'];
          const rows = [rtlRow(hdr.map(hcell))].concat(sl.items.map((it) => { const s2 = W.status(it.s.avg, it.pr.target); return rtlRow([cell(it.pr.name, { bold: true }), cell(W.periodLabel(it.period)), cell(pct(it.s.avg), { bold: true, align: 'center' }), cell(pct(it.pr.target, 0), { align: 'center' }), cell(`${it.s.reported}/${it.s.total}`, { align: 'center' }), cell(it.s.good, { align: 'center', color: C.good }), cell(it.s.bad + it.s.warn, { align: 'center', color: C.bad }), stCell(s2, it.s.avg == null ? 'لا بيانات' : null)]); }));
          slide.addTable(rows, { x: 0.6, y: top, w: 12.13, colW: [4.0, 1.5, 1.1, 1.1, 1.1, 0.9, 1.1, 1.33].reverse(), rowH: 0.4 });
          const labels = sl.items.map((x) => x.pr.short || x.pr.name);
          const y2 = top + 0.45 * (sl.items.length + 1) + 0.2;
          if (6.85 - y2 > 1.5) slide.addChart(pptx.ChartType.bar, [{ name: 'المتوسط', labels, values: sl.items.map((x) => (x.s.avg == null ? 0 : +x.s.avg.toFixed(4))) }, { name: 'المستهدف', labels, values: sl.items.map((x) => x.pr.target) }],
            { x: 0.6, y: y2, w: 12.13, h: 6.85 - y2, barDir: 'col', chartColors: [C.primary, C.accent], valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: '0%', showValue: true, dataLabelFormatCode: '0%', dataLabelFontSize: 10, showLegend: true, legendPos: 'r', legendFontFace: F, catAxisLabelFontFace: F, catAxisLabelFontSize: 11, valGridLine: { color: C.line, size: 0.5 } });
          break;
        }
        case 'progSummary':
          pKpis(slide, sl.s, top);
          slide.addText('أبرز النتائج', T({ x: 6.2, y: top + 1.6, w: 6.53, h: 0.35, fontSize: 15, bold: true }));
          pBullets(slide, sl.insights.slice(0, 4), { x: 6.2, y: top + 2.0, w: 6.53, h: 6.85 - top - 2.0, fontSize: 13 });
          pTrend(pptx, slide, sl.s, { x: 0.6, y: top + 1.6, w: 5.4, h: 6.85 - top - 1.6 });
          break;
        case 'attention': {
          const low = sl.s.rows.filter((r) => r.st === 'bad' || r.st === 'warn').sort((a, b) => a.v - b.v).slice(0, 10);
          const data = [rtlRow([hcell(`دون المستهدف (${sl.s.bad + sl.s.warn})`), hcell('')])].concat((low.length ? low : [{ name: 'كل المنشآت المُبلِّغة حققت المستهدف', st: 'good' }]).map((r) => rtlRow([cell(r.name), r.v == null ? cell('') : stCell(r.st, pct(r.v))])));
          slide.addTable(data, { x: 6.83, y: top, w: 5.9, colW: [1.4, 4.5].reverse(), rowH: 0.36 });
          const miss = sl.s.rows.filter((r) => r.st === 'none');
          slide.addText(`لم تُرفع (${miss.length})`, T({ x: 0.6, y: top, w: 5.9, h: 0.35, fontSize: 15, bold: true }));
          slide.addText(miss.length ? miss.slice(0, 30).map((r) => r.name).join('  ·  ') + (miss.length > 30 ? `  ·  و${miss.length - 30} أخرى` : '') : 'لا يوجد', T({ x: 0.6, y: top + 0.4, w: 5.9, h: 2.2, fontSize: 11.5, color: C.ink2, fit: 'shrink' }));
          slide.addText('التوصيات', T({ x: 0.6, y: top + 2.75, w: 5.9, h: 0.35, fontSize: 15, bold: true }));
          pBullets(slide, sl.recs, { x: 0.6, y: top + 3.15, w: 5.9, h: 6.85 - top - 3.15, fontSize: 12 });
          break;
        }
      }
      pFoot(slide, sl, i, n);
    });
    const blob = await pptx.write({ outputType: 'blob' });
    W.saveFile(blob, safeName(rep.name) + '.pptx');
    return blob;
  };

  /* ================= PDF (rendered slides) ================= */
  W.exportPdf = async (rep) => {
    await waitLib('html2canvas'); await waitLib('jspdf');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:-20000px;width:1280px;z-index:-1';
    document.body.appendChild(host);
    const charts = W.renderDeck(host, rep, { noScale: true });
    $$('.slide-frame', host).forEach((f) => { f.style.cssText = 'width:1280px;height:720px;border-radius:0;box-shadow:none;border:0;aspect-ratio:auto'; });
    await new Promise((r) => setTimeout(r, 150));
    const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720], hotfixes: ['px_scaling'], compress: true });
    const frames = $$('.slide', host);
    for (let i = 0; i < frames.length; i++) {
      const canvas = await html2canvas(frames[i], { scale: 1.6, backgroundColor: '#ffffff', width: 1280, height: 720, windowWidth: 1400, useCORS: true, logging: false });
      if (i) pdf.addPage([1280, 720], 'landscape');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 1280, 720, undefined, 'FAST');
    }
    charts.forEach((c) => c.destroy()); host.remove();
    const blob = pdf.output('blob');
    W.saveFile(blob, safeName(rep.name) + '.pdf');
    return blob;
  };

  /* ================= Excel ================= */
  const XF = { good: 'FFDDF1E4', warn: 'FFFBEBCF', bad: 'FFF8DEDA', none: 'FFF1F4F3' };
  const XC = { good: 'FF1E8A4C', warn: 'FF9A5C00', bad: 'FFB03022', none: 'FF8A9A9C' };
  const sheetName = (s, used) => { let n = String(s).replace(/[\[\]:*?/\\]/g, '-').slice(0, 31); let k = 2; while (used.has(n)) n = n.slice(0, 28) + ' ' + k++; used.add(n); return n; };
  function styleHeader(row) { row.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E6F68' } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }); row.height = 30; }
  function statusCell(c, st) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XF[st] } }; c.font = Object.assign({}, c.font || {}, { color: { argb: XC[st] }, bold: true }); }
  function titleRows(ws, title, sub, cols) {
    const st = W.state.settings;
    ws.mergeCells(1, 1, 1, cols); ws.getCell(1, 1).value = title; ws.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FF10292B' } };
    ws.mergeCells(2, 1, 2, cols); ws.getCell(2, 1).value = `${st.orgName}${st.deptName ? ' · ' + st.deptName : ''} · ${sub} · تاريخ الإصدار ${new Date().toISOString().slice(0, 10)}`; ws.getCell(2, 1).font = { color: { argb: 'FF4A6164' } };
    ws.getRow(1).height = 26;
  }
  W.exportXlsx = async (rep, cfg) => {
    await waitLib('ExcelJS');
    const wb = new ExcelJS.Workbook(); wb.creator = 'منصة تقارير الوقاية'; wb.created = new Date();
    const used = new Set(); const S = W.state;
    // summary
    const ws = wb.addWorksheet(sheetName('الملخص', used), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }] });
    const hdr = ['البرنامج', 'الفترة', 'متوسط الامتثال', 'المستهدف', 'الحالة', 'عدد المنشآت', 'المُبلِّغة', 'التغطية', 'محققة', 'قريبة', 'دون المستهدف', 'لم تُرفع', 'التغير عن السابقة'];
    titleRows(ws, rep.name, 'ملخص البرامج', hdr.length);
    styleHeader(ws.getRow(4)); ws.getRow(4).values = hdr; styleHeader(ws.getRow(4));
    rep.stats.forEach((s) => {
      const st = W.status(s.avg, s.program.target);
      const r = ws.addRow([s.program.name, W.periodLabel(s.period, s.year), s.avg, s.program.target, W.STATUS_LABEL[st], s.total, s.reported, s.total ? s.reported / s.total : null, s.good, s.warn, s.bad, s.missing, s.delta]);
      [3, 4, 8].forEach((c) => (r.getCell(c).numFmt = '0.0%')); r.getCell(13).numFmt = '+0.0%;-0.0%;0.0%';
      statusCell(r.getCell(3), st); statusCell(r.getCell(5), st);
    });
    ws.columns.forEach((c, i) => (c.width = i === 0 ? 42 : i === 1 ? 20 : 14));
    ws.addRow([]); ws.addRow(['أبرز النتائج']).font = { bold: true, size: 13 };
    rep.stats.forEach((s) => { ws.addRow([s.program.short || s.program.name]).font = { bold: true, color: { argb: 'FF0E6F68' } }; W.insights(s).forEach((m) => { const r = ws.addRow(['• ' + m.t]); ws.mergeCells(r.number, 1, r.number, hdr.length); r.alignment = { wrapText: true }; }); });

    // detail sheet for a single-program report
    if (cfg.type === 'program') {
      const s = rep.stats[0];
      const d = wb.addWorksheet(sheetName('تفاصيل ' + W.periodShort(s.period), used), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }] });
      const h = ['المنشأة', 'الاسم في الملف', 'الفئة', W.periodLabel(s.period), s.prev ? W.periodLabel(s.prev) : 'السابقة', 'التغير', 'الحالة', 'ملاحظات / إجراءات'];
      titleRows(d, s.program.name + ' · ' + W.periodLabel(s.period, s.year), 'التفاصيل حسب المنشأة', h.length);
      d.getRow(4).values = h; styleHeader(d.getRow(4));
      [...s.rows].sort((a, b) => (b.v ?? -1) - (a.v ?? -1)).forEach((x) => {
        const r = d.addRow([x.name, x.en, W.CATS[x.cat], x.v, x.prev, x.delta, W.STATUS_LABEL[x.st], x.note]);
        r.getCell(4).numFmt = '0.0%'; r.getCell(5).numFmt = '0.0%'; r.getCell(6).numFmt = '+0.0%;-0.0%;0.0%';
        statusCell(r.getCell(4), x.st); statusCell(r.getCell(7), x.st);
      });
      d.columns = [{ width: 34 }, { width: 34 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 11 }, { width: 18 }, { width: 44 }];
      d.getRow(4).values = h; styleHeader(d.getRow(4));
      d.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: h.length } };
    }

    // full-year matrix per program
    rep.stats.forEach((s) => {
      const pr = s.program; const year = s.year;
      const base = W.FREQ[pr.freq].base; const agg = W.viewPeriods(pr.freq).filter((p) => !base.includes(p));
      const cols = [...base, ...agg];
      const m = wb.addWorksheet(sheetName((pr.short || pr.name) + ' ' + year, used), { views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 4 }] });
      const h = ['المنشأة', 'الفئة', ...cols.map((p) => (p[0] === 'M' ? W.periodShort(p) : W.periodLabel(p)))];
      titleRows(m, `${pr.name} · ${year}`, `المستهدف ${pct(pr.target, 0)} · المتوسطات تستبعد الخلايا الفارغة${S.settings.zeroAsMissing ? ' والصفرية' : ''}`, h.length);
      m.getRow(4).values = h; styleHeader(m.getRow(4));
      W.programFacilities(pr.id).forEach((k) => {
        const vals = cols.map((p) => W.val(pr.id, year, p, k));
        const r = m.addRow([W.facName(k), W.CATS[W.facCat(k)], ...vals]);
        vals.forEach((v, j) => { const c = r.getCell(3 + j); c.numFmt = '0.0%'; c.alignment = { horizontal: 'center' }; if (v != null) statusCell(c, W.status(v, pr.target)); if (!base.includes(cols[j])) c.border = { right: { style: 'thin', color: { argb: 'FFB7C7C4' } } }; });
      });
      const avgRow = m.addRow(['متوسط البرنامج', '', ...cols.map((p) => { const vs = W.programFacilities(pr.id).map((k) => W.val(pr.id, year, p, k)).filter((v) => v != null); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; })]);
      avgRow.font = { bold: true }; avgRow.eachCell((c, i) => { if (i > 2) { c.numFmt = '0.0%'; c.alignment = { horizontal: 'center' }; } c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0EE' } }; });
      m.columns.forEach((c, i) => (c.width = i === 0 ? 36 : i === 1 ? 26 : 12));
      m.getRow(4).values = h; styleHeader(m.getRow(4));
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    W.saveFile(blob, safeName(rep.name) + '.xlsx');
    return blob;
  };
})();
