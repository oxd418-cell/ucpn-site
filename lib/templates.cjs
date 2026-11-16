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
  const loc = (obj, l) => (obj == null ? '' : typeof obj === 'string' ? obj : (obj[l] || obj.uk || obj.en || ''));
  const siteName = (l) => loc(site.fullName, l) || site.name;
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

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
  function fmtSize(bytes, l) {
    if (!bytes) return '';
    const t = T(l);
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1).replace('.', t.decimal) + ' ' + t.mb;
    return Math.max(1, Math.round(bytes / 1024)) + ' ' + t.kb;
  }

  /* ---------- зображення ---------- */
  const FOCUS = { top: '50% 15%', center: '50% 50%', bottom: '50% 85%' };
  const focusAttr = (f) => (FOCUS[f] && f !== 'center' ? ` style="object-position:${FOCUS[f]}"` : '');
  function picture(src, alt, o) {
    o = o || {};
    const m = IMGS[src];
    if (!src || !m) return '<div class="ph-missing" role="img" aria-label="' + esc(alt || '') + '"></div>';
    const lazy = o.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    const fx = focusAttr(o.focus);
    if (m.raw) return `<img src="${u(src)}" alt="${esc(alt || '')}" ${lazy} decoding="async"${fx}>`;
    const sizes = o.sizes || '100vw';
    const set = (ext) => m.widths.map((w) => `${u('/assets/img/' + m.base + '-' + w + '.' + ext)} ${w}w`).join(', ');
    const fb = m.widths.filter((w) => w <= 800).pop() || m.widths[0];
    return `<picture><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
      + `<img src="${u('/assets/img/' + m.base + '-' + fb + '.jpg')}" srcset="${set('jpg')}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt || '')}" ${lazy} decoding="async"${fx}></picture>`;
  }
  const ratio = (src) => { const m = IMGS[src]; return m && m.w && m.h ? `${m.w}/${m.h}` : '3/2'; };
  function imgUrl(src) {
    const m = IMGS[src];
    if (!m) return '';
    if (m.raw) return site.url + u(src);
    const w = m.widths.filter((x) => x <= 1200).pop() || m.widths[0];
    return site.url + u('/assets/img/' + m.base + '-' + w + '.jpg');
  }

  /* ---------- стрілки (єдині значки на сайті) ---------- */
  const ico = {
    arrow: '<svg class="arrow" viewBox="0 0 24 14" width="24" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M0 7h22M16 1l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 14" width="24" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M24 7H2M8 1L2 7l6 6"/></svg>',
    dl: '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 1v11M4 8l5 5 5-5M2 17h14"/></svg>',
    left: '<svg viewBox="0 0 10 16" width="10" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 1L2 8l6 7"/></svg>',
    right: '<svg viewBox="0 0 10 16" width="10" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 1l6 7-6 7"/></svg>'
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
  const icsEsc = (x) => String(x || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
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

  const socials = (() => {
    const list = (Array.isArray(site.socials) ? site.socials : []).filter((s) => s && s.name && s.url);
    if (site.instagram && !list.some((s) => /instagram/i.test(s.name))) list.unshift({ name: 'Instagram', url: site.instagram });
    return list;
  })();

  function langSwitch(l, path) {
    const links = ['uk', 'en'].map((x) => {
      const alt = path.replace(/^\/(uk|en)\//, '/' + x + '/');
      const href = x === l ? path : (paths.has(alt) ? alt : `/${x}/`);
      const label = x === 'uk' ? 'UA' : 'EN';
      return `<a href="${u(href)}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true"' : ''}>${label}</a>`;
    });
    return `<div class="langs" role="group" aria-label="${esc(T(l).langLabel)}">${links[0]}<span aria-hidden="true">/</span>${links[1]}</div>`;
  }
  function logo(l) {
    return `<a class="logo" href="${u('/' + l + '/')}" aria-label="${esc(site.name)} — ${esc(siteName(l))}">${esc(site.name)}</a>`;
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
    const soc = socials.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join('');
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
<header class="site-head"><div class="wrap bar">
${logo(l)}
<nav class="main" aria-label="${esc(t.mainNav)}">${nav('programme', t.nProg, '/' + l + '/programme/')}${nav('publications', t.nPubs, '/' + l + '/publications/')}${nav('about', t.nAbout, '/' + l + '/about/')}${nav('contact', t.nContact, '/' + l + '/contact/')}</nav>
${langSwitch(l, path)}
</div></header>
<main id="main" tabindex="-1"><div class="wrap">
${o.main}
</div></main>
<footer><div class="wrap foot"><p class="fname"><b>${esc(site.name)}</b> – ${esc(loc(site.fullName, 'en') || siteName(l))}</p>
${soc ? `<nav class="fsoc" aria-label="${esc(t.socialNav)}">${soc}</nav>` : ''}</div></footer>
<script src="${u('/assets/js/main.js')}?v=${S.v.js}" defer></script>
</body>
</html>`;
  }

  /* ---------- компоненти ---------- */
  // Картка для головної та «Історій і публікацій»: фото, тип і дата, назва, стрілка.
  function card(it) {
    return `<article class="card" data-fade><a class="card-link" href="${u(it.href)}">
<div class="ph">${picture(it.image, it.imageAlt, { sizes: '(min-width: 760px) 50vw, 100vw', focus: it.focus })}</div>
<div class="cmeta"><span class="ctype">${esc(it.type)}</span><span class="cdate">${esc(it.date)}</span></div>
<h3 class="ctitle">${esc(it.title)}</h3>
${ico.arrow}
</a></article>`;
  }
  // Велика горизонтальна картка події: фото ліворуч, текст праворуч.
  function pcard(ev, l) {
    const t = T(l);
    return `<article class="pcard" data-start="${esc(ev.start || '')}" data-end="${esc(ev.end || ev.start || '')}" data-status="${esc(ev.status)}">
<a class="pcard-link" href="${u(evUrl(l, ev.key))}">
<div class="ph">${picture(ev.image, ev.imageAlt, { sizes: '(min-width: 900px) 50vw, 100vw', focus: ev.imageFocus })}</div>
<div class="pbody"><div class="cmeta"><span class="ctype">${esc(t.cat1[ev.category] || '')}</span><span class="cdate">${esc(eventDate(ev, l))}</span></div>
<h3 class="ctitle">${esc(ev.title)}</h3>
${ev.summary ? `<p class="cdesc">${esc(ev.summary)}</p>` : ''}
${ico.arrow}</div>
</a></article>`;
  }
  function table(rows) {
    return `<dl class="kv">${rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('')}</dl>`;
  }
  function section(label, inner) {
    return `<section class="sec"><h2 class="label">${esc(label)}</h2>${inner}</section>`;
  }
  function partnerHtml(p, l) {
    const mark = p.logo ? `<span class="mk logo-img" aria-hidden="true"><img src="${u(p.logo)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="mk${String(p.name).length > 5 ? ' s' : ''}" aria-hidden="true">${esc(p.name)}</span>`;
    const name = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name);
    const d = loc(p.description, l);
    return `<li class="partner">${mark}<div><div class="pn">${name}</div>${d ? `<div class="ps">${esc(d)}</div>` : ''}</div></li>`;
  }
  function person(p, l) {
    const av = p.photo ? `<div class="av">${picture(p.photo, '', { sizes: '64px' })}</div>` : '<div class="av"></div>';
    return `<div class="person">${av}<div><div class="pname">${esc(loc(p.name, l))}</div><div class="prole">${esc(loc(p.role, l))}</div></div>`
      + (loc(p.bio, l) ? `<p class="pbio">${esc(loc(p.bio, l))}</p>` : '')
      + (p.instagram ? `<p class="pl"><a href="${esc(p.instagram)}" target="_blank" rel="noopener">${esc(T(l).instagram)}</a></p>` : '') + '</div>';
  }
  // Карусель фото: рядок зі scroll-snap, кнопки з'являються лише з увімкненим скриптом.
  function carousel(list, l, eagerFirst) {
    if (!list.length) return '';
    const t = T(l);
    const slides = list.map((g, i) => `<figure class="slide" style="aspect-ratio:${ratio(g.image)}">${picture(g.image, loc(g.alt, l), { eager: eagerFirst && i === 0, sizes: '(min-width: 900px) 50vw, 90vw' })}</figure>`).join('');
    return `<div class="carousel" data-carousel><div class="track" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(t.galleryLabel)}">${slides}</div>`
      + (list.length > 1 ? `<button type="button" class="cbtn l" data-dir="-1" aria-label="${esc(t.prev)}" hidden>${ico.left}</button><button type="button" class="cbtn r" data-dir="1" aria-label="${esc(t.next)}" hidden>${ico.right}</button>` : '') + '</div>';
  }
  // Нижній блок сторінки: «У межах», «Партнери», за потреби «Підтримка».
  function footBlock(l, within, ids) {
    const t = T(l);
    const list = (ids || []).map((id) => partners.find((p) => p.id === id)).filter(Boolean);
    const link = (p) => (p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name));
    const pa = list.filter((p) => p.role !== 'grantor');
    const gr = list.filter((p) => p.role === 'grantor');
    const cols = [`<div class="mf"><div class="mf-l">${esc(t.within)}</div><div class="mf-v strong">${esc(within || site.name)}</div></div>`];
    if (pa.length) cols.push(`<div class="mf"><div class="mf-l">${esc(t.partners)}</div><ul class="mf-v">${pa.map((p) => `<li>${link(p)}</li>`).join('')}</ul></div>`);
    if (gr.length) cols.push(`<div class="mf"><div class="mf-l">${esc(t.support)}</div><ul class="mf-v">${gr.map((p) => `<li>${link(p)}${loc(p.description, l) ? `<span class="mf-d">${esc(loc(p.description, l))}</span>` : ''}</li>`).join('')}</ul></div>`);
    return `<div class="mfoot" style="--n:${cols.length}">${cols.join('')}</div>`;
  }

  /* ---------- сторінки ---------- */
  function focus(l) {
    const t = T(l);
    const items = [];
    S.events.filter((e) => e.lang === l && e.status === 'scheduled' && e.start).forEach((e) => items.push({ d: e.start, href: evUrl(l, e.key), image: e.image, imageAlt: e.imageAlt, focus: e.imageFocus, type: t.cat1[e.category] || '', date: eventDate(e, l), title: e.title }));
    S.pubs.filter((p) => p.lang === l && p.published).forEach((p) => items.push({ d: p.published, href: pbUrl(l, p.key), image: p.image, imageAlt: p.imageAlt, focus: p.imageFocus, type: t.type1[p.type] || '', date: pubDate(p, l), title: p.title }));
    items.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    const limit = +site.focusCount > 0 ? +site.focusCount : 8;
    const shown = items.slice(0, limit);
    const main = `<div class="page"><div class="page-head"><h1 class="display">${esc(t.focusTitle)}</h1></div>
${shown.length ? `<div class="cards">${shown.map(card).join('')}</div>` : `<p class="empty">${esc(t.empty)}</p>`}</div>`;
    return layout({ lang: l, path: `/${l}/`, section: '', main });
  }

  function programme(l) {
    const t = T(l);
    const evs = S.events.filter((e) => e.lang === l);
    const up = evs.filter(isUpcoming).sort((a, b) => ((a.start || '9999') < (b.start || '9999') ? -1 : 1));
    const past = evs.filter((e) => !isUpcoming(e)).sort((a, b) => (a.start < b.start ? 1 : -1));
    const panel = (id, list, label, emptyText) => `<section data-panel="${id}" aria-labelledby="h-${id}"><h2 class="label panel-title" id="h-${id}">${esc(label)}</h2>
<div class="pcards" data-list>${list.map((e) => pcard(e, l)).join('')}</div>
<p class="empty" data-empty data-text="${esc(emptyText)}"${list.length ? ' hidden' : ''}>${esc(emptyText)}</p></section>`;
    const main = `<div class="page"><div class="page-head"><h1 class="display">${esc(t.progTitle)}</h1></div>
<div data-programme>
<div class="tabbar" data-tabs hidden><button type="button" data-tab="up" aria-pressed="true">${esc(t.up)}</button><button type="button" data-tab="past" aria-pressed="false">${esc(t.past)}</button></div>
${panel('up', up, t.up, t.emptyUp)}
${panel('past', past, t.past, t.emptyPast)}
</div></div>`;
    return layout({ lang: l, path: `/${l}/programme/`, section: 'programme', title: t.progTitle, main });
  }

  function publications(l) {
    const t = T(l);
    const list = S.pubs.filter((p) => p.lang === l).sort((a, b) => ((b.published || '9999') > (a.published || '9999') ? 1 : -1));
    const main = `<div class="page"><div class="page-head"><h1 class="display">${esc(t.pubsTitle)}</h1></div>
${list.length ? `<div class="cards">${list.map((p) => card({ href: pbUrl(l, p.key), image: p.image, imageAlt: p.imageAlt, focus: p.imageFocus, type: t.type1[p.type] || '', date: pubDate(p, l), title: p.title })).join('')}</div>` : `<p class="empty">${esc(t.empty)}</p>`}</div>`;
    return layout({ lang: l, path: `/${l}/publications/`, section: 'publications', title: t.pubsTitle, main });
  }

  function eventPage(ev) {
    const l = ev.lang; const t = T(l);
    const up = isUpcoming(ev);
    const timeTxt = ev.time || (okTime(ev.startTime) ? ev.startTime + (okTime(ev.endTime) ? ' – ' + ev.endTime : '') : '');
    const facts = [[t.fDate, esc(eventDate(ev, l))]];
    if (timeTxt) facts.push([t.fTime, esc(timeTxt)]);
    if (ev.location) facts.push([t.fLocation, esc(ev.location)]);
    if (ev.format) facts.push([t.fFormat, esc(ev.format)]);
    if (ev.involved) facts.push([t.fParticipants, esc(ev.involved)]);
    const langName = t.langNames[ev.eventLanguage];
    const interp = (Array.isArray(ev.interpretation) ? ev.interpretation : []).map((x) => t.interp[x]).filter(Boolean);
    const sched = (ev.schedule || []).filter((x) => x && (x.title || x.time));
    const infoRows = [];
    const mapLink = ev.mapUrl ? ` <a href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">${esc(t.openMap)}</a>` : '';
    if (ev.address) infoRows.push([t.addrL, esc(ev.address) + mapLink]);
    else if (ev.mapUrl) infoRows.push([t.addrL, mapLink.trim()]);
    if (ev.directions) infoRows.push([t.dirL, nl2br(ev.directions)]);
    if (ev.accessibility) infoRows.push([t.accL, nl2br(ev.accessibility)]);
    if (langName || interp.length) infoRows.push([t.langL, esc([langName].concat(interp).filter(Boolean).join(' · '))]);
    const photos = [].concat(ev.gallery || [], ev.documentation || []).filter((g) => g && g.image);
    const reg = ev.registrationUrl && up ? `<p class="actions" data-reg data-start="${esc(ev.start || '')}" data-end="${esc(ev.end || ev.start || '')}" data-status="${esc(ev.status)}"><a class="btn" href="${esc(ev.registrationUrl)}" target="_blank" rel="noopener">${esc(t.register)}</a></p>` : '';
    const cal = canCal(ev) ? `<p class="actions links" data-cal data-start="${esc(ev.start)}" data-end="${esc(ev.end || ev.start)}" data-status="${esc(ev.status)}"><span class="label">${esc(t.addCal)}</span><a href="${esc(gcalUrl(ev))}" target="_blank" rel="noopener">${esc(t.gcal)}</a><a href="${u(evUrl(l, ev.key) + 'event.ics')}" download>${esc(t.icsL)}</a></p>` : '';
    const main = `<div class="page tight">
<a class="back" href="${u(`/${l}/programme/`)}">${ico.back}<span>${esc(t.backProg)}</span></a>
<header class="phead"><p class="ctype muted">${esc(t.cat1[ev.category] || '')}</p>
<h1 class="h1">${esc(ev.title)}</h1>
${table(facts)}</header>
<div class="col">
${ev.lead ? `<p class="lead">${esc(ev.lead)}</p>` : ''}
${ev.html ? `<div class="body">${ev.html}</div>` : ''}
${reg}${cal}
${sched.length ? section(t.schedH, `<ol class="sched">${sched.map((x) => `<li><span class="st">${esc(x.time || '')}</span><span><span class="stt">${esc(x.title || '')}</span>${x.description ? `<span class="std">${esc(x.description)}</span>` : ''}</span></li>`).join('')}</ol>`) : ''}
${infoRows.length ? section(t.infoH, table(infoRows)) : ''}
${ev.resultsHtml ? section(t.results, `<div class="body">${ev.resultsHtml}</div>`) : ''}
${ev.videoUrl ? `<p class="actions links"><a href="${esc(ev.videoUrl)}" target="_blank" rel="noopener">${esc(t.watchVideo)}</a></p>` : ''}
${ev.artist && ev.artist.name ? section(t.aboutArtist, `<div class="person big">${ev.artist.photo ? `<div class="av">${picture(ev.artist.photo, ev.artist.name, { sizes: '96px' })}</div>` : ''}<div><div class="pname">${esc(ev.artist.name)}</div>${ev.artist.bio ? `<p class="pbio">${esc(ev.artist.bio)}</p>` : ''}${ev.artist.instagram ? `<p class="pl"><a href="${esc(ev.artist.instagram)}" target="_blank" rel="noopener">${esc(t.instagram)}</a></p>` : ''}</div></div>`) : ''}
</div>
${carousel(photos, l, true)}
${footBlock(l, ev.within, ev.partners)}
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
    return layout({ lang: l, path: evUrl(l, ev.key), section: 'programme', title: ev.title, description: ev.summary || ev.lead, image: imgUrl(ev.image) || undefined, ogType: 'article', jsonld, main });
  }

  function publicationPage(pb) {
    const l = pb.lang; const t = T(l);
    const facts = [];
    if (pb.authors) facts.push([t.fAuthors, esc(pb.authors)]);
    if (pb.period) facts.push([t.fPeriod, esc(pb.period)]);
    if (pb.where) facts.push([t.fWhere, esc(pb.where)]);
    if (pb.format) facts.push([t.fFormat, esc(pb.format)]);
    const texts = (pb.texts || []).filter((x) => x && x.title);
    const photos = (pb.gallery || []).filter((g) => g && g.image);
    const size = pb.pdf ? fmtSize(S.fileSize(pb.pdf), l) : '';
    const pdf = pb.pdf ? `<p class="pdfrow"><a href="${encodeURI(u(pb.pdf))}" download>${ico.dl}<b>${esc(t.downloadPdf)}</b>${size ? `<span class="muted">(${esc(size)})</span>` : ''}</a></p>` : '';
    const main = `<div class="page tight">
<div class="narrow stackp">
<a class="back" href="${u(`/${l}/publications/`)}">${ico.back}<span>${esc(t.backPubs)}</span></a>
<header class="phead"><p class="ptype"><span class="ctype muted">${esc(t.type1[pb.type] || '')}</span><span class="cdate">${esc(pubDate(pb, l))}</span></p>
<h1 class="h1">${esc(pb.title)}</h1>
${pb.summary ? `<p class="lead">${esc(pb.summary)}</p>` : ''}
${facts.length ? table(facts) : ''}</header>
${pb.image ? `<div class="ph cover">${picture(pb.image, pb.imageAlt, { eager: true, sizes: '(min-width: 1100px) 1000px, 100vw', focus: pb.imageFocus })}</div>` : ''}
${pb.html ? `<div class="body">${pb.html}</div>` : ''}
${texts.length ? section(t.essaysAuthors, `<div class="rows">${texts.map((x) => {
      const inner = `<div class="ph">${picture(x.image, '', { sizes: '112px' })}</div><div><div class="rtitle">${esc(x.title)}</div>${x.authors ? `<div class="rsub">${esc(x.authors)}</div>` : ''}${x.url ? '' : `<div class="rsub">${esc(t.soon)}</div>`}</div>${x.url ? ico.arrow : '<span></span>'}`;
      return x.url ? `<a class="row" href="${esc(x.url)}">${inner}</a>` : `<div class="row">${inner}</div>`;
    }).join('')}</div>`) : ''}
${carousel(photos, l, false)}
${pdf}
</div>
${footBlock(l, pb.within, pb.partners)}
</div>`;
    return layout({ lang: l, path: pbUrl(l, pb.key), section: 'publications', title: pb.title, description: pb.summary, image: imgUrl(pb.image) || undefined, ogType: 'article', main });
  }

  function textPage(pg) {
    const l = pg.lang; const t = T(l);
    const team = (site.team || []).filter((p) => p && loc(p.name, l));
    const legal = site.legal || {};
    const legalRows = [[t.legalName, legal.name], [t.legalCode, legal.code], [t.legalAddress, legal.address]].filter((r) => r[1]);
    const main = `<div class="page"><div class="page-head"><h1 class="display">${esc(pg.title)}</h1></div>
<div class="col">${pg.html ? `<div class="body big">${pg.html}</div>` : ''}</div>
${team.length ? section(t.team, `<div class="two">${team.map((p) => person(p, l)).join('')}</div>`) : ''}
${partners.length ? section(t.partners, `<ul class="plist">${partners.map((p) => partnerHtml(p, l)).join('')}</ul>`) : ''}
${legalRows.length ? section(t.legal, table(legalRows.map((r) => [r[0], esc(r[1])]))) : ''}
</div>`;
    return layout({ lang: l, path: `/${l}/${pg.key}/`, section: pg.key, title: pg.title, description: pg.description, main });
  }

  function contact(l) {
    const t = T(l);
    const addr = loc(site.address, l);
    const rows = [];
    if (site.email) rows.push([t.cEmail, `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`]);
    socials.forEach((s) => rows.push([s.name, `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`]));
    if (addr) rows.push([t.cAddress, esc(addr)]);
    const main = `<div class="page"><div class="page-head"><h1 class="display">${esc(t.contactTitle)}</h1></div>
${rows.length ? `<dl class="kv big">${rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('')}</dl>` : `<p class="empty">${esc(t.empty)}</p>`}</div>`;
    return layout({ lang: l, path: `/${l}/contact/`, section: 'contact', title: t.contactTitle, main });
  }

  function notFound() {
    const l = 'uk'; const t = T('uk'); const e = T('en');
    return layout({ lang: l, path: '/404.html', title: t.notFoundTitle,
      main: `<div class="page"><div class="page-head"><h1 class="display">404</h1></div><div class="col"><p class="lead">${esc(t.notFoundText)}</p><p class="lead">${esc(e.notFoundText)}</p><p class="actions"><a class="btn" href="${u('/uk/')}">${esc(t.goHome)}</a> <a class="btn" href="${u('/en/')}">${esc(e.goHome)}</a></p></div></div>` });
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

  return { ics, canCal, focus, programme, publications, eventPage, publicationPage, textPage, contact, notFound, root, evUrl, pbUrl };
};
