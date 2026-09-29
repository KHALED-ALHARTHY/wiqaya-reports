/* core.js — state, periods, facility directory, calculations */
(function () {
  'use strict';
  const W = (window.W = window.W || {});
  const STORE_KEY = 'wiqaya.reports.v2';
  W.VERSION = '2.0.0';

  /* ---------- periods ---------- */
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const MONTHS_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const FREQ = {
    M: { label: 'شهري', base: MONTHS.map((_, i) => 'M' + String(i + 1).padStart(2, '0')) },
    Q: { label: 'ربع سنوي', base: ['Q1', 'Q2', 'Q3', 'Q4'] },
    H: { label: 'نصف سنوي', base: ['H1', 'H2'] },
    Y: { label: 'سنوي', base: ['Y'] }
  };
  const PERIOD_LABEL = { Q1: 'الربع الأول', Q2: 'الربع الثاني', Q3: 'الربع الثالث', Q4: 'الربع الرابع', H1: 'النصف الأول', H2: 'النصف الثاني', Y: 'السنة كاملة' };
  MONTHS.forEach((m, i) => (PERIOD_LABEL['M' + String(i + 1).padStart(2, '0')] = m));
  W.MONTHS = MONTHS; W.MONTHS_EN = MONTHS_EN; W.FREQ = FREQ;

  W.periodLabel = (p, year) => (PERIOD_LABEL[p] || p) + (year ? ' ' + year : '');
  W.periodShort = (p) => (p[0] === 'M' ? MONTHS[+p.slice(1) - 1] : p === 'Y' ? 'السنة' : p);
  // months covered by a period
  W.monthsOf = (p) => {
    if (p[0] === 'M') return [+p.slice(1)];
    if (p[0] === 'Q') { const q = +p[1]; return [q * 3 - 2, q * 3 - 1, q * 3]; }
    if (p[0] === 'H') { const h = +p[1]; return h === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]; }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  };
  // base periods (for a program frequency) that fall within period p
  W.basesWithin = (freq, p) => {
    const ms = W.monthsOf(p);
    return FREQ[freq].base.filter((b) => W.monthsOf(b).every((m) => ms.includes(m)));
  };
  // periods a user can view for a program frequency: base + coarser aggregates
  W.viewPeriods = (freq) => {
    const out = [...FREQ[freq].base];
    if (freq === 'M') out.push('Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Y');
    if (freq === 'Q') out.push('H1', 'H2', 'Y');
    if (freq === 'H') out.push('Y');
    return out;
  };
  // previous comparable period of same granularity (same year only)
  W.prevPeriod = (p) => {
    if (p === 'Y') return null;
    const n = +p.slice(1);
    if (n <= 1) return null;
    return p[0] === 'M' ? 'M' + String(n - 1).padStart(2, '0') : p[0] + (n - 1);
  };
  W.siblings = (p) => (p[0] === 'M' ? FREQ.M.base : p[0] === 'Q' ? FREQ.Q.base : p[0] === 'H' ? FREQ.H.base : ['Y']);

  /* ---------- categories ---------- */
  W.CATS = {
    moh: 'مستشفيات وزارة الصحة',
    private: 'مستشفيات خاصة',
    gov: 'مستشفيات حكومية أخرى',
    hd_private: 'مراكز غسيل كلوي خاصة',
    hd_charity: 'مراكز غسيل كلوي خيرية',
    dental: 'مراكز الأسنان',
    phc: 'مراكز الرعاية الصحية الأولية',
    other: 'أخرى'
  };
  W.catFromLabel = (s) => {
    const t = String(s || '').toLowerCase();
    if (!t.trim()) return null;
    if (/dental|أسنان|اسنان/.test(t)) return 'dental';
    if (/charit|خيري/.test(t)) return 'hd_charity';
    if (/(^|\W)hd\b|dialysis|غسيل/.test(t)) return 'hd_private';
    if (/non|حكومي/.test(t)) return 'gov';
    if (/private|خاص/.test(t)) return 'private';
    if (/moh|وزارة/.test(t)) return 'moh';
    if (/phc|primary|رعاية/.test(t)) return 'phc';
    return 'other';
  };

  /* ---------- built-in facility directory (Arabic names + known aliases) ---------- */
  const SEED_DIR = [
    ['King Abdul-Aziz Hospital', 'مستشفى الملك عبدالعزيز', 'moh'],
    ['Hera General Hospital', 'مستشفى حراء العام', 'moh'],
    ['Al-Noor Specialist Hospital', 'مستشفى النور التخصصي', 'moh'],
    ['Maternity & Children Hospital', 'مستشفى الولادة والأطفال', 'moh'],
    ['King Abdulla Medical City', 'مدينة الملك عبدالله الطبية', 'moh'],
    ['King Faisal Hospital', 'مستشفى الملك فيصل', 'moh'],
    ['Ibn Sina Hospital', 'مستشفى ابن سينا', 'moh'],
    ['Ajyad Emergency Hospital', 'مستشفى أجياد للطوارئ', 'moh'],
    ['Alkamel Hospital', 'مستشفى الكامل', 'moh'],
    ['Khulais General Hospital', 'مستشفى خليص العام', 'moh'],
    ['Alqunfutha General Hospital', 'مستشفى القنفذة العام', 'moh'],
    ['South Alqunfutha Hospital', 'مستشفى جنوب القنفذة', 'moh'],
    ['Namerah Hospital', 'مستشفى نمرة', 'moh'],
    ['Almudhailaf Hospital', 'مستشفى المظيلف', 'moh'],
    ['Thuraiban Hospital', 'مستشفى ثريبان', 'moh'],
    ['Alsaedi Hospital', 'مستشفى الساعدي', 'private', ['Al-Saedy hospital (Jamoom)', 'Alsaedy Hospital']],
    ['Dr. Awadd Albeshri Hospital', 'مستشفى د. عواض البشري', 'private'],
    ['Saudi Germani Hospital', 'المستشفى السعودي الألماني', 'private', ['Saudi German Hospital']],
    ['Bashrahil Hospital', 'مستشفى باشراحيل', 'private'],
    ['Alshefa Hospital', 'مستشفى الشفاء', 'private'],
    ['Saudi National Hospital', 'المستشفى الوطني السعودي', 'private'],
    ['Makkah Medical Hospital', 'مستشفى مكة الطبي', 'private'],
    ['Jiwar Hospital', 'مستشفى جوار', 'private', ['Jawar Hospital', 'Jiwar for Medical services hospital']],
    ['Security Forces Hospital', 'مستشفى قوى الأمن', 'gov'],
    ['Sheraya Diaverum', 'دافيروم الشرائع', 'hd_private'],
    ['Awali Diaverum', 'دافيروم العوالي', 'hd_private'],
    ['Khulais Diaverum', 'دافيروم خليص', 'hd_private', ['Khulais Daiverum']],
    ['Qunfutha Diaverum', 'دافيروم القنفذة', 'hd_private'],
    ['Gouz Diaverum', 'دافيروم القوز', 'hd_private'],
    ['Nemerah Diaverum', 'دافيروم نمرة', 'hd_private'],
    ['Aziziyah Davita', 'دافيتا العزيزية', 'hd_private'],
    ['Umm Al-Qura Medical Complex', 'مجمع أم القرى الطبي', 'hd_private', ['Umm Al-Qura Medical compliex']],
    ['Shefa Charity Center', 'مركز الشفاء الخيري للكلى', 'hd_charity', ['specialized kidney center at sheffaa charity society']],
    ['Alrahmah Charity Center', 'مركز الرحمة الخيري', 'hd_charity', ['Alrahman Charity Center']],
    ['Alsittin Charity Center', 'مركز الستين الخيري', 'hd_charity'],
    ['Samir Alnajar Charity', 'مركز سمير النجار الخيري', 'hd_charity'],
    ['Albar Charity Center', 'مركز البر الخيري', 'hd_charity', ['Albar Charity']],
    ['Sulaiman Charity Center', 'مركز سليمان الخيري', 'hd_charity', ['sulaiman charty Center']],
    ['AlGhareefien phc', 'الغريفين', 'phc', ['ALGhareefien']]
  ];
  W.normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '');

  /* ---------- default state ---------- */
  function defaultState() {
    const dir = {}; const alias = {};
    SEED_DIR.forEach(([en, ar, cat, als]) => {
      const k = W.normKey(en);
      dir[k] = { en, ar, cat };
      (als || []).forEach((a) => (alias[W.normKey(a)] = k));
    });
    return {
      v: 2,
      settings: {
        orgName: 'إدارة الوقاية ومكافحة العدوى',
        deptName: 'منطقة مكة المكرمة',
        reportTitle: 'تقرير متابعة برامج الوقاية ومكافحة العدوى',
        preparedBy: '',
        logo: '',
        nameLang: 'ar',
        zeroAsMissing: true,
        amberBand: 10,
        theme: 'system',
        year: new Date().getFullYear()
      },
      programs: [
        { id: 'hh_hosp', name: 'نظافة الأيدي – المستشفيات ومراكز الغسيل', short: 'نظافة الأيدي (مستشفيات)', freq: 'M', target: 0.8, keywords: ['HOSPITAL H.H', 'Hospital Hand'], defCat: 'moh', color: '#0E6F68' },
        { id: 'hh_phc', name: 'نظافة الأيدي – مراكز الرعاية الأولية', short: 'نظافة الأيدي (رعاية أولية)', freq: 'M', target: 0.8, keywords: ['PHC H.H', 'PHC Hand'], defCat: 'phc', color: '#2A8C82' },
        { id: 'ipccc', name: 'تقييم برنامج مكافحة العدوى IPCCC', short: 'IPCCC', freq: 'Q', target: 0.9, keywords: ['IPCCC'], defCat: 'moh', color: '#B7791F' },
        { id: 'rpp', name: 'برنامج الوقاية من المخاطر RPP', short: 'RPP', freq: 'Q', target: 0.9, keywords: ['RPP'], defCat: 'moh', color: '#6B5CA5' },
        { id: 'phc_ica', name: 'التقييم الذاتي لمكافحة العدوى PHC ICA', short: 'PHC ICA', freq: 'H', target: 0.9, keywords: ['ICA'], defCat: 'phc', color: '#C0504D' }
      ],
      directory: dir,
      aliases: alias,
      facilities: {},   // programId -> [facilityKey]
      results: {},      // programId -> year -> period -> facKey -> number
      notes: {},        // programId -> year -> period -> facKey -> string
      imports: [],
      updatedAt: null
    };
  }
  W.defaultState = defaultState;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      const d = defaultState();
      s.settings = Object.assign(d.settings, s.settings || {});
      ['programs', 'directory', 'aliases', 'facilities', 'results', 'notes', 'imports'].forEach((k) => { if (!s[k]) s[k] = d[k]; });
      return s;
    } catch (e) { console.warn('load failed', e); return defaultState(); }
  }
  W.state = load();
  let saveTimer = null;
  W.save = (immediate) => {
    W.state.updatedAt = new Date().toISOString();
    const doSave = () => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(W.state)); }
      catch (e) { W.toast('تعذّر الحفظ في المتصفح: ' + e.message, true); }
    };
    clearTimeout(saveTimer);
    if (immediate) doSave(); else saveTimer = setTimeout(doSave, 250);
  };
  W.replaceState = (s) => { W.state = s; W.save(true); };

  /* ---------- helpers ---------- */
  W.$ = (sel, root) => (root || document).querySelector(sel);
  W.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  W.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  W.pct = (v, d = 1) => (v == null || isNaN(v) ? '—' : '\u200E' + (v * 100).toFixed(d).replace(/\.0+$/, '') + '%');
  W.pts = (d) => (d == null || isNaN(d) ? '' : '\u200E' + (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100).toFixed(1) + ' نقطة');
  W.uid = () => Math.random().toString(36).slice(2, 9);
  W.prog = (id) => W.state.programs.find((p) => p.id === id);
  W.toast = (msg, err) => {
    const box = document.getElementById('toasts'); if (!box) return;
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
    box.appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 2800);
  };
  W.fmtDate = (d) => { try { return new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return String(d).slice(0, 10); } };

  /* ---------- facility directory ---------- */
  W.canonKey = (name) => { const k = W.normKey(name); return W.state.aliases[k] || k; };
  W.fac = (key) => W.state.directory[key] || { en: key, ar: '', cat: 'other' };
  W.facName = (key, lang) => {
    const f = W.fac(key); lang = lang || W.state.settings.nameLang;
    if (lang === 'en') return f.en || f.ar;
    if (lang === 'both') return f.ar && f.en ? f.ar + ' — ' + f.en : f.ar || f.en;
    return f.ar || f.en;
  };
  W.facCat = (key) => W.fac(key).cat || 'other';
  W.programFacilities = (pid, cat) => (W.state.facilities[pid] || []).filter((k) => !cat || cat === 'all' || W.facCat(k) === cat);
  W.programCats = (pid) => { const s = new Set((W.state.facilities[pid] || []).map(W.facCat)); return Object.keys(W.CATS).filter((c) => s.has(c)); };

  /* ---------- values ---------- */
  const valid = (v) => v != null && !isNaN(v) && !(W.state.settings.zeroAsMissing && v === 0);
  W.isValid = valid;
  W.rawVal = (pid, year, period, key) => { const r = W.state.results[pid]; return r && r[year] && r[year][period] ? r[year][period][key] : undefined; };
  W.setVal = (pid, year, period, key, v) => {
    const r = (W.state.results[pid] = W.state.results[pid] || {});
    const y = (r[year] = r[year] || {}); const p = (y[period] = y[period] || {});
    if (v == null || v === '' || isNaN(v)) delete p[key]; else p[key] = v;
  };
  W.getNote = (pid, year, period, key) => { const n = W.state.notes[pid]; return (n && n[year] && n[year][period] && n[year][period][key]) || ''; };
  W.setNote = (pid, year, period, key, t) => {
    const n = (W.state.notes[pid] = W.state.notes[pid] || {}); const y = (n[year] = n[year] || {}); const p = (y[period] = y[period] || {});
    if (t) p[key] = t; else delete p[key];
  };
  // value of a facility in any period (aggregated = mean of valid base values, like AVERAGEIF(...,"<>0"))
  W.val = (pid, year, period, key) => {
    const pr = W.prog(pid); if (!pr) return null;
    if (FREQ[pr.freq].base.includes(period)) { const v = W.rawVal(pid, year, period, key); return valid(v) ? v : null; }
    const vals = W.basesWithin(pr.freq, period).map((b) => W.rawVal(pid, year, b, key)).filter(valid);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  W.status = (v, target) => {
    if (v == null) return 'none';
    if (v >= target - 1e-9) return 'good';
    if (v >= target - W.state.settings.amberBand / 100) return 'warn';
    return 'bad';
  };
  W.STATUS_LABEL = { good: 'محقق للمستهدف', warn: 'قريب من المستهدف', bad: 'دون المستهدف', none: 'لم يُرفع' };
  W.chip = (st, text) => `<span class="chip ${st}">${W.esc(text || W.STATUS_LABEL[st])}</span>`;

  // does period have any data?
  W.hasData = (pid, year, period) => { const keys = W.state.facilities[pid] || []; return keys.some((k) => W.val(pid, year, period, k) != null); };
  W.latestPeriod = (pid, year) => {
    const pr = W.prog(pid); if (!pr) return null;
    const base = FREQ[pr.freq].base;
    for (let i = base.length - 1; i >= 0; i--) if (W.hasData(pid, year, base[i])) return base[i];
    return base[0];
  };
  W.years = () => {
    const ys = new Set([W.state.settings.year, new Date().getFullYear()]);
    Object.values(W.state.results).forEach((r) => Object.keys(r || {}).forEach((y) => ys.add(+y)));
    return [...ys].filter(Boolean).sort((a, b) => b - a);
  };

  /* ---------- statistics for a program/period ---------- */
  W.stats = (pid, year, period, cat) => {
    const pr = W.prog(pid); const keys = W.programFacilities(pid, cat);
    const prev = W.prevPeriod(period);
    const rows = keys.map((k) => {
      const v = W.val(pid, year, period, k);
      const pv = prev ? W.val(pid, year, prev, k) : null;
      return { key: k, name: W.facName(k), en: W.fac(k).en, cat: W.facCat(k), v, prev: pv, delta: v != null && pv != null ? v - pv : null, st: W.status(v, pr.target), note: W.getNote(pid, year, period, k) };
    });
    const rep = rows.filter((r) => r.v != null);
    const avg = rep.length ? rep.reduce((a, r) => a + r.v, 0) / rep.length : null;
    const prevRep = rows.filter((r) => r.prev != null);
    const prevAvg = prevRep.length ? prevRep.reduce((a, r) => a + r.prev, 0) / prevRep.length : null;
    const count = (s) => rows.filter((r) => r.st === s).length;
    const byCat = W.programCats(pid).filter((c) => !cat || cat === 'all' || c === cat).map((c) => {
      const rr = rep.filter((r) => r.cat === c);
      return { cat: c, label: W.CATS[c], n: rows.filter((r) => r.cat === c).length, rep: rr.length, avg: rr.length ? rr.reduce((a, r) => a + r.v, 0) / rr.length : null };
    });
    const sorted = [...rep].sort((a, b) => b.v - a.v);
    const withDelta = rows.filter((r) => r.delta != null);
    return {
      program: pr, year, period, prev, cat: cat || 'all', rows, avg, prevAvg,
      delta: avg != null && prevAvg != null ? avg - prevAvg : null,
      total: rows.length, reported: rep.length, good: count('good'), warn: count('warn'), bad: count('bad'), missing: count('none'),
      meetPct: rep.length ? count('good') / rep.length : null,
      top: sorted.slice(0, 5), bottom: [...sorted].reverse().slice(0, 5),
      improved: [...withDelta].sort((a, b) => b.delta - a.delta).filter((r) => r.delta > 0).slice(0, 5),
      declined: [...withDelta].sort((a, b) => a.delta - b.delta).filter((r) => r.delta < 0).slice(0, 5),
      byCat,
      trend: W.siblings(period).map((p) => {
        const vs = keys.map((k) => W.val(pid, year, p, k)).filter((v) => v != null);
        return { p, label: W.periodShort(p), avg: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null, n: vs.length };
      })
    };
  };

  /* ---------- auto insights ---------- */
  W.insights = (s) => {
    const out = []; const t = s.program.target;
    if (s.avg == null) { out.push({ c: 'warn', t: 'لا توجد نتائج مرفوعة لهذه الفترة.' }); return out; }
    out.push({ c: s.avg >= t ? 'good' : 'bad', t: `متوسط الامتثال ${W.pct(s.avg)} مقابل مستهدف ${W.pct(t, 0)}${s.avg >= t ? '، أي أن المستهدف متحقق على مستوى البرنامج.' : `، بفارق ${Math.abs((t - s.avg) * 100).toFixed(1)} نقطة.`}` });
    if (s.delta != null) out.push({ c: s.delta >= 0 ? 'good' : 'bad', t: `${s.delta >= 0 ? 'تحسّن' : 'تراجع'} المتوسط بمقدار ${Math.abs(s.delta * 100).toFixed(1)} نقطة مقارنة بـ${W.periodLabel(s.prev)}.` });
    out.push({ c: s.meetPct >= 0.8 ? 'good' : 'warn', t: `${s.good} من ${s.reported} منشأة مُبلِّغة حققت المستهدف (${W.pct(s.meetPct, 0)}).` });
    if (s.bad) out.push({ c: 'bad', t: `${s.bad} منشأة دون المستهدف بأكثر من ${W.state.settings.amberBand} نقاط وتحتاج خطة تصحيحية.` });
    if (s.missing) out.push({ c: 'warn', t: `${s.missing} منشأة لم ترفع نتائجها لهذه الفترة (نسبة التغطية ${W.pct(s.reported / s.total, 0)}).` });
    if (s.byCat.length > 1) {
      const c = s.byCat.filter((x) => x.avg != null).sort((a, b) => a.avg - b.avg);
      if (c.length > 1) out.push({ c: 'info', t: `أعلى الفئات أداءً: ${c[c.length - 1].label} (${W.pct(c[c.length - 1].avg)})، وأدناها: ${c[0].label} (${W.pct(c[0].avg)}).` });
    }
    return out;
  };
  W.recommendations = (s) => {
    const r = [];
    const low = s.rows.filter((x) => x.st === 'bad').sort((a, b) => a.v - b.v);
    if (low.length) r.push(`إعداد خطة تصحيحية ومتابعة شهرية للمنشآت دون المستهدف: ${low.slice(0, 6).map((x) => x.name).join('، ')}${low.length > 6 ? ` و${low.length - 6} أخرى` : ''}.`);
    const miss = s.rows.filter((x) => x.st === 'none');
    if (miss.length) r.push(`مخاطبة المنشآت غير المُبلِّغة (${miss.length}) لرفع النتائج قبل نهاية الفترة التالية.`);
    if (s.declined.length) r.push(`مراجعة أسباب التراجع في: ${s.declined.slice(0, 4).map((x) => `${x.name} (${W.pts(x.delta)})`).join('، ')}.`);
    const warn = s.rows.filter((x) => x.st === 'warn');
    if (warn.length) r.push(`دعم المنشآت القريبة من المستهدف (${warn.length}) بجولات تدريب وتدقيق ميداني قصيرة.`);
    if (s.top.length) r.push(`تعميم الممارسات الناجحة من المنشآت الأعلى أداءً مثل ${s.top.slice(0, 3).map((x) => x.name).join('، ')}.`);
    return r;
  };
})();
