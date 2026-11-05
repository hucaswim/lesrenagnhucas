#!/usr/bin/env node
/* HUCAS static site builder — tanpa dependensi (hanya Node.js bawaan).
   Jalankan:  node build.js   → hasil ada di folder dist/
   Membaca data.js (hasil admin.html) dan menghasilkan HTML statis:
   / (ID), /en/ (EN), /les-renang-<area>/, /en/swim-lessons-<area>/, /blog/, /blog/<slug>/, dst. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const SRC = __dirname;
const OUT = process.env.OUT || path.join(SRC, 'dist');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

/* ---------- load data ---------- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(SRC, 'data.js'), 'utf8'), sandbox);
const D = sandbox.window.HUCAS_DATA;
if (!D) throw new Error('data.js tidak berisi window.HUCAS_DATA');
D.seo = D.seo || {}; D.brand = D.brand || {}; D.images = D.images || {};
D.tracking = D.tracking || {}; D.pricingNotes = D.pricingNotes || {};
const BASE = String(D.seo.siteUrl || 'https://lesrenanghucas.com').trim().replace(/\/$/, '');
const BIZ = D.seo.businessName || 'HUCAS Swimming Class';
const TODAY = new Date().toISOString().slice(0, 10);

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pick = (o, f, L) => (o && (o[f + '_' + L] || o[f + '_id'] || o[f + '_en'])) || '';
const rp = p => (/^\s*rp/i.test(p) ? String(p).trim() : 'Rp ' + String(p).trim());
const sess = s => String(s).replace(/\s*(sesi|sessions?)\s*$/i, '').trim();
function priceNum(s){ const n = parseFloat(String(s).replace(/\./g, '').replace(/[^0-9]/g, '')); return /K/i.test(s) ? n * 1000 : n; }
const home = L => (L === 'en' ? '/en/' : '/');
function mkdirp(p){ fs.mkdirSync(p, { recursive: true }); }
function write(rel, content){ const f = path.join(OUT, rel); mkdirp(path.dirname(f)); fs.writeFileSync(f, content); }
function copy(rel, to){ const f = path.join(SRC, rel); if (fs.existsSync(f)) { const t = path.join(OUT, to || rel); mkdirp(path.dirname(t)); fs.copyFileSync(f, t); } }

/* ---------- images: data-URI → file ---------- */
let imgCount = 0;
function extractImage(val, name){
  if (typeof val !== 'string' || !val) return '';
  const m = val.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/s);
  if (!m) return val;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 6);
  const rel = 'img/' + slugify(name) + '-' + hash + '.' + ext;
  write(rel, buf); imgCount++;
  return '/' + rel;
}
function imageSize(file){ // jpg/png only
  try {
    const b = fs.readFileSync(path.join(OUT, file.replace(/^\//, '')));
    if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    let i = 2; while (i < b.length) { if (b[i] !== 0xFF) { i++; continue; } const mk = b[i + 1];
      if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2); }
  } catch (e) {}
  return null;
}

/* ---------- markdown mini ---------- */
function inline(t){
  t = esc(t);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[^\s)]*)\)/g, '<a href="$2">$1</a>');
  return t;
}
function md(text){
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => {
    b = b.trim(); if (!b) return '';
    const out = []; let list = [], para = [];
    const fl = () => { if (list.length) { out.push('<ul>' + list.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>'); list = []; } };
    const fp = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    b.split('\n').forEach(l => {
      if (/^###\s+/.test(l)) { fl(); fp(); out.push('<h3>' + inline(l.replace(/^###\s+/, '')) + '</h3>'); }
      else if (/^##\s+/.test(l)) { fl(); fp(); out.push('<h2>' + inline(l.replace(/^##\s+/, '')) + '</h2>'); }
      else if (/^-\s+/.test(l)) { fp(); list.push(l.replace(/^-\s+/, '')); }
      else { fl(); para.push(l); }
    });
    fl(); fp(); return out.join('');
  }).join('');
}
const plain = s => String(s || '').replace(/[#*_`>\[\]]/g, '').replace(/\(https?:[^)]*\)/g, '').replace(/\s+/g, ' ').trim();

/* ---------- language stripper (HTML dua bahasa → satu bahasa) ---------- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function stripLang(html, lang){
  const other = lang === 'id' ? 'data-en' : 'data-id', mine = lang === 'id' ? 'data-id' : 'data-en';
  const otherRe = new RegExp('\\s' + other + '(?=[\\s=>/])'), mineRe = new RegExp('\\s' + mine + '(?:=(?:"[^"]*"|\'[^\']*\'|[^\\s>]+))?(?=[\\s>/])', 'g');
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let out = '', last = 0, skip = 0, m;
  while ((m = re.exec(html))) {
    const text = html.slice(last, m.index); last = re.lastIndex;
    if (!skip) out += text;
    if (m[0].startsWith('<!--')) { if (!skip) out += m[0]; continue; }
    const closing = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
    const selfClose = /\/\s*$/.test(attrs) || VOID.has(tag);
    if (skip) {
      if (!selfClose) { if (closing) skip--; else skip++; }
      continue;
    }
    if (!closing && otherRe.test(' ' + attrs + '>')) { if (!selfClose) skip = 1; continue; }
    out += closing ? m[0] : '<' + m[2] + (attrs + '>').replace(mineRe, '').slice(0, -1) + '>';
  }
  return out + (skip ? '' : html.slice(last));
}

/* ---------- Google Maps embed ---------- */
function mapInfo(loc){
  let raw = String(loc.mapUrl || '').trim();
  const z = '&t=&z=17&ie=UTF8&iwloc=&output=embed';
  const fm = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i); if (fm) raw = fm[1].replace(/&amp;/g, '&');
  const q = loc.mapQuery || ((loc.name || '') + ' ' + (loc.area || ''));
  let embed = 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + z, geo = null, link = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  if (/google\.[a-z.]+\/maps\/embed/i.test(raw)) {
    embed = raw;
    const lng = raw.match(/!2d(-?\d+\.\d+)/), lat = raw.match(/!3d(-?\d+\.\d+)/);
    if (lat && lng) geo = { lat: +lat[1], lng: +lng[1] };
  } else if (/^https?:\/\//i.test(raw)) {
    const c = raw.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (c) { geo = { lat: +c[1], lng: +c[2] }; embed = 'https://maps.google.com/maps?q=' + c[1] + ',' + c[2] + z; }
    link = raw;
  }
  if (geo && !/^https?:\/\//i.test(raw)) link = 'https://www.google.com/maps/search/?api=1&query=' + geo.lat + ',' + geo.lng;
  else if (geo && /embed/i.test(raw)) link = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  return { embed, geo, link };
}

/* ---------- prepare data ---------- */
const heroPath = extractImage(D.images.hero, 'kelas-renang-hucas-denpasar');
const heroSize = heroPath ? imageSize(heroPath) : null;
D.coaches.forEach(c => { c._photo = extractImage(c.photo, 'coach-' + c.name); });
D.locations.forEach(l => {
  l._slug = slugify(l.area || l.name);
  l._photo = extractImage(l.image, 'kolam-renang-' + l.name + '-' + l.area);
  l._map = mapInfo(l);
  l._urlId = '/les-renang-' + l._slug + '/';
  l._urlEn = '/en/swim-lessons-' + l._slug + '/';
});
D.blog.forEach(p => { p._slug = p.slug || p.id; p._img = extractImage(p.image, 'artikel-' + (p.slug || p.id)); });
const blogSorted = D.blog.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const ogImage = D.images.ogImage || (heroPath ? BASE + heroPath : BASE + '/logo.png');
const WA = 'https://wa.me/' + (D.brand.waBusiness || D.brand.phone);
const PHONE_DISP = D.brand.waBusinessDisplay || D.brand.phoneDisplay;
const TYPES = { adult: ['Adult Group Class', 'Adult Group Class'], kids: ['Kids Group Class', 'Kids Group Class'], private: ['Private 1-on-1', 'Private 1-on-1'] };
const urlFor = {
  home: L => home(L),
  blog: L => (L === 'en' ? '/en/blog/' : '/blog/'),
  post: (p, L) => (L === 'en' ? '/en/blog/' : '/blog/') + p._slug + '/',
  loc: (l, L) => (L === 'en' ? l._urlEn : l._urlId)
};
const T = {
  id: { sessions: 'sesi', popular: 'PALING LARIS', readMore: 'Baca selengkapnya →', open: '📍 Buka di Google Maps', since: 'Mengajar sejak', soon: 'Belum ada jadwal untuk kategori ini.', empty: 'Artikel segera hadir.', locale: 'id-ID', ogLocale: 'id_ID' },
  en: { sessions: 'sessions', popular: 'MOST POPULAR', readMore: 'Read more →', open: '📍 Open in Google Maps', since: 'Teaching since', soon: 'No schedule for this category yet.', empty: 'Articles coming soon.', locale: 'en-US', ogLocale: 'en_US' }
};
const fmtDate = (d, L, short) => new Date(d + 'T00:00:00').toLocaleDateString(T[L].locale, { day: 'numeric', month: short ? 'short' : 'long', year: 'numeric' });

/* ---------- dynamic sections ---------- */
function renderSchedule(type, L, locs){
  const rows = [];
  (locs || D.locations).forEach(loc => {
    const items = (loc.schedules || {})[type]; if (!items || !items.length) return;
    rows.push('<div class="sched-card"><h4>' + esc(loc.name) + '</h4><span class="loc-sub">' + esc(loc.area) + '</span>' +
      items.map(it => '<div class="sched-row"><span>' + esc(it.time) + '</span><b>' + esc(pick(it, 'days', L)) + '</b></div>').join('') + '</div>');
  });
  return rows.length ? rows.join('') : '<p class="sched-empty">' + T[L].soon + '</p>';
}
function renderPricing(key, L){
  const cards = (D.pricing[key] || []).map(p =>
    '<div class="price-card' + (p.best ? ' best' : '') + '">' + (p.best ? '<span class="best-badge">' + T[L].popular + '</span>' : '') +
    '<div class="price-sessions">' + esc(sess(p.sessions)) + ' ' + T[L].sessions + '</div><div class="price-value">' + esc(rp(p.price)) + '</div>' +
    '<div class="price-valid">' + esc(String(pick(p, 'valid', L)).replace(/\s+\)/g, ')').replace(/\s+/g, ' ').trim()) + '</div></div>').join('');
  const n = (D.pricingNotes || {})[key] || {};
  const note = n[L] || n.id || n.en || '';
  return cards + (note ? '<p class="class-note" style="grid-column:1/-1">' + esc(note) + '</p>' : '');
}
function renderCoaches(L){
  return D.coaches.map(c =>
    '<div class="coach-card"><div class="instructor-photo">' +
    (c._photo ? '<img class="coach-img" src="' + c._photo + '" alt="Coach ' + esc(c.name) + ' — ' + BIZ + '" loading="lazy" decoding="async">' : '<span>' + esc(c.initials) + '</span>') +
    '<div class="instructor-badge">Coach</div></div><div class="instructor-copy"><h3>' + esc(c.name) + '</h3>' +
    '<span class="role">' + esc(pick(c, 'role', L)) + ' · ' + T[L].since + ' ' + esc(c.since) + '</span>' + md(pick(c, 'bio', L)) + '</div></div>').join('');
}
function renderBlogCards(L, list){
  if (!list.length) return '<p class="blog-empty">' + T[L].empty + '</p>';
  return list.map(p => {
    const u = urlFor.post(p, L), title = pick(p, 'title', L);
    return '<article class="blog-card"><a class="blog-thumb-link" href="' + u + '" aria-label="' + esc(title) + '"><div class="blog-thumb"' +
      (p._img ? ' style="background-image:url(' + p._img + ')" role="img" aria-label="' + esc(title) + '"' : '') + '></div></a>' +
      '<div class="blog-body"><span class="blog-tag">' + esc(pick(p, 'tag', L)) + '</span><span class="blog-date">' + fmtDate(p.date, L, true) + '</span>' +
      '<h4><a href="' + u + '" style="text-decoration:none;color:inherit">' + esc(title) + '</a></h4><p>' + esc(pick(p, 'excerpt', L)) + '</p>' +
      '<a class="blog-link" href="' + u + '">' + T[L].readMore + '</a></div></article>';
  }).join('');
}
function renderFaq(L, n){
  return (D.faq || []).slice(0, n || 999).map((f, i) =>
    '<div class="faq-item' + (i === 0 ? ' open' : '') + '"><button class="faq-q" onclick="toggleFaq(this)" aria-expanded="' + (i === 0) + '"><span>' + esc(pick(f, 'q', L)) + '</span><span class="plus">+</span></button>' +
    '<div class="faq-a"><p>' + esc(pick(f, 'a', L)) + '</p></div></div>').join('');
}
function renderLevels(L){
  return (D.levels || []).map((lv, i) => '<div class="level-card lv' + (i + 1) + '"><div class="lv-num">' + (i + 1) + '</div><h4>' + esc(pick(lv, 'title', L)) + '</h4><p>' + esc(pick(lv, 'desc', L)) + '</p></div>').join('');
}
function renderTesti(L){
  const list = (D.testimonials || []).filter(t => (t.text_id || t.text_en) && String(t.name || '').trim());
  return list.map(t => '<figure class="testi-card"><blockquote><p>' + esc(pick(t, 'text', L)) + '</p></blockquote><figcaption><b>' + esc(t.name) + '</b><span>' + esc(pick(t, 'role', L)) + '</span></figcaption></figure>').join('');
}
function locItems(L){
  return D.locations.map((loc, i) =>
    '<div class="loc-item' + (i === 0 ? ' active' : '') + '" tabindex="0" role="button" data-map="' + esc(loc._map.embed) + '" data-photo="' + esc(loc._photo) + '" data-link="' + esc(loc._map.link) + '" data-alt="' + esc('Kolam renang ' + loc.name + ' ' + loc.area) + '">' +
    '<div class="loc-pin">' + (i + 1) + '</div><div><h4>' + esc(loc.name) + ' — ' + esc(loc.area) + '</h4><p>' + esc(pick(loc, 'note', L)) + '</p>' +
    '<p><a href="' + urlFor.loc(loc, L) + '" style="color:var(--pink);font-weight:700;text-decoration:none">' + (L === 'en' ? 'Swim lessons in ' : 'Les renang di ') + esc(loc.area) + ' →</a></p></div></div>').join('');
}

/* ---------- header / footer / layout ---------- */
const BODY = fs.readFileSync(path.join(SRC, 'template', 'body.html'), 'utf8');
const STYLE = fs.readFileSync(path.join(SRC, 'template', 'style.css'), 'utf8');
const SUBCSS = fs.readFileSync(path.join(SRC, 'template', 'sub.css'), 'utf8');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); return s.slice(i, j + b.length); };
const HEADER_T = between(BODY, '<header>', '</header>');
const FOOTER_T = between(BODY, '<footer>', '</footer>');
const WAFLOAT_T = between(BODY, '<a class="wa-float"', '</a>');

function langSwitch(L, urlId, urlEn){
  return '<div class="lang-switch"><a href="' + urlId + '" hreflang="id" lang="id" class="' + (L === 'id' ? 'active' : '') + '">ID</a><a href="' + urlEn + '" hreflang="en" lang="en" class="' + (L === 'en' ? 'active' : '') + '">EN</a></div>';
}
function fixLinks(html, L, onHome){
  const h = home(L);
  if (!onHome) html = html.replace(/href="(#[a-z-]+)"/g, (m, a) => 'href="' + h + a + '"');
  html = html.replace(/href="privacy\.html"/g, 'href="/privacy.html"');
  html = html.replace(/href="#"( target="_blank"[^>]*)?(\s+aria-label="WhatsApp")/g, 'href="' + WA + '"$1$2');
  return html;
}
function footerHtml(L, onHome){
  let f = stripLang(FOOTER_T, L);
  const contact = '<li><a href="' + WA + '" target="_blank" rel="noopener">📱 ' + esc(PHONE_DISP) + '</a></li>' +
    '<li><a href="mailto:' + esc(D.brand.email) + '">✉️ ' + esc(D.brand.email) + '</a></li>' +
    '<li><a href="https://instagram.com/' + esc(D.brand.instagram) + '" target="_blank" rel="noopener">📷 @' + esc(D.brand.instagram) + '</a></li>';
  f = f.replace(/<ul id="foot-contact"><\/ul>/, '<ul id="foot-contact">' + contact + '</ul>');
  f = f.replace(/id="ig-link" href="#"/, 'id="ig-link" href="https://instagram.com/' + esc(D.brand.instagram) + '"');
  f = f.replace(/<a class="wa-link" href="#" target="_blank" aria-label="WhatsApp">/, '<a class="wa-link" href="' + WA + '" target="_blank" rel="noopener" aria-label="WhatsApp">');
  f = f.replace(/<li><a href="#blog">Blog<\/a><\/li>/, '<li><a href="' + (onHome ? '#blog' : home(L) + '#blog') + '">Blog</a></li>');
  return fixLinks(f, L, onHome);
}
function headerHtml(L, onHome, urlId, urlEn){
  let h = stripLang(HEADER_T, L);
  h = h.replace(/<div class="lang-switch">[\s\S]*?<\/div>/, langSwitch(L, urlId, urlEn));
  h = h.replace(/(<a class="btn btn-yellow nav-cta" id="wa-cta-1" href=")#"/, '$1' + WA + '"').replace(/(<a class="btn btn-primary" id="wa-cta-2" href=")#"/, '$1' + WA + '"');
  h = h.replace(/<a class="brand" href="#top">/, '<a class="brand" href="' + (onHome ? '#top' : home(L)) + '">');
  h = h.replace(/(<a href="#blog">Blog<\/a>)/g, '<a href="' + (onHome ? '#blog' : home(L) + '#blog') + '">Blog</a>');
  h = h.replace(/<a href="#blog">Blog<\/a>/g, '<a href="' + urlFor.blog(L) + '">Blog</a>');
  return fixLinks(h, L, onHome);
}
function ldScript(obj){ return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>'; }
const siteCfg = () => JSON.stringify({ brand: { waBusiness: D.brand.waBusiness || D.brand.phone, phone: D.brand.phone, bookingWebhookUrl: D.brand.bookingWebhookUrl || '' } });
function layout(o){ // o: {L,title,desc,path,altId,altEn,onHome,main,ld[],ogImg,ogType,robots,extraHead,bodyEnd}
  const L = o.L, canon = BASE + o.path;
  const alts = (o.altId && o.altEn) ? '<link rel="alternate" hreflang="id" href="' + BASE + o.altId + '"><link rel="alternate" hreflang="en" href="' + BASE + o.altEn + '"><link rel="alternate" hreflang="x-default" href="' + BASE + o.altId + '">' : '';
  const og = o.ogImg || ogImage;
  return '<!DOCTYPE html>\n<html lang="' + L + '">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(o.title) + '</title>\n<meta name="description" content="' + esc(o.desc) + '">\n' +
    (o.keywords ? '<meta name="keywords" content="' + esc(o.keywords) + '">\n' : '') +
    '<meta name="robots" content="' + (o.robots || 'index, follow, max-image-preview:large') + '">\n<meta name="theme-color" content="#FFD400">\n' +
    '<meta name="geo.region" content="ID-BA"><meta name="geo.placename" content="Denpasar, Bali">\n' +
    '<link rel="canonical" href="' + canon + '">\n' + alts + '\n' +
    '<meta property="og:type" content="' + (o.ogType || 'website') + '"><meta property="og:site_name" content="' + esc(BIZ) + '"><meta property="og:locale" content="' + T[L].ogLocale + '">' +
    '<meta property="og:title" content="' + esc(o.title) + '"><meta property="og:description" content="' + esc(o.desc) + '"><meta property="og:url" content="' + canon + '"><meta property="og:image" content="' + esc(og) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(o.title) + '"><meta name="twitter:description" content="' + esc(o.desc) + '"><meta name="twitter:image" content="' + esc(og) + '">\n' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" href="/favicon-96.png" sizes="96x96"><link rel="icon" type="image/png" href="/favicon-192.png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="/style.css?v=' + BUILD_HASH + '">\n' + (o.extraHead || '') + (o.ld || []).map(ldScript).join('\n') + '\n</head>\n<body>\n' +
    stripLang(WAFLOAT_T, L).replace(/href="#"/, 'href="' + WA + '"').replace(/id="wa-float"/, 'id="wa-float" rel="noopener"') + '\n' +
    headerHtml(L, !!o.onHome, o.altId || canon.replace(BASE, ''), o.altEn || canon.replace(BASE, '')) + '\n' + o.main + '\n' + footerHtml(L, !!o.onHome) + '\n' +
    '<script id="hucas-cfg" type="application/json">' + siteCfg() + '</script>\n<script>window.HUCAS_DATA={tracking:' + JSON.stringify({ gaId: D.tracking.gaId || '', metaPixelId: D.tracking.metaPixelId || '' }) + '};</script>\n' +
    '<script src="/tracking.js" defer></script>\n<script src="/site.js?v=' + BUILD_HASH + '" defer></script>\n</body>\n</html>\n';
}

/* ---------- JSON-LD ---------- */
const orgId = BASE + '/#business';
function businessLd(L){
  const prices = []; const offers = [];
  Object.keys(TYPES).forEach(k => (D.pricing[k] || []).forEach(p => {
    const n = priceNum(p.price); prices.push(n);
    offers.push({ '@type': 'Offer', name: TYPES[k][0] + ' — ' + sess(p.sessions) + ' ' + (L === 'en' ? 'sessions' : 'sesi'), price: String(n), priceCurrency: 'IDR', description: pick(p, 'valid', L), url: BASE + home(L) + '#pricing' });
  }));
  const coach = D.coaches[0];
  return {
    '@type': ['SportsActivityLocation', 'LocalBusiness'], '@id': orgId, name: BIZ, slogan: 'Everyone Can Swim', url: BASE + '/',
    description: D.seo['description_' + L] || D.seo.description_id, telephone: '+' + (D.brand.waBusiness || D.brand.phone), email: D.brand.email,
    image: [ogImage], logo: BASE + '/logo.png', sameAs: ['https://instagram.com/' + D.brand.instagram],
    priceRange: prices.length ? 'Rp' + Math.min(...prices).toLocaleString('id-ID') + ' - Rp' + Math.max(...prices).toLocaleString('id-ID') : undefined,
    address: { '@type': 'PostalAddress', addressLocality: 'Denpasar', addressRegion: 'Bali', addressCountry: 'ID' },
    areaServed: D.locations.map(l => ({ '@type': 'Place', name: l.area + ', Denpasar, Bali' })),
    department: D.locations.map(l => ({ '@type': 'SportsActivityLocation', name: BIZ + ' — ' + l.name + ', ' + l.area, url: BASE + urlFor.loc(l, L), hasMap: l._map.link,
      geo: l._map.geo ? { '@type': 'GeoCoordinates', latitude: l._map.geo.lat, longitude: l._map.geo.lng } : undefined,
      address: { '@type': 'PostalAddress', addressLocality: l.area + ', Denpasar', addressRegion: 'Bali', addressCountry: 'ID' } })),
    employee: coach ? { '@type': 'Person', name: coach.name, jobTitle: pick(coach, 'role', L), image: coach._photo ? BASE + coach._photo : undefined } : undefined,
    makesOffer: offers
  };
}
const faqLd = (L, n) => ({ '@type': 'FAQPage', mainEntity: (D.faq || []).slice(0, n || 999).map(f => ({ '@type': 'Question', name: pick(f, 'q', L), acceptedAnswer: { '@type': 'Answer', text: pick(f, 'a', L) } })) });
const crumbLd = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: it[1] ? BASE + it[1] : undefined })) });
const wrap = (...nodes) => ({ '@context': 'https://schema.org', '@graph': nodes });

/* ---------- build ---------- */
const BUILD_HASH = crypto.createHash('md5').update(STYLE + SUBCSS + fs.readFileSync(path.join(SRC, 'template', 'site.js'), 'utf8')).digest('hex').slice(0, 8);
function homePage(L){
  let b = stripLang(BODY, L);
  b = b.slice(b.indexOf('<section class="hero"'), b.indexOf('<footer>'));
  const fill = (id, html) => { const re = new RegExp('(id="' + id + '"[^>]*>)(</[a-z]+>)'); if (!re.test(b)) throw new Error('container ' + id + ' tidak ditemukan'); b = b.replace(re, (m, a, c) => a + html + c); };
  fill('sched-adult', renderSchedule('adult', L)); fill('sched-kids', renderSchedule('kids', L)); fill('sched-private', renderSchedule('private', L));
  fill('p-adult', renderPricing('adult', L)); fill('p-kids', renderPricing('kids', L)); fill('p-private', renderPricing('private', L));
  fill('coach-list', renderCoaches(L)); fill('blog-list', renderBlogCards(L, blogSorted.slice(0, 3)));
  fill('faq-list', renderFaq(L)); fill('level-list', renderLevels(L)); fill('loc-list', locItems(L));
  const ti = renderTesti(L); fill('testi-list', ti);
  if (ti) b = b.replace('id="testimonials" style="display:none"', 'id="testimonials"');
  b = b.replace(/<select id="bf-location"><\/select>/, '<select id="bf-location">' + D.locations.map(l => '<option value="' + esc(l.name + ' - ' + l.area) + '">' + esc(l.name) + ' — ' + esc(l.area) + '</option>').join('') + '</select>');
  b = b.replace(/(id="stat-locations"><b>)\d+/, '$1' + D.locations.length);
  if (D.brand.bookingWebhookUrl) {
    b = b.replace(/(<p id="bf-sub-id"[^>]*>)[^<]*/, '$1Datanya langsung tercatat di sistem kami, lalu kamu akan diarahkan ke WhatsApp untuk konfirmasi jadwal.')
         .replace(/(<p id="bf-sub-en"[^>]*>)[^<]*/, '$1Your info is recorded right away, then you\'ll be taken to WhatsApp to confirm your schedule.');
  }
  // hero
  const firstLoc = D.locations[0];
  if (heroPath) {
    const sz = heroSize ? ' width="' + heroSize.w + '" height="' + heroSize.h + '"' : '';
    b = b.replace(/<img id="hero-img"[^>]*>/, '<img id="hero-img" class="hero-photo" src="' + heroPath + '" alt="' + esc(L === 'en' ? 'HUCAS swimming class in Bali' : 'Kelas renang HUCAS di Bali') + '"' + sz + ' fetchpriority="high" decoding="async">');
    b = b.replace(/<svg id="hero-svg"[\s\S]*?<\/svg>/, '');
  } else { b = b.replace(/<img id="hero-img"[^>]*>/, ''); }
  // lokasi: peta & foto awal
  b = b.replace(/<iframe id="loc-map" src=""/, '<iframe id="loc-map" title="' + esc(L === 'en' ? 'Map of HUCAS pool locations' : 'Peta lokasi kolam HUCAS') + '" src="' + esc(firstLoc._map.embed) + '"');
  b = b.replace(/<img id="loc-photo" class="loc-photo" alt="">/, firstLoc._photo ? '<img id="loc-photo" class="loc-photo show" src="' + firstLoc._photo + '" alt="' + esc('Kolam renang ' + firstLoc.name + ' ' + firstLoc.area) + '" loading="lazy">' : '<img id="loc-photo" class="loc-photo" alt="">');
  b = b.replace(/<a id="loc-open" class="loc-open" href="#"([^>]*)>[\s\S]*?<\/a>/, '<a id="loc-open" class="loc-open" href="' + esc(firstLoc._map.link) + '"$1>' + T[L].open + '</a>');
  b = b.replace(/(id="cta-phone-(?:id|en)"[^>]*>)[^<]*/g, '$1💬 ' + esc(PHONE_DISP));
  b = b.replace(/href="#" target="_blank"/g, 'href="' + WA + '" target="_blank" rel="noopener"');
  b = b.replace(/<a class="btn btn-outline" href="blog\.html">[\s\S]*?<\/a>/, '<a class="btn btn-outline" href="' + urlFor.blog(L) + '">' + (L === 'en' ? 'See More Articles →' : 'Lihat Lebih Banyak Artikel →') + '</a>');
  b = fixLinks(b, L, true);
  // blok header/footer ada di layout()
  const idx = b.indexOf('<footer>'); if (idx > -1) b = b.slice(0, idx);
  const ld = wrap({ '@type': 'WebSite', '@id': BASE + '/#website', url: BASE + '/', name: BIZ, inLanguage: L }, businessLd(L), faqLd(L));
  return layout({ L, title: D.seo['title_' + L] || D.seo.title_id, desc: D.seo['description_' + L] || D.seo.description_id, keywords: L === 'id' ? D.seo.keywords : undefined,
    path: home(L), altId: '/', altEn: '/en/', onHome: true, main: b, ld: [ld] });
}

function locationPage(loc, L){
  const types = Object.keys(TYPES).filter(k => (loc.schedules[k] || []).length);
  const typeNames = types.map(k => TYPES[k][L === 'en' ? 1 : 0]);
  const intro = pick(loc, 'desc', L) || (L === 'en'
    ? 'HUCAS Swimming Class teaches swimming lessons at ' + loc.name + ' in ' + loc.area + ', Denpasar, Bali. ' + (pick(loc, 'note', L) || '') + ' Available classes: ' + typeNames.join(', ') + '. Small classes, patient coaching, step by step from water confidence to proper technique.'
    : 'HUCAS Swimming Class membuka kelas renang di ' + loc.name + ', ' + loc.area + ', Denpasar, Bali. ' + (pick(loc, 'note', L) || '') + ' Kelas yang tersedia: ' + typeNames.join(', ') + '. Belajar dengan sabar dan bertahap, dari membangun rasa percaya diri di air sampai teknik renang yang benar.');
  const title = L === 'en' ? 'Swim Lessons in ' + loc.area + ', Denpasar — ' + loc.name + ' | HUCAS' : 'Les Renang di ' + loc.area + ', Denpasar — ' + loc.name + ' | HUCAS';
  const desc = (L === 'en' ? 'Kids, adult and private swim lessons at ' + loc.name + ', ' + loc.area + ', Denpasar, Bali. See schedule, prices and map. Book via WhatsApp.' : 'Les renang anak, dewasa & private di ' + loc.name + ', ' + loc.area + ', Denpasar, Bali. Lihat jadwal, harga, dan peta. Booking lewat WhatsApp.');
  const h = home(L), others = D.locations.filter(x => x !== loc);
  const H = L === 'en'
    ? { sched: 'Schedule', price: 'Prices', where: 'Location & map', faq: 'Frequently asked questions', cta: 'Ready to swim at ' + loc.area + '?', ctaP: 'Message HUCAS on WhatsApp to choose a class and start date.', also: 'Other pools', home: 'Home', pricesNote: 'Prices do not include the pool entrance ticket.', chat: 'Chat on WhatsApp' }
    : { sched: 'Jadwal', price: 'Harga', where: 'Lokasi & peta', faq: 'Pertanyaan yang sering diajukan', cta: 'Siap belajar renang di ' + loc.area + '?', ctaP: 'Hubungi HUCAS lewat WhatsApp untuk memilih kelas dan tanggal mulai.', also: 'Kolam lainnya', home: 'Beranda', pricesNote: 'Harga belum termasuk tiket masuk kolam renang.', chat: 'Chat via WhatsApp' };
  const kidsAdultPriv = Object.keys(TYPES).map(k => '<h3>' + TYPES[k][0] + '</h3><div class="price-panel active sub-price">' + renderPricing(k, L) + '</div>').join('');
  const schedBlocks = types.map(k => '<h3>' + TYPES[k][0] + '</h3><div class="sched-grid">' + renderSchedule(k, L, [loc]) + '</div>').join('');
  const main = '<main class="sub-wrap"><nav class="crumbs" aria-label="breadcrumb"><a href="' + h + '">' + H.home + '</a> › ' + esc(loc.area) + '</nav>' +
    '<h1>' + (L === 'en' ? 'Swim Lessons in ' : 'Les Renang di ') + esc(loc.area) + ', Denpasar</h1><p class="lead">' + esc(intro) + '</p>' +
    (loc._photo ? '<div class="cover"><img src="' + loc._photo + '" alt="' + esc('Kolam renang ' + loc.name + ' ' + loc.area) + '" loading="eager" decoding="async"></div>' : '') +
    '<h2>' + H.sched + '</h2>' + schedBlocks +
    '<h2>' + H.price + '</h2>' + kidsAdultPriv + '<p class="price-note">' + H.pricesNote + '</p>' +
    '<h2>' + H.where + '</h2><p><b>' + esc(loc.name) + '</b>, ' + esc(loc.area) + ', Denpasar, Bali.</p>' +
    '<div class="map-wrap"><iframe title="Map ' + esc(loc.name) + '" src="' + esc(loc._map.embed) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
    '<p style="margin-top:14px"><a class="btn btn-yellow" href="' + esc(loc._map.link) + '" target="_blank" rel="noopener">' + T[L].open + '</a></p>' +
    '<h2>' + H.faq + '</h2><div class="faq-list">' + renderFaq(L, 4) + '</div>' +
    '<div class="cta-box"><h2>' + H.cta + '</h2><p>' + H.ctaP + '</p><a class="btn btn-primary" href="' + WA + '" target="_blank" rel="noopener">💬 ' + esc(PHONE_DISP) + '</a></div>' +
    (others.length ? '<h2>' + H.also + '</h2><div class="rel-list">' + others.map(o => '<a class="rel-item" href="' + urlFor.loc(o, L) + '"><b>' + esc(o.name) + ' — ' + esc(o.area) + '</b><span>' + esc(pick(o, 'note', L)) + '</span></a>').join('') + '</div>' : '') + '</main>';
  const place = { '@type': ['SportsActivityLocation', 'LocalBusiness'], name: BIZ + ' — ' + loc.name, url: BASE + urlFor.loc(loc, L), telephone: '+' + (D.brand.waBusiness || D.brand.phone), image: loc._photo ? BASE + loc._photo : ogImage, hasMap: loc._map.link,
    geo: loc._map.geo ? { '@type': 'GeoCoordinates', latitude: loc._map.geo.lat, longitude: loc._map.geo.lng } : undefined,
    address: { '@type': 'PostalAddress', addressLocality: loc.area + ', Denpasar', addressRegion: 'Bali', addressCountry: 'ID' }, parentOrganization: { '@id': orgId }, sameAs: ['https://instagram.com/' + D.brand.instagram] };
  return layout({ L, title, desc, path: urlFor.loc(loc, L), altId: loc._urlId, altEn: loc._urlEn, main, ogImg: loc._photo ? BASE + loc._photo : undefined,
    ld: [wrap(place, faqLd(L, 4), crumbLd([[H.home, home(L)], [loc.area, urlFor.loc(loc, L)]]))] });
}

function blogIndex(L){
  const t = L === 'en' ? 'Blog & Swimming Education | HUCAS Swimming Class' : 'Blog & Edukasi Renang | HUCAS Swimming Class';
  const d = L === 'en' ? 'Tips for learning to swim, kids swimming ages and the health benefits of swimming — from HUCAS Swimming Class, Denpasar, Bali.' : 'Tips belajar berenang, usia anak mulai les renang, dan manfaat renang untuk kesehatan — dari HUCAS Swimming Class, Denpasar, Bali.';
  const main = '<main class="sub-wrap wide"><nav class="crumbs"><a href="' + home(L) + '">' + (L === 'en' ? 'Home' : 'Beranda') + '</a> › Blog</nav><h1>' + (L === 'en' ? 'Blog & Education' : 'Blog & Edukasi') + '</h1>' +
    '<p class="lead">' + (L === 'en' ? 'Tips, guides and updates about learning to swim with HUCAS.' : 'Tips, panduan, dan kabar seputar belajar berenang bersama HUCAS.') + '</p><div class="blog-grid">' + renderBlogCards(L, blogSorted) + '</div></main>';
  return layout({ L, title: t, desc: d, path: urlFor.blog(L), altId: '/blog/', altEn: '/en/blog/', main,
    ld: [wrap({ '@type': 'Blog', name: t, url: BASE + urlFor.blog(L), inLanguage: L, publisher: { '@id': orgId } }, crumbLd([[L === 'en' ? 'Home' : 'Beranda', home(L)], ['Blog', urlFor.blog(L)]]))] });
}

function articlePage(p, L){
  const title = pick(p, 'title', L), ex = pick(p, 'excerpt', L), body = pick(p, 'body', L);
  const author = D.coaches[0] ? D.coaches[0].name : BIZ;
  const rel = blogSorted.filter(x => x !== p).slice(0, 3);
  const h = home(L);
  const main = '<main class="sub-wrap"><nav class="crumbs"><a href="' + h + '">' + (L === 'en' ? 'Home' : 'Beranda') + '</a> › <a href="' + urlFor.blog(L) + '">Blog</a> › ' + esc(title) + '</nav>' +
    '<article><span class="tag">' + esc(pick(p, 'tag', L)) + '</span><h1>' + esc(title) + '</h1><div class="meta">' + fmtDate(p.date, L) + ' · ' + esc(author) + '</div>' +
    (p._img ? '<div class="cover"><img src="' + p._img + '" alt="' + esc(title) + '" decoding="async"></div>' : '') +
    '<div class="content">' + (body ? md(body) : '<p>' + esc(ex) + '</p>') + '</div></article>' +
    '<div class="cta-box"><h2>' + (L === 'en' ? 'Ready to start swimming?' : 'Siap mulai belajar berenang?') + '</h2><p>' + (L === 'en' ? 'Message HUCAS on WhatsApp to pick a class, location and schedule.' : 'Hubungi HUCAS lewat WhatsApp untuk pilih kelas, lokasi, dan jadwal.') + '</p><a class="btn btn-primary" href="' + WA + '" target="_blank" rel="noopener">💬 ' + esc(PHONE_DISP) + '</a></div>' +
    (rel.length ? '<div class="related"><h2>' + (L === 'en' ? 'More articles' : 'Artikel lainnya') + '</h2><div class="rel-list">' + rel.map(x => '<a class="rel-item" href="' + urlFor.post(x, L) + '"><b>' + esc(pick(x, 'title', L)) + '</b><span>' + esc(pick(x, 'tag', L)) + '</span></a>').join('') + '</div></div>' : '') + '</main>';
  const url = urlFor.post(p, L);
  const art = { '@type': 'Article', headline: title, description: ex, datePublished: p.date, dateModified: p.date, inLanguage: L, image: p._img ? [BASE + p._img] : [ogImage], mainEntityOfPage: BASE + url,
    author: { '@type': 'Person', name: author }, publisher: { '@type': 'Organization', name: BIZ, logo: { '@type': 'ImageObject', url: BASE + '/logo.png' } } };
  return layout({ L, title: title + ' | ' + BIZ, desc: ex, path: url, altId: urlFor.post(p, 'id'), altEn: urlFor.post(p, 'en'), main, ogType: 'article', ogImg: p._img ? BASE + p._img : undefined,
    ld: [wrap(art, crumbLd([[L === 'en' ? 'Home' : 'Beranda', home(L)], ['Blog', urlFor.blog(L)], [title, url]]))] });
}

/* ---------- write pages ---------- */
const urls = []; // {path, alt:[[lang,path]], lastmod, prio}
['id', 'en'].forEach(L => {
  write(L === 'en' ? 'en/index.html' : 'index.html', homePage(L));
  write(urlFor.blog(L).slice(1) + 'index.html', blogIndex(L));
  D.locations.forEach(l => write(urlFor.loc(l, L).slice(1) + 'index.html', locationPage(l, L)));
  blogSorted.forEach(p => write(urlFor.post(p, L).slice(1) + 'index.html', articlePage(p, L)));
});
urls.push({ id: '/', en: '/en/', lastmod: TODAY, prio: '1.0' });
urls.push({ id: '/blog/', en: '/en/blog/', lastmod: blogSorted[0] ? blogSorted[0].date : TODAY, prio: '0.8' });
D.locations.forEach(l => urls.push({ id: l._urlId, en: l._urlEn, lastmod: TODAY, prio: '0.9' }));
blogSorted.forEach(p => urls.push({ id: urlFor.post(p, 'id'), en: urlFor.post(p, 'en'), lastmod: p.date || TODAY, prio: '0.7' }));
const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  urls.map(u => ['id', 'en'].map(L => '  <url><loc>' + BASE + u[L] + '</loc><lastmod>' + u.lastmod + '</lastmod><priority>' + u.prio + '</priority>' +
    '<xhtml:link rel="alternate" hreflang="id" href="' + BASE + u.id + '"/><xhtml:link rel="alternate" hreflang="en" href="' + BASE + u.en + '"/><xhtml:link rel="alternate" hreflang="x-default" href="' + BASE + u.id + '"/></url>').join('\n')).join('\n') + '\n</urlset>\n';
write('sitemap.xml', sm);
write('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /dashboard.html\n\nSitemap: ' + BASE + '/sitemap.xml\n');

/* halaman lama → arahkan ke URL baru */
write('blog.html', '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Blog | ' + esc(BIZ) + '</title><link rel="canonical" href="' + BASE + '/blog/"><meta http-equiv="refresh" content="0;url=/blog/"></head><body><a href="/blog/">Blog</a></body></html>');
write('article.html', '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Artikel | ' + esc(BIZ) + '</title><meta name="robots" content="noindex, follow"><script>var s=new URLSearchParams(location.search).get("slug");var l=0;try{l=localStorage.getItem("hucas-lang")==="en"}catch(e){}location.replace((l?"/en":"")+"/blog/"+(s?encodeURIComponent(s)+"/":""));</script></head><body><a href="/blog/">Blog</a></body></html>');

/* llms.txt — ringkasan untuk mesin AI */
const priceLines = Object.keys(TYPES).map(k => '- ' + TYPES[k][0] + ': ' + (D.pricing[k] || []).map(p => sess(p.sessions) + ' ' + rp(p.price)).join(', ')).join('\n');
write('llms.txt', '# ' + BIZ + '\n\n> Les renang untuk anak (4+), dewasa, dan private 1-on-1 di Denpasar, Bali. Swimming lessons for kids, adults and private classes in Denpasar, Bali. Slogan: Everyone Can Swim.\n\n' +
  'Coach: ' + (D.coaches[0] ? D.coaches[0].name + ' (' + pick(D.coaches[0], 'role', 'en') + ', teaching since ' + D.coaches[0].since + ')' : '') + '\nWhatsApp: +' + (D.brand.waBusiness || D.brand.phone) + '\nEmail: ' + D.brand.email + '\nInstagram: https://instagram.com/' + D.brand.instagram + '\n\n## Locations\n' +
  D.locations.map(l => '- ' + l.name + ', ' + l.area + ': ' + BASE + l._urlId).join('\n') + '\n\n## Prices (IDR, excl. pool ticket)\n' + priceLines + '\n\n## Pages\n- Home (ID): ' + BASE + '/\n- Home (EN): ' + BASE + '/en/\n- Blog: ' + BASE + '/blog/\n' +
  blogSorted.map(p => '- ' + pick(p, 'title', 'id') + ': ' + BASE + urlFor.post(p, 'id')).join('\n') + '\n');

/* aset statis */
write('style.css', STYLE + '\n' + SUBCSS);
copy('template/site.js', 'site.js');
['404.html', 'dashboard.html', 'firebase-config.js', 'logo.png', 'privacy.html', 'favicon.ico', 'favicon-48.png', 'favicon-96.png', 'favicon-192.png', 'apple-touch-icon.png'].forEach(f => copy(f));
write('tracking.js', fs.readFileSync(path.join(SRC, 'tracking.js'), 'utf8')
  .replace("function lang(){ try{ return localStorage.getItem('hucas-lang') === 'en' ? 'en' : 'id'; }catch(e){ return 'id'; } }", "function lang(){ return (document.documentElement.lang || 'id').slice(0, 2) === 'en' ? 'en' : 'id'; }")
  .replace(/href="privacy\.html"/g, 'href="/privacy.html"'));
write('CNAME', BASE.replace(/^https?:\/\//, '') + '\n');
if (fs.existsSync(path.join(SRC, 'extra'))) fs.readdirSync(path.join(SRC, 'extra')).forEach(f => copy('extra/' + f, f)); // file verifikasi dll
console.log('OK: ' + (urls.length * 2) + ' halaman, ' + imgCount + ' gambar → ' + OUT);
