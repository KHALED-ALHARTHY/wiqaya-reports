/* importer.js — read the tracker workbook, detect programs/periods, clean values */
(function () {
  'use strict';
  const W = window.W;
  const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', '٬': '', '،': '.' };
  const MONTH_RX = [
    [/^(jan|january|يناير|كانون الثاني)/i, 1], [/^(feb|february|فبراير|شباط)/i, 2], [/^(mar|march|مارس|آذار)/i, 3],
    [/^(apr|april|أبريل|ابريل|نيسان)/i, 4], [/^(may|مايو|أيار)/i, 5], [/^(jun|june|يونيو|حزيران)/i, 6],
    [/^(jul|july|يوليو|تموز)/i, 7], [/^(aug|august|أغسطس|اغسطس|آب)/i, 8], [/^(sep|sept|september|سبتمبر|أيلول)/i, 9],
    [/^(oct|october|أكتوبر|اكتوبر|تشرين الأول)/i, 10], [/^(nov|november|نوفمبر|تشرين الثاني)/i, 11], [/^(dec|december|ديسمبر|كانون الأول)/i, 12]
  ];
  const ORD = [[/(1st|first|الأول|الاول|q1|^1)/i, 1], [/(2nd|second|الثاني|q2|^2)/i, 2], [/(3rd|third|الثالث|q3|^3)/i, 3], [/(4th|4rd|fourth|الرابع|q4|^4)/i, 4]];

  // classify a header cell -> {kind:'M'|'Q'|'H'|'Y'|'QAGG', period}
  function headerPeriod(h) {
    const s = String(h == null ? '' : h).trim();
    if (!s) return null;
    const low = s.toLowerCase();
    if (/^quarterly\s*\d/.test(low) || /^(مجموع|متوسط)\s*الربع/.test(s)) { const n = +(low.match(/\d/) || [0])[0]; return n ? { kind: 'QAGG', period: 'Q' + n } : null; }
    for (const [rx, m] of MONTH_RX) if (rx.test(low)) return { kind: 'M', period: 'M' + String(m).padStart(2, '0') };
    const ord = () => { for (const [rx, n] of ORD) if (rx.test(low)) return n; return 0; };
    if (/quarter|ربع|^q[1-4]$/.test(low)) { const n = ord(); return n ? { kind: 'Q', period: 'Q' + n } : null; }
    if (/half|نصف|^h[12]$/.test(low)) { const n = ord(); return n && n <= 2 ? { kind: 'H', period: 'H' + n } : null; }
    if (/^(annual|yearly|year|سنوي|السنة)/.test(low)) return { kind: 'Y', period: 'Y' };
    return null;
  }

  // parse a cell into a fraction 0..1; returns {v, warn}
  function parseValue(x) {
    if (x == null || x === '') return { v: null };
    if (typeof x === 'number') {
      if (isNaN(x)) return { v: null };
      if (x > 1 && x <= 100) return { v: x / 100, warn: `قيمة ${x} فُسِّرت كنسبة ${x}%` };
      if (x > 100 || x < 0) return { v: null, warn: `قيمة غير منطقية (${x}) تم تجاهلها` };
      return { v: x, zero: x === 0 };
    }
    let s = String(x).trim();
    if (!s || /^[-–—]+$/.test(s) || /^(n\/?a|na|none|لا يوجد)$/i.test(s)) return { v: null };
    s = s.replace(/[٠-٩٫٬،]/g, (c) => AR_DIGITS[c]).replace(/\s/g, '');
    const hasPct = /[%٪]/.test(s);
    const n = parseFloat(s.replace(/[%٪]/g, ''));
    if (isNaN(n)) return { v: null, warn: `نص غير رقمي "${x}" تم تجاهله` };
    let v = hasPct || n > 1 ? n / 100 : n;
    if (v > 1 || v < 0) return { v: null, warn: `قيمة غير منطقية "${x}" تم تجاهلها` };
    return { v, zero: v === 0, warn: `نص "${x}" حُوِّل إلى رقم` , soft: true };
  }

  function detectYear(rows, fileName) {
    const hay = rows.slice(0, 6).flat().map((c) => String(c == null ? '' : c)).join(' ') + ' ' + (fileName || '');
    const m = hay.match(/20[2-4]\d/);
    return m ? +m[0] : W.state.settings.year;
  }

  function matchProgram(sheetName, headersText) {
    const n = W.normKey(sheetName);
    let best = null; let bestLen = 0;
    W.state.programs.forEach((p) => (p.keywords || []).forEach((kw) => {
      const k = W.normKey(kw);
      if (k && (n.includes(k) || W.normKey(headersText).includes(k)) && k.length > bestLen) { best = p; bestLen = k.length; }
    }));
    return best;
  }

  function analyzeSheet(ws, sheetName, fileName) {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    // header row = first row (in first 10) with >=2 period-like headers
    let hr = -1; let cols = [];
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const found = (rows[i] || []).map((h, c) => ({ c, hp: headerPeriod(h) })).filter((x) => x.hp);
      if (found.length >= 2) { hr = i; cols = found; break; }
    }
    if (hr < 0) return { sheetName, ok: false, reason: 'لم يتم العثور على أعمدة فترات (أشهر أو أرباع أو أنصاف)' };
    const head = rows[hr].map((h) => String(h == null ? '' : h).trim());
    const hasMonths = cols.some((x) => x.hp.kind === 'M');
    let periodCols = cols.filter((x) => (hasMonths ? x.hp.kind === 'M' : x.hp.kind !== 'QAGG'));
    if (!periodCols.length) periodCols = cols.map((x) => ({ c: x.c, hp: { kind: 'Q', period: x.hp.period } }));
    const freq = hasMonths ? 'M' : periodCols.some((x) => x.hp.kind === 'Q') ? 'Q' : periodCols.some((x) => x.hp.kind === 'H') ? 'H' : 'Y';
    // name / arabic / category columns
    const minPC = Math.min(...periodCols.map((x) => x.c));
    let nameCol = head.findIndex((h, i) => i < minPC && /name/i.test(h) && !/arabic|عرب/i.test(h));
    const arCol = head.findIndex((h, i) => i < minPC && /arabic|عرب/i.test(h));
    const catCol = head.findIndex((h, i) => i < minPC && /type|category|نوع|فئة/i.test(h));
    if (nameCol < 0) { // column before periods with most text values
      let best = -1, bestN = 0;
      for (let c = 0; c < minPC; c++) { if (c === arCol || c === catCol) continue; const n = rows.slice(hr + 1).filter((r) => r && typeof r[c] === 'string' && /[a-z؀-ۿ]/i.test(r[c])).length; if (n > bestN) { bestN = n; best = c; } }
      nameCol = best;
    }
    if (nameCol < 0) return { sheetName, ok: false, reason: 'لم يتم العثور على عمود أسماء المنشآت' };
    const year = detectYear(rows, fileName);
    const program = matchProgram(sheetName, rows.slice(0, hr + 1).flat().join(' '));
    const title = rows.slice(0, hr).flat().filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).filter((x) => !/^tracker/i.test(x))[0] || sheetName.trim();

    const records = []; const warnings = []; let lastCat = null; let zeros = 0; let values = 0;
    for (let i = hr + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const nm = r[nameCol];
      if (catCol >= 0 && r[catCol] != null && String(r[catCol]).trim()) lastCat = String(r[catCol]).trim();
      if (nm == null || typeof nm === 'number' || !String(nm).trim()) continue;
      const name = String(nm).replace(/\s+/g, ' ').trim();
      if (/^(total|المجموع|الإجمالي|average|المتوسط|count)$/i.test(name)) continue;
      const vals = {};
      periodCols.forEach(({ c, hp }) => {
        const pv = parseValue(r[c]);
        if (pv.warn && !pv.soft) warnings.push(`${name} – ${W.periodShort(hp.period)}: ${pv.warn}`);
        if (pv.v != null) { vals[hp.period] = pv.v; values++; if (pv.zero) zeros++; }
      });
      records.push({ name, ar: arCol >= 0 && r[arCol] ? String(r[arCol]).trim() : '', catLabel: lastCat, vals });
    }
    const softCount = rows.slice(hr + 1).reduce((a, r) => a + periodCols.filter(({ c }) => r && typeof r[c] === 'string' && r[c].trim()).length, 0);
    if (softCount) warnings.unshift(`${softCount} خلية مكتوبة كنص (مثل "75٫00%") وتم تحويلها إلى أرقام تلقائيًا.`);
    if (zeros) warnings.unshift(`${zeros} خلية قيمتها صفر — ${W.state.settings.zeroAsMissing ? 'تُعامل كـ«لم يُرفع» ولا تدخل في المتوسطات (كما في معادلات الملف)' : 'تُحسب ضمن المتوسطات'}.`);
    return { sheetName, ok: true, title, freq, year, programId: program ? program.id : null, periods: periodCols.map((x) => x.hp.period), records, warnings, values };
  }

  W.readWorkbook = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const sheets = wb.SheetNames.map((n) => { try { return analyzeSheet(wb.Sheets[n], n, file.name); } catch (e) { return { sheetName: n, ok: false, reason: e.message }; } });
    return { fileName: file.name, sheets };
  };

  // apply analyzed sheets to state. plan: [{sheet, programId|'new'|'', year, mode:'replace'|'merge'}]
  W.applyImport = (fileName, plan) => {
    const S = W.state; const summary = [];
    plan.forEach(({ sheet, programId, year, mode }) => {
      if (!programId) return;
      let pr = W.prog(programId);
      if (programId === 'new') {
        pr = { id: 'p_' + W.uid(), name: sheet.title, short: sheet.sheetName.trim().slice(0, 28), freq: sheet.freq, target: 0.9, keywords: [sheet.sheetName.trim()], defCat: 'other', color: '#3D7EA6' };
        S.programs.push(pr);
      }
      const list = (S.facilities[pr.id] = S.facilities[pr.id] || []);
      const res = (S.results[pr.id] = S.results[pr.id] || {});
      if (mode === 'replace') res[year] = {};
      const y = (res[year] = res[year] || {});
      let n = 0, added = 0;
      const seen = new Set();
      sheet.records.forEach((rec) => {
        let key = W.canonKey(rec.name);
        const recCat = W.catFromLabel(rec.catLabel);
        if (seen.has(key)) { // same name repeated in another section (e.g. a hospital's dental center)
          const base = S.directory[key] || { en: rec.name, ar: '' };
          const cat = recCat || 'other'; key = key + '__' + cat;
          if (!S.directory[key]) S.directory[key] = { en: `${base.en} (${rec.catLabel || cat})`, ar: base.ar ? `${base.ar} – ${W.CATS[cat] || rec.catLabel}` : '', cat };
        }
        seen.add(key);
        if (!S.directory[key]) S.directory[key] = { en: rec.name, ar: '', cat: recCat || pr.defCat || 'other' };
        const d = S.directory[key];
        if (rec.ar && !d.ar) d.ar = rec.ar;
        if (!d.cat || d.cat === 'other') d.cat = recCat || pr.defCat || d.cat;
        if (!list.includes(key)) { list.push(key); added++; }
        Object.entries(rec.vals).forEach(([p, v]) => { if (W.FREQ[pr.freq].base.includes(p)) { (y[p] = y[p] || {})[key] = v; n++; } });
      });
      summary.push({ program: pr.short || pr.name, sheet: sheet.sheetName.trim(), values: n, added, year });
    });
    S.imports.unshift({ date: new Date().toISOString(), file: fileName, summary });
    S.imports = S.imports.slice(0, 30);
    W.save(true);
    return summary;
  };
  W._parseValue = parseValue; W._headerPeriod = headerPeriod;
})();
