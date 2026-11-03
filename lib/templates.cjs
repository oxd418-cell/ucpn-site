'use strict';
// HTML-шаблони. Кожна функція повертає готовий рядок HTML.
const I18N = require('./i18n.cjs');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

module.exports = function createTemplates(S) {
  const { site, IMGS, today, partners, paths } = S;
  const base = String(site.basePath || '').replace(/\/$/, '');
  const u = (p) => base + p;
  const T = (l) => I18N[l];
  const OTHER = { uk: 'en', en: 'uk' };
  const loc = (obj, l) => (obj == null ? '' : typeof obj === 'string' ? obj : (obj[l] || obj.uk || obj.en || ''));
  const siteName = (l) => loc(site.fullName, l) || site.name;

  /* ---------- дати ---------- */
  const isUpcoming = (ev) => (ev.status !== 'scheduled' || !ev.start ? true : (ev.end || ev.start) >= today);
  const fmtDay = (iso, l) => { const p = iso.split('-'); return `${+p[2]} ${T(l).months[+p[1] - 1]} ${p[0]}`; };
  function eventDate(ev, l) {
    const t = T(l);
    if (ev.status === 'tba') return t.tba;
    if (ev.status === 'development') return t.dev;
    if (!ev.start) return t.tba;
    if (ev.end && ev.end !== ev.start) {
      const a = ev.start.split('-'); const b = ev.end.split('-');
      if (a[0] === b[0] && a[1] === b[1]) return `${+a[2]}–${+b[2]} ${t.months[+a[1] - 1]} ${a[0]}`;
      return `${fmtDay(ev.start, l)} – ${fmtDay(ev.end, l)}`;
    }
    return fmtDay(ev.start, l);
  }
  function pubDate(pb, l) {
    const t = T(l);
    if (pb.published) return fmtDay(pb.published, l);
    if (pb.status === 'development') return t.dev;
    return t.tba;
  }

  /* ---------- зображення ---------- */
  function picture(src, alt, o) {
    o = o || {};
    const m = IMGS[src];
    if (!src || !m) return '<div class="ph-missing" role="img" aria-label="' + esc(alt || '') + '"></div>';
    const lazy = o.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    if (m.raw) return `<img src="${u(src)}" alt="${esc(alt || '')}" ${lazy} decoding="async">`;
    const sizes = o.sizes || '100vw';
    const set = (ext) => m.widths.map((w) => `${u('/assets/img/' + m.base + '-' + w + '.' + ext)} ${w}w`).join(', ');
    const fb = m.widths.filter((w) => w <= 800).pop() || m.widths[0];
    return `<picture><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
      + `<img src="${u('/assets/img/' + m.base + '-' + fb + '.jpg')}" srcset="${set('jpg')}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt || '')}" ${lazy} decoding="async"></picture>`;
  }
  function imgUrl(src) {
    const m = IMGS[src];
    if (!m) return '';
    if (m.raw) return site.url + u(src);
    const w = m.widths.filter((x) => x <= 1200).pop() || m.widths[0];
    return site.url + u('/assets/img/' + m.base + '-' + w + '.jpg');
  }

  /* ---------- іконки ---------- */
  const ico = {
    arrow: '<svg class="arrow" viewBox="0 0 20 12" width="20" height="12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M0 6h18M13 1l5 5-5 5"/></svg>',
    back: '<svg viewBox="0 0 20 12" width="18" height="11" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 6H2M7 1L2 6l5 5"/></svg>',
    ext: '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 10L10 2M4 2h6v6"/></svg>',
    share: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="3.5" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="12.5" r="2"/><path d="M5.8 7l4.4-2.6M5.8 9l4.4 2.6"/></svg>',
    pin: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M8 14.5s5-4.3 5-8.2a5 5 0 0 0-10 0c0 3.9 5 8.2 5 8.2z"/><circle cx="8" cy="6.3" r="1.7"/></svg>',
    clock: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
    tag: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2 8.5V2h6.5L14 7.5 8.5 13z"/><circle cx="5" cy="5" r="1"/></svg>',
    cal: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/></svg>',
    left: '<svg viewBox="0 0 10 16" width="10" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 1L2 8l6 7"/></svg>',
    right: '<svg viewBox="0 0 10 16" width="10" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 1l6 7-6 7"/></svg>'
  };


  /* ---------- календар ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (iso) => iso.replace(/-/g, '');
  const plusDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const okTime = (v) => /^\d{1,2}:\d{2}$/.test(String(v || '').trim());
  const hm = (v) => { const [h, m] = String(v).trim().split(':'); return pad(+h) + pad(+m) + '00'; };
  function calRange(ev) {
    const end = ev.end || ev.start;
    if (okTime(ev.startTime)) {
      let e = okTime(ev.endTime) ? hm(ev.endTime) : null; let endDay = end;
      if (!e) { const [h, m] = ev.startTime.trim().split(':'); const t = (+h * 60 + +m + 60); if (t >= 1440) { endDay = plusDays(end, 1); } e = pad(Math.floor((t % 1440) / 60)) + pad(t % 60) + '00'; }
      return { allDay: false, s: ymd(ev.start) + 'T' + hm(ev.startTime), e: ymd(endDay) + 'T' + e };
    }
    return { allDay: true, s: ymd(ev.start), e: ymd(plusDays(end, 1)) };
  }
  const canCal = (ev) => ev.status === 'scheduled' && ev.start && isUpcoming(ev);
  function gcalUrl(ev) {
    const r = calRange(ev);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: r.s + '/' + r.e, details: (ev.summary || ev.lead || '') + '\n' + site.url + base + evUrl(ev.lang, ev.key), location: [ev.location, ev.address].filter(Boolean).join(', '), ctz: 'Europe/Kyiv' });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  const icsEsc = (x) => String(x || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => { const out = []; let rest = line; while (rest.length > 70) { out.push(rest.slice(0, 70)); rest = ' ' + rest.slice(70); } out.push(rest); return out.join('\r\n'); };
  function ics(ev) {
    const r = calRange(ev);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const host = site.url.replace(/^https?:\/\//, '');
    const d = r.allDay ? [`DTSTART;VALUE=DATE:${r.s}`, `DTEND;VALUE=DATE:${r.e}`] : [`DTSTART;TZID=Europe/Kyiv:${r.s}`, `DTEND;TZID=Europe/Kyiv:${r.e}`];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UCPN//Site//' + ev.lang.toUpperCase(), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Kyiv', 'BEGIN:STANDARD', 'DTSTART:19701025T040000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:19700329T030000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'END:DAYLIGHT', 'END:VTIMEZONE',
      'BEGIN:VEVENT', `UID:${ev.key}-${ev.lang}@${host}`, `DTSTAMP:${stamp}`, ...d, `SUMMARY:${icsEsc(ev.title)}`,
      `DESCRIPTION:${icsEsc((ev.summary || ev.lead || '') + '\n' + site.url + base + evUrl(ev.lang, ev.key))}`,
      `LOCATION:${icsEsc([ev.location, ev.address].filter(Boolean).join(', '))}`, `URL:${site.url}${base}${evUrl(ev.lang, ev.key)}`, 'END:VEVENT', 'END:VCALENDAR'];
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /* ---------- каркас сторінки ---------- */
  const evUrl = (l, k) => `/${l}/events/${k}/`;
  const pbUrl = (l, k) => `/${l}/publications/${k}/`;

  function langSwitch(l, path, id) {
    const links = ['uk', 'en'].map((x) => {
      const alt = path.replace(/^\/(uk|en)\//, '/' + x + '/');
      const href = x === l ? path : (paths.has(alt) ? alt : `/${x}/`);
      const label = x === 'uk' ? 'UA' : 'EN';
      return `<a href="${u(href)}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true"' : ''}>${label}</a>`;
    });
    return `<div class="langs" role="group" aria-label="${esc(T(l).langLabel)}">${links[0]}<span aria-hidden="true">/</span>${links[1]}</div>`;
  }
  function logo(l) {
    const small = l === 'uk' ? 'Мережа<br>українських<br>культурних<br>професіоналів' : 'Ukrainian<br>Culture<br>Professionals<br>Network';
    return `<a class="logo" href="${u('/' + l + '/')}" aria-label="${esc(site.name)} — ${esc(siteName(l))}"><b>${esc(site.name)}</b><small aria-hidden="true">${small}</small></a>`;
  }
  function layout(o) {
    const l = o.lang; const t = T(l); const path = o.path;
    const title = o.title ? `${o.title} — ${site.name}` : `${site.name} — ${siteName(l)}`;
    const desc = o.description || loc(site.description, l) || t.siteDescription;
    const abs = site.url + u(path);
    const alts = ['uk', 'en'].map((x) => ({ x, p: path.replace(/^\/(uk|en)\//, '/' + x + '/') })).filter((a) => paths.has(a.p));
    const hre = alts.length > 1
      ? alts.map((a) => `<link rel="alternate" hreflang="${a.x}" href="${site.url}${u(a.p)}">`).join('\n')
        + `\n<link rel="alternate" hreflang="x-default" href="${site.url}${u(alts.find((a) => a.x === 'uk').p)}">` : '';
    const og = o.image || imgUrl(site.ogImage);
    const nav = (key, label, href) => `<a href="${u(href)}"${o.section === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
    const insta = site.instagram ? `<a href="${esc(site.instagram)}" target="_blank" rel="noopener">Instagram</a>` : '';
    const mail = site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : '';
    return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(abs)}">
${hre}
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(o.title || siteName(l))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:url" content="${esc(abs)}">
<meta property="og:locale" content="${l === 'uk' ? 'uk_UA' : 'en_GB'}">
${og ? `<meta property="og:image" content="${esc(og)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&amp;display=swap">
<link rel="stylesheet" href="${u('/assets/css/main.css')}?v=${S.v.css}">
${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>` : ''}
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
<header><div class="wrap bar">
${logo(l)}
<nav class="main" aria-label="${esc(t.mainNav)}">${nav('programme', t.nProg, '/' + l + '/')}${nav('publications', t.nPubs, '/' + l + '/publications/')}${nav('archive', t.nArchive, '/' + l + '/archive/')}${nav('about', t.nAbout, '/' + l + '/about/')}${nav('contact', t.nContact, '/' + l + '/contact/')}</nav>
${langSwitch(l, path)}
</div></header>
<main id="main" tabindex="-1"><div class="wrap">
${o.main}
</div></main>
<footer><div class="wrap foot"><div class="fl">${logo(l)}<span>${esc(siteName(l))}</span></div>
<div class="fl">${insta}${mail}${langSwitch(l, path)}</div></div></footer>
<script src="${u('/assets/js/main.js')}?v=${S.v.js}" defer></script>
</body>
</html>`;
  }

  /* ---------- компоненти ---------- */
  const eyebrow = (a, b, extra) => `<div class="eyebrow"><span data-date>${esc(a)}</span>${b ? `<span class="dim">${esc(b)}</span>` : ''}${extra || ''}</div>`;

  function eventCard(ev, l) {
    const t = T(l);
    return `<article class="card" data-start="${esc(ev.start || '')}" data-end="${esc(ev.end || ev.start || '')}" data-status="${esc(ev.status)}" data-cat="${esc(ev.category)}">
<a class="card-link" href="${u(evUrl(l, ev.key))}">
<div class="ph">${picture(ev.image, ev.imageAlt, { sizes: '(min-width: 900px) 33vw, (min-width: 620px) 50vw, 100vw' })}</div>
<div class="cmeta"><span class="eyebrow"><span data-date>${esc(eventDate(ev, l))}</span><span class="dim">${esc(t.cat1[ev.category] || '')}</span></span>${ico.arrow}</div>
<h3 class="ctitle">${esc(ev.title)}</h3>
${ev.summary ? `<p class="cdesc">${esc(ev.summary)}</p>` : ''}
</a></article>`;
  }
  function pubCard(pb, l) {
    const t = T(l);
    return `<article class="card" data-cat="${esc(pb.type)}">
<a class="card-link" href="${u(pbUrl(l, pb.key))}">
<div class="ph wide">${picture(pb.image, pb.imageAlt, { sizes: '(min-width: 760px) 50vw, 100vw' })}</div>
<div class="cmeta"><span class="eyebrow"><span>${esc(pubDate(pb, l))}</span><span class="dim">${esc(t.type1[pb.type] || '')}</span></span>${ico.arrow}</div>
<h3 class="ctitle">${esc(pb.title)}</h3>
${pb.summary ? `<p class="cdesc">${esc(pb.summary)}</p>` : ''}
</a></article>`;
  }
  function row(href, img, title, sub) {
    const inner = `<div class="ph">${picture(img, '', { sizes: '112px' })}</div><div><div class="rtitle">${esc(title)}</div>${sub ? `<div class="rsub">${esc(sub)}</div>` : ''}</div>${href ? ico.arrow : '<span></span>'}`;
    return href ? `<a class="row" href="${u(href)}">${inner}</a>` : `<div class="row">${inner}</div>`;
  }
  function ext(href, label) {
    return href ? `<a class="xlink" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ${ico.ext}</a>` : '';
  }
  function partnerHtml(p, l) {
    const mark = p.logo ? `<span class="mk logo-img" aria-hidden="true"><img src="${u(p.logo)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="mk${String(p.name).length > 5 ? ' s' : ''}" aria-hidden="true">${esc(p.name)}</span>`;
    const name = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name);
    const d = loc(p.description, l);
    return `<li class="partner">${mark}<div><div class="pn">${name}</div>${d ? `<div class="ps">${esc(d)}</div>` : ''}</div></li>`;
  }
  function person(p, l) {
    const av = p.photo ? `<div class="av">${picture(p.photo, '', { sizes: '56px' })}</div>` : '<div class="av"></div>';
    return `<div class="person">${av}<div><div class="pname">${esc(loc(p.name, l))}</div><div class="prole">${esc(loc(p.role, l))}</div></div>`
      + (loc(p.bio, l) ? `<p class="pbio">${esc(loc(p.bio, l))}</p>` : '')
      + (p.instagram ? `<div class="pl">${ext(p.instagram, T(l).instagram)}</div>` : '') + '</div>';
  }
  const plural = (n, pair) => `${n} ${n === 1 ? pair[0] : pair[1]}`;

  /* ---------- сторінки ---------- */
  function programme(l) {
    const t = T(l);
    const evs = S.events.filter((e) => e.lang === l);
    const up = evs.filter(isUpcoming).sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1);
    const past = evs.filter((e) => !isUpcoming(e)).sort((a, b) => (a.start < b.start ? 1 : -1));
    const cats = Object.keys(t.cats);
    const panel = (id, list, label) => `<section data-panel="${id}" aria-labelledby="h-${id}"><h2 class="h3 panel-title" id="h-${id}">${esc(label)}</h2>
<div class="grid g3" data-list>${list.map((e) => eventCard(e, l)).join('')}</div>
<p class="empty" data-empty${list.length ? ' hidden' : ''}>${esc(t.empty)}</p></section>`;
    const main = `<div class="page">
<div class="hero"><div class="stack"><h1 class="display">${esc(t.nProg)}</h1><p class="lead">${esc(loc(site.description, l) || t.progSub)}</p></div>${site.heroImage ? `<div class="ph">${picture(site.heroImage, '', { eager: true, sizes: '(min-width: 820px) 36vw, 100vw' })}</div>` : ''}</div>
<div data-programme data-filterable>
<div class="bars">
<div class="tabs big" data-tabs hidden><button type="button" data-tab="up" aria-pressed="true">${esc(t.up)} <span data-count></span></button><button type="button" data-tab="past" aria-pressed="false">${esc(t.past)} <span data-count></span></button></div>
<div class="tabs" data-filters hidden><button type="button" data-filter="all" aria-pressed="true">${esc(t.all)}</button>${cats.map((c) => `<button type="button" data-filter="${c}" aria-pressed="false">${esc(t.cats[c])}</button>`).join('')}</div>
</div>
${panel('up', up, t.up)}
${panel('past', past, t.past)}
<p class="sr" role="status" aria-live="polite" data-status data-template="${esc(t.shown)}"></p>
</div></div>`;
    return layout({ lang: l, path: `/${l}/`, section: 'programme', main });
  }

  function publications(l) {
    const t = T(l);
    const list = S.pubs.filter((p) => p.lang === l).sort((a, b) => ((b.published || '9999') > (a.published || '9999') ? 1 : -1));
    const types = Object.keys(t.types);
    const main = `<div class="page"><div class="stack"><h1 class="display">${esc(t.pubsTitle)}</h1><p class="lead">${esc(t.pubsSub)}</p></div>
<div data-filterable>
<div class="tabs" data-filters hidden>${types.map((k) => `<button type="button" data-filter="${k === 'all' ? 'all' : k}" aria-pressed="${k === 'all'}">${esc(t.types[k])}</button>`).join('')}</div>
<div class="grid g2" data-list>${list.map((p) => pubCard(p, l)).join('')}</div>
<p class="empty" data-empty${list.length ? ' hidden' : ''}>${esc(t.empty)}</p>
<p class="sr" role="status" aria-live="polite" data-status data-template="${esc(t.shown)}"></p>
</div></div>`;
    return layout({ lang: l, path: `/${l}/publications/`, section: 'publications', title: t.pubsTitle, description: t.pubsSub, main });
  }

  function archiveIndex(l) {
    const t = T(l);
    const years = S.years[l] || [];
    const main = `<div class="page"><div class="stack"><h1 class="display">${esc(t.archiveTitle)}</h1><p class="lead">${esc(t.archiveSub)}</p></div>
${years.length ? `<ul class="years">${years.map((y) => `<li><a class="year" href="${u(`/${l}/archive/${y.year}/`)}"><span class="ynum">${y.year}</span><span class="ycount">${esc([y.events.length ? plural(y.events.length, t.nEvents) : '', y.pubs.length ? plural(y.pubs.length, t.nPubsCount) : ''].filter(Boolean).join(' · '))}</span>${ico.arrow}</a></li>`).join('')}</ul>` : `<p class="empty">${esc(t.empty)}</p>`}</div>`;
    return layout({ lang: l, path: `/${l}/archive/`, section: 'archive', title: t.archiveTitle, description: t.archiveSub, main });
  }
  function archiveYear(l, y) {
    const t = T(l);
    const years = S.years[l] || [];
    const evs = y.events.slice().sort((a, b) => (a.start < b.start ? 1 : -1));
    const pbs = y.pubs.slice().sort((a, b) => (a.published < b.published ? 1 : -1));
    const main = `<div class="page"><div class="stack"><a class="back" href="${u(`/${l}/archive/`)}">${ico.back} ${esc(t.backArchive)}</a><h1 class="display">${y.year}</h1>
<nav class="tabs" aria-label="${esc(t.years)}">${years.map((x) => `<a class="tablink" href="${u(`/${l}/archive/${x.year}/`)}"${x.year === y.year ? ' aria-current="page"' : ''}>${x.year}</a>`).join('')}</nav></div>
${evs.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.eventsH)}</h2><div class="rows">${evs.map((e) => row(evUrl(l, e.key), e.image, e.title, `${eventDate(e, l)} · ${t.cat1[e.category] || ''}`)).join('')}</div></section>` : ''}
${pbs.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.pubsH)}</h2><div class="rows">${pbs.map((p) => row(pbUrl(l, p.key), p.image, p.title, `${pubDate(p, l)} · ${t.type1[p.type] || ''}`)).join('')}</div></section>` : ''}
</div>`;
    return layout({ lang: l, path: `/${l}/archive/${y.year}/`, section: 'archive', title: `${t.archiveTitle} ${y.year}`, main });
  }

  function eventPage(ev) {
    const l = ev.lang; const t = T(l);
    const up = isUpcoming(ev);
    const facts = [];
    if (ev.location) facts.push(`<span>${ico.pin}${esc(ev.location)}</span>`);
    const timeTxt = ev.time || (okTime(ev.startTime) ? ev.startTime + (okTime(ev.endTime) ? ' – ' + ev.endTime : '') : '');
    if (timeTxt) facts.push(`<span>${ico.clock}${esc(timeTxt)}</span>`);
    if (ev.involved) facts.push(`<span>${ico.tag}${esc(ev.involved)}</span>`);
    const langName = t.langNames[ev.eventLanguage];
    const interp = (Array.isArray(ev.interpretation) ? ev.interpretation : []).map((x) => t.interp[x]).filter(Boolean);
    const sched = (ev.schedule || []).filter((x) => x && (x.title || x.time));
    const infoRows = [];
    if (ev.address) infoRows.push([t.addrL, esc(ev.address) + (ev.mapUrl ? ` <a class="ulink" href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">${esc(t.openMap)} ${ico.ext}</a>` : '')]);
    else if (ev.mapUrl) infoRows.push([t.addrL, `<a class="ulink" href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">${esc(t.openMap)} ${ico.ext}</a>`]);
    if (ev.directions) infoRows.push([t.dirL, esc(ev.directions).replace(/\n/g, '<br>')]);
    if (ev.accessibility) infoRows.push([t.accL, esc(ev.accessibility).replace(/\n/g, '<br>')]);
    if (langName || interp.length) infoRows.push([t.langL, esc([langName].concat(interp).filter(Boolean).join(' · '))]);
    const gal = (ev.gallery || []).filter((g) => g && g.image);
    const docs = (ev.documentation || []).filter((g) => g && g.image);
    const evPartners = (ev.partners || []).map((id) => partners.find((p) => p.id === id)).filter(Boolean);
    const hero = gal.length
      ? `<div class="gallery-wrap" data-gallery><div class="gallery" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(t.galleryLabel)}">${gal.map((g, i) => `<figure class="slide" aria-label="${i + 1} / ${gal.length}">${picture(g.image, loc(g.alt, l), { eager: i === 0, sizes: '(min-width: 900px) 60vw, 100vw' })}</figure>`).join('')}</div>
${gal.length > 1 ? `<button type="button" class="gbtn l" data-dir="-1" aria-label="${esc(t.prev)}" hidden>${ico.left}</button><button type="button" class="gbtn r" data-dir="1" aria-label="${esc(t.next)}" hidden>${ico.right}</button>` : ''}</div>`
      : (ev.image ? `<div class="ph cover">${picture(ev.image, ev.imageAlt, { eager: true, sizes: '(min-width: 900px) 60vw, 100vw' })}</div>` : '');
    const badge = `<span class="badge" data-badge data-start="${esc(ev.start || '')}" data-end="${esc(ev.end || ev.start || '')}" data-status="${esc(ev.status)}" data-up="${esc(t.badgeUp)}" data-past="${esc(t.badgePast)}">${esc(up ? t.badgeUp : t.badgePast)}</span>`;
    const main = `<div class="page">
<div class="stack"><a class="back" href="${u(`/${l}/`)}">${ico.back} ${esc(t.backProg)}</a></div>
<div class="ev"><div class="page tight">
<div class="stack">${eyebrow(eventDate(ev, l), t.cat1[ev.category], badge)}
<h1 class="h1">${esc(ev.title)}</h1>
${(ev.lead || ev.summary) ? `<p class="lead">${esc(ev.lead || ev.summary)}</p>` : ''}
${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}</div>
${hero}
${ev.html ? `<div class="body">${ev.html}</div>` : ''}
${sched.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.schedH)}</h2><ol class="sched">${sched.map((x) => `<li><span class="st">${esc(x.time || '')}</span><span><span class="stt">${esc(x.title || '')}</span>${x.description ? `<span class="std">${esc(x.description)}</span>` : ''}</span></li>`).join('')}</ol></section>` : ''}
${infoRows.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.infoH)}</h2><dl class="dl">${infoRows.map((r) => `<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('')}</dl></section>` : ''}
${ev.resultsHtml ? `<section class="rule"><h2 class="h3 mb">${esc(t.results)}</h2><div class="body">${ev.resultsHtml}</div></section>` : ''}
${ev.videoUrl ? `<p><a class="btn" href="${esc(ev.videoUrl)}" target="_blank" rel="noopener">${esc(t.watchVideo)} ${ico.ext}</a></p>` : ''}
</div>
<aside class="side"><div class="blk"><button type="button" class="share" data-share data-copied="${esc(t.copied)}" data-manual="${esc(t.copyManual)}" hidden>${ico.share} ${esc(t.share)}</button><p class="note" role="status" data-share-msg></p></div>
${canCal(ev) ? `<div class="blk" data-cal data-start="${esc(ev.start)}" data-end="${esc(ev.end || ev.start)}" data-status="${esc(ev.status)}"><h2 class="h3">${esc(t.addCal)}</h2><div class="calbtns"><a class="btn" href="${esc(gcalUrl(ev))}" target="_blank" rel="noopener">${esc(t.gcal)} ${ico.ext}</a><a class="btn" href="${u(evUrl(l, ev.key) + 'event.ics')}" download>${esc(t.icsL)}</a></div></div>` : ''}
${evPartners.length ? `<div class="blk"><h2 class="h3">${esc(t.partners)}</h2><ul class="plist">${evPartners.map((p) => partnerHtml(p, l)).join('')}</ul></div>` : ''}</aside></div>
${ev.artist && ev.artist.name ? `<section class="rule"><h2 class="h3 mb">${esc(t.aboutArtist)}</h2><div class="person big">${ev.artist.photo ? `<div class="av">${picture(ev.artist.photo, ev.artist.name, { sizes: '96px' })}</div>` : ''}<div><div class="pname">${esc(ev.artist.name)}</div>${ev.artist.bio ? `<p class="pbio">${esc(ev.artist.bio)}</p>` : ''}${ext(ev.artist.instagram, t.instagram)}</div></div></section>` : ''}
${docs.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.documentation)}</h2><div class="docs">${docs.map((g) => `<div class="ph">${picture(g.image, loc(g.alt, l), { sizes: '(min-width: 700px) 25vw, 50vw' })}</div>`).join('')}</div></section>` : ''}
</div>`;
    const jsonld = ev.start ? {
      '@context': 'https://schema.org', '@type': 'Event', name: ev.title,
      startDate: ev.start, endDate: ev.end || ev.start,
      eventStatus: 'https://schema.org/EventScheduled', inLanguage: l,
      description: ev.summary || ev.lead || undefined,
      image: ev.image ? [imgUrl(ev.image)] : undefined,
      location: ev.location ? { '@type': 'Place', name: ev.location } : undefined,
      organizer: { '@type': 'Organization', name: siteName(l), url: site.url }
    } : null;
    return layout({ lang: l, path: evUrl(l, ev.key), section: 'programme', title: ev.title, description: ev.summary || ev.lead, image: imgUrl(ev.image), ogType: 'article', jsonld, main });
  }

  function publicationPage(pb) {
    const l = pb.lang; const t = T(l);
    const facts = [];
    if (pb.period) facts.push(`<span>${ico.cal}${esc(pb.period)}</span>`);
    if (pb.where) facts.push(`<span>${ico.pin}${esc(pb.where)}</span>`);
    if (pb.format) facts.push(`<span>${ico.tag}${esc(pb.format)}</span>`);
    const texts = (pb.texts || []).filter((x) => x && x.title);
    const main = `<div class="page">
<div class="stack"><a class="back" href="${u(`/${l}/publications/`)}">${ico.back} ${esc(t.backPubs)}</a>
${eyebrow(pubDate(pb, l), t.type1[pb.type])}
<h1 class="h1">${esc(pb.title)}</h1>
${pb.summary ? `<p class="lead">${esc(pb.summary)}</p>` : ''}
${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}</div>
${pb.image ? `<div class="ph cover">${picture(pb.image, pb.imageAlt, { eager: true, sizes: '(min-width: 1240px) 1176px, 100vw' })}</div>` : ''}
${pb.html ? `<div class="body">${pb.html}</div>` : ''}
${texts.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.essaysAuthors)}</h2><div class="rows">${texts.map((x) => {
      const sub = x.authors || '';
      const inner = `<div class="ph">${picture(x.image, '', { sizes: '112px' })}</div><div><div class="rtitle">${esc(x.title)}</div>${sub ? `<div class="rsub">${esc(sub)}</div>` : ''}${x.url ? '' : `<div class="rsub">${esc(t.soon)}</div>`}</div>${x.url ? ico.arrow : '<span></span>'}`;
      return x.url ? `<a class="row" href="${esc(x.url)}">${inner}</a>` : `<div class="row">${inner}</div>`;
    }).join('')}</div></section>` : ''}
</div>`;
    return layout({ lang: l, path: pbUrl(l, pb.key), section: 'publications', title: pb.title, description: pb.summary, image: imgUrl(pb.image), ogType: 'article', main });
  }

  function textPage(pg) {
    const l = pg.lang; const t = T(l);
    const team = (site.team || []).filter((p) => p && loc(p.name, l));
    const legal = site.legal || {};
    const legalRows = [[t.legalName, legal.name], [t.legalCode, legal.code], [t.legalAddress, legal.address]].filter((r) => r[1]);
    const main = `<div class="page"><div class="stack"><h1 class="display">${esc(pg.title)}</h1></div>
${pg.html ? `<div class="body big">${pg.html}</div>` : ''}
${team.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.team)}</h2><div class="two">${team.map((p) => person(p, l)).join('')}</div></section>` : ''}
${partners.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.partners)}</h2><ul class="plist inline">${partners.map((p) => partnerHtml(p, l)).join('')}</ul></section>` : ''}
${legalRows.length ? `<section class="rule"><h2 class="h3 mb">${esc(t.legal)}</h2><dl class="dl">${legalRows.map((r) => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl></section>` : ''}
</div>`;
    return layout({ lang: l, path: `/${l}/${pg.key}/`, section: pg.key, title: pg.title, description: pg.description, main });
  }

  function contact(l) {
    const t = T(l);
    const addr = loc(site.address, l);
    const line = (label, html) => `<div class="row kv"><div class="rsub">${esc(label)}</div><div class="rtitle">${html}</div></div>`;
    const rows = [];
    if (site.email) rows.push(line(t.cEmail, `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`));
    if (site.instagram) rows.push(line(t.cInstagram, `<a href="${esc(site.instagram)}" target="_blank" rel="noopener">${esc(site.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, ''))}</a>`));
    if (addr) rows.push(line(t.cAddress, esc(addr)));
    const main = `<div class="page"><div class="stack"><h1 class="display">${esc(t.contactTitle)}</h1></div>
<div class="rows">${rows.join('') || `<p class="empty">${esc(t.empty)}</p>`}</div></div>`;
    return layout({ lang: l, path: `/${l}/contact/`, section: 'contact', title: t.contactTitle, main });
  }

  function notFound() {
    const l = 'uk'; const t = T('uk'); const e = T('en');
    return layout({ lang: l, path: '/404.html', title: t.notFoundTitle,
      main: `<div class="page"><h1 class="display">404</h1><p class="lead">${esc(t.notFoundText)}</p><p class="lead">${esc(e.notFoundText)}</p><p><a class="btn" href="${u('/uk/')}">${esc(t.goHome)}</a> <a class="btn" href="${u('/en/')}">${esc(e.goHome)}</a></p></div>` });
  }

  function root() {
    const abs = site.url + u('/uk/');
    return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)}</title>
<link rel="canonical" href="${esc(abs)}">
<link rel="alternate" hreflang="uk" href="${esc(abs)}">
<link rel="alternate" hreflang="en" href="${esc(site.url + u('/en/'))}">
<link rel="alternate" hreflang="x-default" href="${esc(abs)}">
<meta http-equiv="refresh" content="0; url=${u('/uk/')}">
<script>
var l=(navigator.language||'uk').toLowerCase().indexOf('uk')===0?'uk':'en';
try{var s=localStorage.getItem('ucpn-lang');if(s==='uk'||s==='en')l=s;}catch(e){}
location.replace('${u('/')}'+l+'/');
</script></head>
<body><p><a href="${u('/uk/')}">Українською</a> · <a href="${u('/en/')}">English</a></p></body></html>`;
  }

  return { ics, canCal, programme, publications, archiveIndex, archiveYear, eventPage, publicationPage, textPage, contact, notFound, root, evUrl, pbUrl };
};
