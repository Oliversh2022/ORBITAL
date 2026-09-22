(function () {
  'use strict';

  function initJellyRadio(root) {
    var chips = Array.prototype.slice.call(root.querySelectorAll('.jelly-radio__chip'));
    if (!chips.length) return;
    var active = chips.findIndex(function (chip) { return chip.getAttribute('data-on') === 'true'; });
    if (active < 0) active = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function springAnimation(chip, index, selected) {
      if (reduce || !chip.animate) return;
      var distance = Math.abs(index - selected);
      var direction = index === selected ? 0 : (index > selected ? 1 : -1);
      var push = direction * (14 + Math.max(0, 2 - distance) * 2);
      var start = 'translateX(0px) scale(1, 1)';
      var end = index === selected
        ? 'translateX(0px) scale(1.2, 1.2)'
        : 'translateX(' + push + 'px) scale(0.96, 0.96)';
      var overshoot = index === selected
        ? 'translateX(0px) scale(1.26, 1.08)'
        : 'translateX(' + (push * 1.18) + 'px) scale(0.93, 0.99)';
      var settle = index === selected
        ? 'translateX(0px) scale(1.16, 1.24)'
        : 'translateX(' + (push * 0.92) + 'px) scale(0.975, 0.955)';
      chip.animate([
        { transform: start },
        { transform: overshoot, offset: 0.42 },
        { transform: settle, offset: 0.72 },
        { transform: end }
      ], {
        duration: 560,
        delay: distance * 30,
        easing: 'cubic-bezier(0.22, 1.25, 0.36, 1)',
        fill: 'both'
      });
      chip.style.setProperty('--jr-x', push + 'px');
    }

    function select(index, notify) {
      if (!chips[index] || chips[index].hasAttribute('aria-disabled')) return;
      active = index;
      chips.forEach(function (chip, i) {
        var on = i === active;
        chip.setAttribute('data-on', on ? 'true' : 'false');
        chip.setAttribute('aria-checked', on ? 'true' : 'false');
        chip.tabIndex = on ? 0 : -1;
        chip.setAttribute('data-near', !on && Math.abs(i - active) === 1 ? 'true' : 'false');
        if (notify) springAnimation(chip, i, active);
      });
      if (notify) {
        root.dispatchEvent(new CustomEvent('jellychange', {
          detail: { value: chips[active].getAttribute('data-value'), index: active }
        }));
      }
    }

    chips.forEach(function (chip, index) {
      chip.addEventListener('click', function (event) {
        event.preventDefault();
        select(index, true);
        var href = chip.getAttribute('data-href');
        if (href) window.location.href = href;
      });
      chip.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % chips.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + chips.length) % chips.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = chips.length - 1;
        if (next === null && (event.key === 'Enter' || event.key === ' ')) next = index;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
        chips[next].focus();
      });
    });

    select(active, false);
  }

  function boot() {
    document.querySelectorAll('[data-jelly-radio]').forEach(initJellyRadio);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
