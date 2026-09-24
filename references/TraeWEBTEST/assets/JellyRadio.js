(function () {
  'use strict';

  function initJellyRadio(root) {
    var chips = Array.prototype.slice.call(root.querySelectorAll('.jelly-radio__chip'));
    if (!chips.length) return;
    var noActive = root.getAttribute('data-no-active') === 'true';
    var active = noActive ? -1 : chips.findIndex(function (chip) { return chip.getAttribute('data-on') === 'true'; });
    if (active < 0 && !noActive) active = 0;
    if (!noActive && window.location.hash) {
      var hashActive = chips.findIndex(function (chip) {
        return chip.getAttribute('data-scroll-target') === window.location.hash;
      });
      if (hashActive >= 0) active = hashActive;
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scrollSpyHoldUntil = 0;

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

    function prefetchPage(url) {
      if (!url || url.charAt(0) === '#') return;
      var absolute = new URL(url, window.location.href).href;
      var alreadyPrefetched = Array.prototype.some.call(
        document.querySelectorAll('link[rel="prefetch"]'),
        function (link) { return link.href === absolute; }
      );
      if (alreadyPrefetched) return;
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = absolute;
      document.head.appendChild(link);
    }

    function scrollToTarget(selector, href) {
      if (!selector) return false;
      scrollSpyHoldUntil = Date.now() + 800;
      if (selector === '#top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        var target = document.querySelector(selector);
        if (!target) return false;
        var top = target.getBoundingClientRect().top + window.scrollY - 76;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      if (href && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', href);
      }
      return true;
    }

    function syncActiveWithScroll() {
      if (Date.now() < scrollSpyHoldUntil) return;
      var scrollChips = chips.filter(function (chip) {
        return chip.getAttribute('data-scroll-target');
      });
      if (scrollChips.length < 2) return;
      var marker = window.scrollY + 120;
      var selected = scrollChips[0];
      var selectedTop = 0;
      scrollChips.forEach(function (chip) {
        var selector = chip.getAttribute('data-scroll-target');
        var top = selector === '#top'
          ? 0
          : (document.querySelector(selector) || {}).offsetTop;
        if (typeof top !== 'number') return;
        if (top <= marker && top >= selectedTop) {
          selected = chip;
          selectedTop = top;
        }
      });
      var selectedIndex = chips.indexOf(selected);
      if (selectedIndex >= 0 && selectedIndex !== active) select(selectedIndex, true);
    }

    chips.forEach(function (chip, index) {
      if (chip.getAttribute('data-prefetch') === 'true') {
        var warmRoute = function () { prefetchPage(chip.getAttribute('data-href')); };
        chip.addEventListener('pointerenter', warmRoute, { once: true, passive: true });
        chip.addEventListener('focus', warmRoute, { once: true });
      }
      chip.addEventListener('click', function (event) {
        event.preventDefault();
        select(index, true);
        var href = chip.getAttribute('data-href');
        var scrollTarget = chip.getAttribute('data-scroll-target');
        if (scrollTarget && scrollToTarget(scrollTarget, href)) return;
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

    var hasScrollTargets = chips.some(function (chip) { return chip.getAttribute('data-scroll-target'); });
    if (noActive) {
      chips.forEach(function (chip, index) {
        chip.setAttribute('data-on', 'false');
        chip.setAttribute('aria-checked', 'false');
        chip.setAttribute('data-near', 'false');
        chip.tabIndex = index === 0 ? 0 : -1;
      });
    } else {
      select(active, true);
    }
    if (hasScrollTargets) {
      var scheduleScrollSync = function () { window.requestAnimationFrame(syncActiveWithScroll); };
      window.addEventListener('scroll', scheduleScrollSync, { passive: true });
      window.addEventListener('resize', scheduleScrollSync, { passive: true });
      window.setTimeout(syncActiveWithScroll, 0);
    }
  }

  function boot() {
    document.querySelectorAll('[data-jelly-radio]').forEach(initJellyRadio);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
