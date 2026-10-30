/* UCPN — легкий скрипт без залежностей. Сайт повністю читається і без нього. */
(function () {
  'use strict';
  var TZ = 'Europe/Kyiv';

  function today() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function isUpcoming(el) {
    var status = el.getAttribute('data-status');
    var start = el.getAttribute('data-start');
    if (status !== 'scheduled' || !start) return true;
    var end = el.getAttribute('data-end') || start;
    return end >= today();
  }

  /* запам'ятовуємо вибір мови для кореневої адреси */
  Array.prototype.forEach.call(document.querySelectorAll('.langs a[hreflang]'), function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('ucpn-lang', a.getAttribute('hreflang')); } catch (e) {}
    });
  });

  /* кнопки календаря тільки для майбутніх подій */
  Array.prototype.forEach.call(document.querySelectorAll('[data-cal]'), function (b) { if (!isUpcoming(b)) b.hidden = true; });

  /* позначка «майбутня / минула» на сторінці події */
  Array.prototype.forEach.call(document.querySelectorAll('[data-badge]'), function (b) {
    b.textContent = b.getAttribute(isUpcoming(b) ? 'data-up' : 'data-past');
  });

  /* фільтри за категоріями (без окремих сторінок) */
  function applyFilter(root, value) {
    var shown = 0;
    Array.prototype.forEach.call(root.querySelectorAll('[data-filter]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === value));
    });
    Array.prototype.forEach.call(root.querySelectorAll('.card[data-cat]'), function (c) {
      var ok = value === 'all' || c.getAttribute('data-cat') === value;
      c.hidden = !ok;
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-list]'), function (list) {
      var n = list.querySelectorAll('.card:not([hidden])').length;
      var empty = list.parentNode.querySelector('[data-empty]');
      if (empty) empty.hidden = n > 0;
    });
    var panel = root.querySelector('[data-panel].on');
    shown = (panel || root).querySelectorAll('.card:not([hidden])').length;
    var st = root.querySelector('[data-template]');
    if (st) st.textContent = st.getAttribute('data-template').replace('{n}', shown);
    updateCounts(root);
  }
  function updateCounts(root) {
    var tabs = root.querySelector('[data-tabs]');
    if (!tabs) return;
    Array.prototype.forEach.call(tabs.querySelectorAll('[data-tab]'), function (b) {
      var p = root.querySelector('[data-panel="' + b.getAttribute('data-tab') + '"]');
      var n = p ? p.querySelectorAll('.card:not([hidden])').length : 0;
      var c = b.querySelector('[data-count]');
      if (c) c.textContent = '(' + n + ')';
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-filterable]'), function (root) {
    var f = root.querySelector('[data-filters]');
    if (f) f.hidden = false;
    var current = 'all';
    root.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!b) return;
      current = b.getAttribute('data-filter');
      applyFilter(root, current);
    });
    root._apply = function () { applyFilter(root, current); };
  });

  /* програма: події самі переходять з «Майбутніх» у «Минулі» за датою */
  var prog = document.querySelector('[data-programme]');
  if (prog) {
    var up = prog.querySelector('[data-panel="up"] [data-list]');
    var past = prog.querySelector('[data-panel="past"] [data-list]');
    var cards = Array.prototype.slice.call(prog.querySelectorAll('.card[data-status]'));
    var ups = cards.filter(isUpcoming).sort(function (a, b) {
      return (a.getAttribute('data-start') || '').localeCompare(b.getAttribute('data-start') || '');
    });
    var pasts = cards.filter(function (c) { return !isUpcoming(c); }).sort(function (a, b) {
      return (b.getAttribute('data-start') || '').localeCompare(a.getAttribute('data-start') || '');
    });
    ups.forEach(function (c) { up.appendChild(c); });
    pasts.forEach(function (c) { past.appendChild(c); });

    var tabs = prog.querySelector('[data-tabs]');
    var panels = {
      up: prog.querySelector('[data-panel="up"]'),
      past: prog.querySelector('[data-panel="past"]')
    };
    var show = function (name) {
      Object.keys(panels).forEach(function (k) { panels[k].classList.toggle('on', k === name); });
      Array.prototype.forEach.call(tabs.querySelectorAll('[data-tab]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === name));
      });
      prog._apply();
    };
    tabs.hidden = false;
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) show(b.getAttribute('data-tab'));
    });
    show(ups.length || !pasts.length ? 'up' : 'past');
  }

  /* галерея: кнопки «назад / вперед» (без скрипта працює гортання пальцем і мишею) */
  Array.prototype.forEach.call(document.querySelectorAll('[data-gallery]'), function (g) {
    var strip = g.querySelector('.gallery');
    Array.prototype.forEach.call(g.querySelectorAll('[data-dir]'), function (b) {
      b.hidden = false;
      b.addEventListener('click', function () {
        strip.scrollBy({ left: strip.clientWidth * Number(b.getAttribute('data-dir')), behavior: 'smooth' });
      });
    });
    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { strip.scrollBy({ left: strip.clientWidth, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { strip.scrollBy({ left: -strip.clientWidth, behavior: 'smooth' }); e.preventDefault(); }
    });
  });

  /* «Поділитися» */
  Array.prototype.forEach.call(document.querySelectorAll('[data-share]'), function (btn) {
    var msg = document.querySelector('[data-share-msg]');
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var done = function (key) { if (msg) { msg.textContent = btn.getAttribute(key); setTimeout(function () { msg.textContent = ''; }, 2800); } };
      if (navigator.share) { navigator.share({ title: document.title, url: location.href }).catch(function () {}); return; }
      try { navigator.clipboard.writeText(location.href).then(function () { done('data-copied'); }, function () { done('data-manual'); }); }
      catch (e) { done('data-manual'); }
    });
  });
})();
