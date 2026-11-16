'use strict';
/*
 * Генератор сайту UCPN.
 *   npm run build   — збирає сайт у папку dist/
 *   npm start       — збирає і відкриває на http://localhost:8080
 * Контент лежить у src/content (події, публікації, сторінки) і src/data (налаштування, партнери).
 * Його редагує команда через CMS на /admin/.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const yaml = require('js-yaml');
const { marked } = require('marked');
const sharp = require('sharp');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const LANGS = ['uk', 'en'];
const CATEGORIES = ['event', 'practice', 'performance', 'publication', 'conversation'];
const PUB_TYPES = ['essay', 'story', 'publication', 'conversation', 'research', 'video'];
const FOCUS = ['top', 'center', 'bottom', 'full'];
const warn = (m) => console.warn('  ! ' + m);

/* ---------- допоміжне ---------- */
const readText = (p) => fs.readFileSync(p, 'utf8');
const loadYaml = (p) => (fs.existsSync(p) ? yaml.load(readText(p), { schema: yaml.CORE_SCHEMA }) || {} : {});
const hash = (buf) => crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name); const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function writeOut(urlPath, html) {
  const file = urlPath.endsWith('/') ? path.join(OUT, urlPath, 'index.html') : path.join(OUT, urlPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
const dateStr = (v) => {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : '';
};

/* ---------- контент ---------- */
function parseMd(file) {
  const raw = readText(file).replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? (yaml.load(m[1], { schema: yaml.CORE_SCHEMA }) || {}) : {};
  const body = m ? m[2] : raw;
  return { fm, body };
}
function loadCollection(name) {
  const dir = path.join(SRC, 'content', name);
  const items = [];
  if (!fs.existsSync(dir)) return items;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)\.(uk|en)\.md$/);
    if (!m) continue;
    const { fm, body } = parseMd(path.join(dir, f));
    const item = Object.assign({}, fm, { key: String(fm.key || m[1]), lang: m[2], file: f });
    item.html = body.trim() ? marked.parse(body) : '';
    items.push(item);
  }
  return items;
}

/* ---------- ZIP-архів фото (без сторонніх бібліотек; JPEG уже стиснені, тож файли зберігаються без стиснення) ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(files) {
  const parts = []; const central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'); const data = f.data; const crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    parts.push(lh, name, data); central.push(ch, name); offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/* ---------- зображення ---------- */
// Обходить і підпапки (напр. uploads/Albina/...): ключ у IMGS збігається з тим, що CMS пише в тексті («/assets/uploads/Albina/1.png»).
function listImages(dir, rel) {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...listImages(dir, r)); else out.push(r);
  }
  return out;
}
async function processImages() {
  const dir = path.join(SRC, 'assets', 'uploads');
  const meta = {};
  const outDir = path.join(OUT, 'assets', 'img');
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(dir)) return meta;
  for (const f of listImages(dir, '')) {
    const ext = path.extname(f).toLowerCase();
    const base = f.slice(0, f.length - ext.length).replace(/[^a-zA-Z0-9_-]+/g, '-') + '-' + hash(fs.readFileSync(path.join(dir, f)));
    const key = '/assets/uploads/' + f;
    if (['.svg', '.gif', '.png', '.jpg', '.jpeg', '.webp', '.avif'].indexOf(ext) < 0) continue;
    if (ext === '.svg') {
      // пропорції SVG (для однакового зорового розміру логотипів)
      const head = readText(path.join(dir, f)).slice(0, 2000);
      const vb = head.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
      meta[key] = { raw: true, ratio: vb ? +vb[1] / +vb[2] : 0 };
      continue;
    }
    if (ext === '.gif') { meta[key] = { raw: true }; continue; }
    const img = sharp(path.join(dir, f)).rotate();
    const info = await img.metadata();
    const rot = info.orientation && info.orientation >= 5;
    const w0 = rot ? info.height : info.width; const h0 = rot ? info.width : info.height;
    const widths = [400, 800, 1200, 1600].filter((w) => w < w0);
    widths.push(Math.min(w0, 1600));
    for (const w of widths) {
      for (const fmt of ['webp', 'jpg']) {
        const out = path.join(outDir, `${base}-${w}.${fmt}`);
        if (fs.existsSync(out)) continue;
        const p = sharp(path.join(dir, f)).rotate().resize({ width: w, withoutEnlargement: true });
        await (fmt === 'webp' ? p.webp({ quality: 78 }) : p.jpeg({ quality: 80, mozjpeg: true })).toFile(out);
      }
    }
    meta[key] = { w: Math.min(w0, 1600), h: Math.round(h0 * Math.min(w0, 1600) / w0), widths, base };
  }
  return meta;
}

/* ---------- збірка ---------- */
async function build() {
  const t0 = Date.now();
  const site = loadYaml(path.join(SRC, 'data', 'site.yml'));
  site.name = site.name || 'UCPN';
  site.url = String(site.url || 'https://example.org').replace(/\/$/, '');
  const partners = (loadYaml(path.join(SRC, 'data', 'partners.yml')).partners || []).filter((p) => p && p.id && p.name);

  const base = String(site.basePath || '').replace(/\/$/, '');
  // Посилання й картинки з CMS-тексту пишуться від кореня («/assets/...»): додаємо підкаталог сайту й лінивє завантаження.
  const fixHtml = (html) => String(html || '')
    .replace(/(src|href)="\/(?!\/)/g, '$1="' + base + '/')
    .replace(/<img /g, '<img loading="lazy" decoding="async" ');
  const fileSize = (urlPath) => {
    try { return fs.statSync(path.join(SRC, String(urlPath).replace(/^\//, ''))).size; } catch (e) { return 0; }
  };

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // CSS/JS з відбитком для кешування
  const v = {};
  for (const [kind, dir, file] of [['css', 'css', 'main.css'], ['js', 'js', 'main.js']]) {
    const src = path.join(SRC, 'assets', dir, file);
    const dst = path.join(OUT, 'assets', dir, file);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    v[kind] = hash(fs.readFileSync(src));
  }
  copyDir(path.join(SRC, 'assets', 'uploads'), path.join(OUT, 'assets', 'uploads'));
  copyDir(path.join(SRC, 'static'), OUT);
  copyDir(path.join(SRC, 'admin'), path.join(OUT, 'admin'));

  const IMGS = await processImages();

  // контент
  const events = loadCollection('events').map((e) => {
    e.start = dateStr(e.start); e.end = dateStr(e.end);
    e.status = ['scheduled', 'tba', 'development'].indexOf(e.status) >= 0 ? e.status : (e.start ? 'scheduled' : 'tba');
    if (e.status === 'scheduled' && !e.start) { warn(`${e.file}: статус «scheduled», але немає дати початку — показано як «буде анонсовано»`); e.status = 'tba'; }
    if (CATEGORIES.indexOf(e.category) < 0) { warn(`${e.file}: невідома категорія «${e.category}», використано «event»`); e.category = 'event'; }
    e.title = e.title || e.key;
    if (e.imageFocus && FOCUS.indexOf(String(e.imageFocus)) < 0 && !/^\d{1,3}$/.test(String(e.imageFocus))) e.imageFocus = '';
    e.html = fixHtml(e.html);
    e.resultsHtml = e.results ? fixHtml(marked.parse(String(e.results))) : '';
    return e;
  });
  const pubs = loadCollection('publications').map((p) => {
    p.published = dateStr(p.published);
    if (PUB_TYPES.indexOf(p.type) < 0) { warn(`${p.file}: невідомий тип «${p.type}», використано «essay»`); p.type = 'essay'; }
    p.title = p.title || p.key;
    if (p.imageFocus && FOCUS.indexOf(String(p.imageFocus)) < 0 && !/^\d{1,3}$/.test(String(p.imageFocus))) p.imageFocus = '';
    if (p.pdf && !fileSize(p.pdf)) { warn(`${p.file}: файл PDF «${p.pdf}» не знайдено`); p.pdf = ''; }
    p.html = fixHtml(p.html);
    return p;
  });
  // Сторінка вже має власний заголовок, тож перший «# Заголовок» у тексті (повтор назви) прибираємо, а картинку з нього лишаємо.
  // Архів фото для завантаження (вмикається в CMS для кожної події окремо): один файл на подію, спільний для обох мов.
  const zips = {};
  for (const e of events) {
    const on = e.photoDownload === true || e.photoDownload === 'true';
    if (!on) continue;
    if (!zips[e.key]) {
      const list = [].concat(e.gallery || [], e.documentation || []).filter((g) => g && g.image).map((g) => g.image);
      const files = []; let i = 0;
      for (const img of list) {
        const p = path.join(SRC, img.replace(/^\//, ''));
        if (!fs.existsSync(p)) continue;
        i += 1;
        files.push({ name: `UCPN-${e.key}-${String(i).padStart(2, '0')}${path.extname(p).toLowerCase()}`, data: fs.readFileSync(p) });
      }
      if (files.length) {
        const buf = makeZip(files);
        const rel = `/assets/zip/UCPN-${e.key}-${hash(buf)}.zip`;
        fs.mkdirSync(path.join(OUT, 'assets', 'zip'), { recursive: true });
        fs.writeFileSync(path.join(OUT, rel), buf);
        zips[e.key] = { url: rel, size: buf.length, count: files.length };
      }
    }
    if (zips[e.key]) e.zip = zips[e.key];
  }
  const pages = loadCollection('pages').map((pg) => {
    pg.html = fixHtml(pg.html).replace(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>/, (m, inner) => { const img = inner.match(/<img [^>]*>/); return img ? `<p>${img[0]}</p>` : ''; });
    return pg;
  });

  // реєстр сторінок (потрібен для hreflang і перемикача мов)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
  const paths = new Set();
  const plan = [];
  const add = (p, fn) => { paths.add(p); plan.push([p, fn]); };

  const S = { site, IMGS, today, partners, paths, events, pubs, v, fileSize };
  const R = require('./lib/templates.cjs')(S);

  for (const l of LANGS) {
    add(`/${l}/`, () => R.focus(l));
    add(`/${l}/programme/`, () => R.programme(l));
    add(`/${l}/publications/`, () => R.publications(l));
    add(`/${l}/contact/`, () => R.contact(l));
  }
  events.forEach((e) => add(R.evUrl(e.lang, e.key), () => R.eventPage(e)));
  pubs.forEach((p) => add(R.pbUrl(p.lang, p.key), () => R.publicationPage(p)));
  pages.forEach((pg) => add(`/${pg.lang}/${pg.key}/`, () => R.textPage(pg)));

  for (const [p, fn] of plan) writeOut(p, fn());
  events.filter(R.canCal).forEach((e) => writeOut(R.evUrl(e.lang, e.key) + 'event.ics', R.ics(e)));
  writeOut('/index.html', R.root());
  writeOut('/404.html', R.notFound());

  // sitemap + robots
  const urls = [...paths].sort().map((p) => {
    const alts = LANGS.map((x) => ({ x, p: p.replace(/^\/(uk|en)\//, '/' + x + '/') })).filter((a) => paths.has(a.p));
    const links = alts.length > 1 ? alts.map((a) => `<xhtml:link rel="alternate" hreflang="${a.x}" href="${site.url}${base}${a.p}"/>`).join('') : '';
    return `<url><loc>${site.url}${base}${p}</loc>${links}</url>`;
  });
  writeOut('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  writeOut('/robots.txt', `User-agent: *\nDisallow: /admin/\nSitemap: ${site.url}${base}/sitemap.xml\n`);

  console.log(`Готово: ${plan.length + 2} сторінок, ${events.length} подій, ${pubs.length} публікацій за ${((Date.now() - t0) / 1000).toFixed(1)} с → dist/`);
  if (site.url === 'https://example.org') warn('У src/data/site.yml поле url ще містить example.org — вкажіть справжню адресу сайту (потрібно для SEO).');
}

/* ---------- локальний сервер ---------- */
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain', '.yml': 'text/yaml' };
  const port = process.env.PORT || 8080;
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.join(OUT, p);
    if (!file.startsWith(OUT)) { res.statusCode = 403; return res.end(); }
    if (!fs.existsSync(file) && fs.existsSync(file + '/index.html')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    if (!fs.existsSync(file)) { res.statusCode = 404; file = path.join(OUT, '404.html'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`http://localhost:${port}/`));
}

build().then(() => { if (process.argv.includes('--serve')) serve(); }).catch((e) => { console.error(e); process.exit(1); });
