/* UCPN — легкий скрипт без залежностей. Сайт повністю читається і без нього. */
(function () {
  'use strict';
  var TZ = 'Europe/Kyiv';
  var each = function (sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); };

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
  each('.langs a[hreflang]', function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('ucpn-lang', a.getAttribute('hreflang')); } catch (e) {}
    });
  });

  /* кнопки календаря й реєстрації тільки для майбутніх подій */
  each('[data-cal],[data-reg]', function (b) { if (!isUpcoming(b)) b.hidden = true; });

  /* програма: події самі переходять з «Майбутніх» у «Минулі» за датою; перемикач працює без перезавантаження */
  var prog = document.querySelector('[data-programme]');
  if (prog) {
    var panels = { up: prog.querySelector('[data-panel="up"]'), past: prog.querySelector('[data-panel="past"]') };
    var lists = { up: panels.up.querySelector('[data-list]'), past: panels.past.querySelector('[data-list]') };
    var cards = Array.prototype.slice.call(prog.querySelectorAll('.pcard[data-status]'));
    var startOf = function (c) { return c.getAttribute('data-start') || ''; };
    cards.filter(isUpcoming).sort(function (a, b) { return (startOf(a) || '9999').localeCompare(startOf(b) || '9999'); })
      .forEach(function (c) { lists.up.appendChild(c); });
    cards.filter(function (c) { return !isUpcoming(c); }).sort(function (a, b) { return startOf(b).localeCompare(startOf(a)); })
      .forEach(function (c) { lists.past.appendChild(c); });
    Object.keys(panels).forEach(function (k) {
      var empty = panels[k].querySelector('[data-empty]');
      if (empty) empty.hidden = lists[k].children.length > 0;
    });

    var tabs = prog.querySelector('[data-tabs]');
    var show = function (name, remember) {
      Object.keys(panels).forEach(function (k) { panels[k].classList.toggle('on', k === name); });
      each('[data-tab]', function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === name)); }, tabs);
      if (remember && window.history && history.replaceState) {
        try { history.replaceState(null, '', name === 'past' ? '#past' : location.pathname + location.search); } catch (e) {}
      }
    };
    tabs.hidden = false;
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) show(b.getAttribute('data-tab'), true);
    });
    var hasUp = lists.up.children.length > 0; var hasPast = lists.past.children.length > 0;
    show(location.hash === '#past' || (!hasUp && hasPast) ? 'past' : 'up', false);
  }

  /* карусель: кнопки «назад / вперед» (без скрипта працює гортання пальцем і мишею) */
  each('[data-carousel]', function (g) {
    var strip = g.querySelector('.track');
    var btns = g.querySelectorAll('[data-dir]');
    var update = function () {
      var more = strip.scrollWidth > strip.clientWidth + 4;
      Array.prototype.forEach.call(btns, function (b) { b.hidden = !more; });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        strip.scrollBy({ left: strip.clientWidth * 0.8 * Number(b.getAttribute('data-dir')), behavior: 'smooth' });
      });
    });
    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: 'smooth' }); e.preventDefault(); }
    });
  });
})();
