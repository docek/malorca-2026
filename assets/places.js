/* Malorca 2026 – place detail popups, offline precache, PWA help. Shared by all pages. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
  const imgUrl = (file, w) => COMMONS + encodeURIComponent(file.replace(/ /g, '_')) + '?width=' + w;
  const fileUrl = file => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));

  // ---------- modal ----------
  document.body.insertAdjacentHTML('beforeend', '<div class="modal" id="modal" aria-hidden="true"><div class="box" role="dialog" aria-modal="true"><button class="x" type="button" aria-label="Zavřít">×</button><div id="modal-content"></div></div></div>');
  const modal = document.getElementById('modal'), box = modal.querySelector('.box'), content = document.getElementById('modal-content');
  function open(html, small) {
    content.innerHTML = html; modal.classList.toggle('small', !!small); modal.classList.add('on');
    modal.setAttribute('aria-hidden', 'false'); box.scrollTop = 0; document.body.style.overflow = 'hidden';
  }
  function close() { modal.classList.remove('on'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  window.openModal = open;
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.x')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // ---------- data ----------
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  let places = {}, byName = [], aliases = {}, terms = {};
  const ready = fetch('assets/places.json').then(r => r.json()).then(d => {
    d.places.forEach(p => { places[p.id] = p; byName.push([norm(p.name), p.id]); });
    aliases = Object.fromEntries(Object.entries(d.aliases || {}).map(([k, v]) => [norm(k), v]));
    terms = d.terms || {};
    byName.sort((a, b) => b[0].length - a[0].length);
    return places;
  }).catch(e => { console.error('places.json', e); return {}; });
  window.MALORCA = { ready, resolve: resolveName };

  function resolveName(name) {
    const n = norm(name); if (!n) return null;
    if (aliases[n]) return aliases[n];
    const exact = byName.find(x => x[0] === n); if (exact) return exact[1];
    const pre = byName.find(x => x[0].startsWith(n + ' ')); if (pre) return pre[1];
    const inc = byName.find(x => (' ' + x[0] + ' ').includes(' ' + n + ' ')); if (inc) return inc[1];
    return null;
  }

  const KIND = { 'výlet': 'výlet', 'restaurace': 'restaurace', 'výrobce': 'za jídlem k výrobci', 'ubytování': 'ubytování', 'místo': 'místo' };
  const REGION = { sever: 'sever', tramuntana: 'Tramuntana', stred: 'střed', palma: 'Palma', vychod: 'východ', jih: 'jih' };
  const PAGE_LABEL = { 'vylety.html': 'Karta v katalogu výletů', 'jidlo.html': 'Karta na stránce Kde jíst', 'index.html': 'Na stránce plánu' };

  function placeHtml(p) {
    let img = '';
    if (p.img && p.img.file) {
      img = `<img src="${imgUrl(p.img.file, 900)}" alt="${esc(p.name)}"><div class="credit">${p.photo_is_area ? 'Ilustrační foto okolí. ' : ''}Foto: ${esc(p.img.author)}, ${esc(p.img.license)}, <a href="${fileUrl(p.img.file)}" target="_blank" rel="noopener">Wikimedia Commons</a></div>`;
    }
    const sec = (t, v) => v ? `<h4>${esc(t)}</h4><p>${esc(v)}</p>` : '';
    const call = (cls, t, v) => v ? `<div class="pcall ${cls}"><b>${esc(t)}</b>${esc(v)}</div>` : '';
    // facts: card facts first, then verified extras; dedupe by label
    const seen = new Set(), rows = [];
    const addFact = (k, v) => { const key = norm(k); if (!v || seen.has(key)) return; seen.add(key); rows.push(`<div><b>${esc(k)}</b>${esc(v)}</div>`); };
    Object.entries(p.card_facts || {}).forEach(([k, v]) => addFact(k, v.replace(/ · Google Maps$/, '')));
    (p.facts || []).forEach(f => { const i = f.indexOf(':'); if (i > 0) addFact(f.slice(0, i), f.slice(i + 1).trim()); else rows.push(`<div>${esc(f)}</div>`); });
    const factsHtml = rows.length ? `<div class="facts">${rows.join('')}</div>` : '';
    const meta = [KIND[p.kind] || p.kind, REGION[p.region] || '', p.area || '', p.drive || ''].filter(Boolean).join(' · ');
    const status = p.status ? ` <span class="pill ${p.status === 'ověřeno' ? 'ok' : (p.status === 'ověřit' ? 'neutral' : 'warn')}">${esc(p.status)}</span>` : '';
    const links = (p.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`);
    (p.card_links || []).forEach(([label, url]) => { if (/google\.com\/maps/.test(url)) links.push(`<a href="${esc(url)}" target="_blank" rel="noopener">Google Maps ↗</a>`); });
    if (p.page && p.id) links.push(`<a href="${esc(p.page)}#${esc(p.anchor || p.id)}" class="card-link">${PAGE_LABEL[p.page] || 'Karta'} →</a>`);
    const gal = (p.gallery || []).map(g => `<a class="th" href="${fileUrl(g.file)}" target="_blank" rel="noopener" title="${esc(g.author)}, ${esc(g.license)}"><img src="${imgUrl(g.file, 480)}" alt="" loading="lazy"><span>${esc(g.author)} · ${esc(g.license)}</span></a>`).join('');
    const galHtml = gal ? `<h4>Další fotky (Wikimedia Commons)</h4><div class="gallery">${gal}</div>` : '';
    const body = p.kind === 'výlet'
      ? sec('Co to je', p.what_long || p.what) + sec('Pro děti 4–11', p.kids) + sec('Proč tam', p.why) + sec('Co zažijeme', p.experience) + sec('Jak se tam dostat', p.access) + sec('Tipy', p.tips) + call('note', 'Verdikt', p.verdict)
      : p.kind === 'ubytování'
        ? sec('Co to je', p.what_long || p.what) + sec('Proč tady', p.why) + sec('Co nás čeká', p.experience) + sec('Jak se tam dostat', p.access) + sec('Tipy', p.tips) + sec('Dostupnost a storno', p.booking) + sec('Kontakt', p.contact) + sec('Hodnocení', p.rating)
        : sec('Co to je', p.what_long || p.what) + sec('Proč zrovna tady', p.why) + sec('Co si dát a jak to tam vypadá', p.experience) + sec('Jak se tam dostat', p.access) + sec('Tipy', p.tips) + call('note', 'Z rešerše', p.why_card);
    return `${img}<div class="in"><h3>${esc(p.name)}</h3><div class="kind">${esc(meta)}${status}</div>${factsHtml}${call('warn', 'Pozor', p.warning)}${body}${call('fun', 'Kuriozita pro děti', p.fun)}<div class="links">${links.join('')}</div>${galHtml}</div>`;
  }

  function openPlace(id) { const p = places[id]; if (!p) return false; open(placeHtml(p)); return true; }
  window.openPlace = openPlace;

  // ---------- triggers ----------
  // 1) explicit: .pl[data-pl] or .pl[data-pl-name]; 2) cross-page card links vylety.html#id / jidlo.html#id
  document.addEventListener('click', e => {
    const t = e.target.closest('.pl, a[href]'); if (!t) return;
    if (t.classList.contains('pl')) {
      const id = t.dataset.pl || resolveName(t.dataset.plName || t.textContent);
      if (id && openPlace(id)) e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || t.target === '_blank') return;
    const m = (t.getAttribute('href') || '').match(/^(?:(?:vylety|jidlo|index)\.html)?#([a-z0-9-]+)$/);
    if (m && places[m[1]] && !t.classList.contains('card-link')) { e.preventDefault(); openPlace(m[1]); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('pl')) e.target.click(); });

  // deep link: ?place=id or #p-id
  ready.then(() => {
    const q = new URLSearchParams(location.search).get('place');
    if (q && places[q]) openPlace(q);
    // mark resolvable elements so they get the ⓘ style
    document.querySelectorAll('[data-pl-name]').forEach(el => { const id = resolveName(el.dataset.plName); if (id) { el.classList.add('pl'); el.dataset.pl = id; el.tabIndex = 0; el.setAttribute('role', 'button'); } });
    document.querySelectorAll('.pl[data-pl]').forEach(el => { if (!places[el.dataset.pl]) el.classList.remove('pl'); });
    // buttons created later (Leaflet popups): resolve by name or drop them
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      n.querySelectorAll('.pl[data-pl-name]:not([data-pl])').forEach(el => { const id = resolveName(el.dataset.plName); if (id) el.dataset.pl = id; else el.remove(); });
    }))).observe(document.body, { childList: true, subtree: true });
  });

  // ---------- glossary of Catalan / Mallorcan terms ----------
  const GLOSS_PAGE = 'prakticke.html#slovnicek';
  function termHtml(v) { const head = v.split(':')[0]; return `<div class="in"><h3>${esc(head)}</h3><p>${esc(v.slice(head.length + 1).trim())}</p><div class="links"><a href="${GLOSS_PAGE}">celý slovníček →</a></div></div>`; }
  ready.then(() => {
    const dl = document.getElementById('gloss-list');
    if (dl) Object.values(terms).sort((a, b) => a.localeCompare(b, 'cs')).forEach(v => { const head = v.split(':')[0]; dl.insertAdjacentHTML('beforeend', `<dt>${esc(head)}</dt><dd>${esc(v.slice(head.length + 1).trim())}</dd>`); });
    const keys = Object.keys(terms).sort((a, b) => b.length - a.length); if (!keys.length) return;
    const escRx = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // key + optional Czech ending, then a non-letter (so "cala" never hits "Calvari", "far" never hits "farma")
    const END = '(?:y|u|e|ou|ě|em|ám|ách|ami|i)?(?!\\p{L})';
    const rx = new RegExp('(^|[^\\p{L}])(' + keys.map(k => escRx(k) + END).join('|') + ')', 'iu');
    const keyOf = w => { const lw = w.toLowerCase(); return keys.find(k => lw.startsWith(k.toLowerCase())); };
    const SKIP = new Set(['A', 'BUTTON', 'SCRIPT', 'STYLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'SUP', 'INPUT', 'SELECT', 'TEXTAREA', 'DT', 'DD', 'LABEL']);
    const blocks = document.querySelectorAll('.act, .venue, .card, .mod, .combo, .day, .callout, .risk, .verdict > div, .sec-head p, table.cmp td, table.week td, .check li, .prog-note');
    const seenGlobal = new Set();
    for (const b of blocks) {
      if (b.closest('.hero, .modal, footer, .nav')) continue;
      const seen = new Set();
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: n => {
        let el = n.parentElement;
        while (el && el !== b) { if (SKIP.has(el.tagName) || el.classList.contains('pl') || el.classList.contains('gl')) return NodeFilter.FILTER_REJECT; el = el.parentElement; }
        return NodeFilter.FILTER_ACCEPT; } });
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        const text = n.nodeValue; let last = 0, m, changed = false, guard = 0;
        const out = document.createDocumentFragment();
        while ((m = rx.exec(text.slice(last))) && guard++ < 30) {
          const key = keyOf(m[2]); const start = last + m.index + m[1].length, end = start + m[2].length;
          if (!key || seen.has(key)) { last = end; continue; }
          seen.add(key); seenGlobal.add(key);
          out.appendChild(document.createTextNode(text.slice(last, start)));
          const s = document.createElement('span'); s.className = 'gl'; s.dataset.gl = key; s.tabIndex = 0; s.textContent = text.slice(start, end); out.appendChild(s);
          last = end; changed = true;
        }
        if (changed) { out.appendChild(document.createTextNode(text.slice(last))); n.parentNode.replaceChild(out, n); }
      }
    }
  });
  document.addEventListener('click', e => { const t = e.target.closest('.gl'); if (!t) return; const v = terms[t.dataset.gl]; if (v) open(termHtml(v), true); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('gl')) e.target.click(); });

  // ---------- service worker ----------
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // ---------- offline precache ----------
  async function precache(btn) {
    if (!('serviceWorker' in navigator)) { btn.textContent = 'Offline nejde v tomto prohlížeči (zkus Chrome nebo Safari na telefonu)'; return; }
    btn.disabled = true; btn.textContent = 'Připravuji…';
    try {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('sw')), 8000))]);
      if (!reg.active) throw new Error('sw');
      await ready;
      const urls = new Set();
      Object.values(places).forEach(p => {
        if (p.img && p.img.file) urls.add(imgUrl(p.img.file, 900));
        (p.gallery || []).forEach(g => urls.add(imgUrl(g.file, 480)));
      });
      const list = [...urls];
      navigator.serviceWorker.addEventListener('message', ev => {
        const m = ev.data || {};
        if (m.type === 'PROGRESS') btn.textContent = `Stahuji fotky ${m.done}/${m.total}`;
        if (m.type === 'DONE') { btn.textContent = `✓ Offline: ${m.done - m.failed} fotek uloženo` + (m.failed ? `, ${m.failed} selhalo` : ''); btn.disabled = false; }
      });
      reg.active.postMessage({ type: 'PRECACHE', urls: list, total: list.length });
    } catch (e) { btn.textContent = 'Offline nejde v tomto prohlížeči (zkus Chrome nebo Safari na telefonu)'; btn.disabled = false; }
  }
  document.querySelectorAll('[data-offline]').forEach(b => b.addEventListener('click', () => precache(b)));

  // ---------- PWA help ----------
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function helpHtml() {
    const installBtn = installEvt ? `<p style="margin:8px 0 4px"><button class="btn primary" type="button" id="pwa-install">⬇ Nainstalovat teď</button></p>` : '';
    const state = standalone ? '<div class="pcall fun"><b>Stav</b>Tohle už běží jako nainstalovaná aplikace. Zbývá jen kliknout na „Uložit pro offline" níže.</div>' : '';
    return `<div class="in"><h3>Web jako aplikace na telefonu</h3><div class="kind">funguje bez signálu · ikona na ploše</div>${state}
<p>Web se dá přidat na plochu jako aplikace. Plán, katalog výletů, jídlo i praktické informace pak fungují i bez signálu, včetně karet míst s fotkami. Udělejte to <b>doma na wifi</b>, ne až na ostrově.</p>
${installBtn}
<h4>Android (Chrome)</h4><p>1. Otevři <b>docek.github.io/malorca-2026</b> v <b>Chromu</b>.<br>2. Klepni na <b>⋮</b> (tři tečky vpravo nahoře).<br>3. Vyber <b>Přidat na plochu</b> nebo <b>Instalovat aplikaci</b>, potvrď <b>Instalovat</b>. Někdy se nabídka „Nainstalovat aplikaci" ukáže sama dole na obrazovce, stačí klepnout.<br>4. Na ploše se objeví ikona <b>Malorca 2026</b>. Otevři ji ještě s připojením a klepni na <b>Uložit pro offline</b>. Počkej, až tlačítko ukáže ✓.</p>
<h4>Android (Samsung Internet, Firefox)</h4><p>Samsung Internet: menu <b>☰</b> dole vpravo → <b>Přidat stránku na</b> → <b>Plocha</b>. Firefox: <b>⋮</b> → <b>Nainstalovat</b> (starší verze: <b>Přidat na plochu</b>). Pak stejně jako výše otevřít ikonu a dát <b>Uložit pro offline</b>.</p>
<h4>iPhone a iPad</h4><p>1. Otevři <b>docek.github.io/malorca-2026</b> v <b>Safari</b> (Chrome na iPhonu instalaci neumí).<br>2. Klepni na ikonu <b>Sdílet</b> (čtverec se šipkou nahoru, dole uprostřed).<br>3. Sjeď dolů, vyber <b>Přidat na plochu</b>, potvrď <b>Přidat</b>.<br>4. Otevři novou ikonu <b>Malorca 2026</b> z plochy ještě s připojením a klepni na <b>Uložit pro offline</b>. Počkej na ✓.<br>5. iOS může po několika týdnech nepoužívání cache smazat, tak aplikaci před odletem jednou otevři na wifi.</p>
<h4>Co offline funguje a co ne</h4><p>Funguje: všechny čtyři stránky, karty míst s fotkami, filtry a vlastní výběr v katalogu, balicí seznam. Nefunguje: podklad mapy mimo místa, která jsi už online prohlížel, odkazy na Booking, Google Maps a weby podniků. Na navigaci použij Google Maps nebo Mapy.cz s offline mapou Mallorky.</p>
<h4>Když se web aktualizuje</h4><p>Nová verze se stáhne na pozadí a ukáže se až při dalším otevření. Když chceš mít jistotu, otevři web dvakrát po sobě s připojením.</p>
<div class="links"><button class="btn light" type="button" data-offline>⬇ Uložit pro offline</button></div></div>`;
  }
  document.querySelectorAll('[data-pwa-help]').forEach(b => b.addEventListener('click', () => {
    open(helpHtml(), false);
    const ib = document.getElementById('pwa-install');
    if (ib) ib.addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; ib.remove(); });
    content.querySelectorAll('[data-offline]').forEach(b => b.addEventListener('click', () => precache(b)));
  }));
})();
