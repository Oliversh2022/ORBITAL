(function () {
  'use strict';
  var SLOP = { fine: 4, coarse: 8 }, FLING = 0.16, HISTORY_MS = 90;
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var snap = function (deg) { return Math.round(deg / 180) * 180; };
  var isBack = function (deg) { return Math.abs(Math.round(deg / 180)) % 2 === 1; };
  function state(value, stiffness, damping, mass) { return { value: value, target: value, velocity: 0, stiffness: stiffness, damping: damping, mass: mass || 1 }; }

  function init(card) {
    var rotor = card.querySelector('.flip-card__rotor');
    var shadow = card.querySelector('.flip-card__shadow');
    var front = card.querySelector('.flip-card__face--front');
    var back = card.querySelector('.flip-card__face--back');
    if (!rotor || !front || !back) return;
    var axis = card.getAttribute('data-axis') || 'y';
    var draggable = card.hasAttribute('data-draggable');
    var flipOnClick = card.getAttribute('data-flip-on-click') !== 'false';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stiffness = Number(card.getAttribute('data-stiffness') || 170);
    var damping = Number(card.getAttribute('data-damping') || 20);
    var tiltMax = Number(card.getAttribute('data-tilt-max') || 12);
    var hoverScale = Number(card.getAttribute('data-hover-scale') || 1.03);
    var perspective = Number(card.getAttribute('data-perspective') || 1100);
    var turn = state(card.hasAttribute('data-flipped') ? 180 : 0, stiffness, damping, 1);
    var tiltX = state(0, 240, 24, 0.6), tiltY = state(0, 240, 24, 0.6);
    var lift = state(1, 320, 26, 1), sheen = state(0, 320, 26, 1);
    var frame = 0, last = 0, grip = null, width = 300, height = 400;
    function near(a, b) { return Math.abs(a - b) < 0.01; }
    function advance(s, dt) {
      var force = s.stiffness * (s.target - s.value) - s.damping * s.velocity;
      s.velocity += force / s.mass * dt; s.value += s.velocity * dt;
      if (near(s.value, s.target) && Math.abs(s.velocity) < 0.04) { s.value = s.target; s.velocity = 0; }
    }
    function render() {
      card.style.setProperty('--fc-turn', turn.value + 'deg');
      card.style.setProperty('--fc-tilt-x', tiltX.value + 'deg');
      card.style.setProperty('--fc-tilt-y', tiltY.value + 'deg');
      card.style.setProperty('--fc-lift', lift.value);
      card.style.setProperty('--fc-sheen', sheen.value);
      card.style.setProperty('--fc-perspective', perspective + 'px');
      var facing = Math.abs(Math.cos(turn.value * Math.PI / 180));
      card.style.setProperty('--fc-shadow-scale', (0.08 + 0.92 * facing).toFixed(3));
      card.style.setProperty('--fc-shadow-opacity', (0.1 + 0.9 * facing * facing).toFixed(3));
      card.setAttribute('aria-pressed', isBack(turn.value) ? 'true' : 'false');
      front.setAttribute('aria-hidden', isBack(turn.value) ? 'true' : 'false');
      back.setAttribute('aria-hidden', isBack(turn.value) ? 'false' : 'true');
      if (shadow) shadow.style.transform = 'scaleX(' + (0.08 + 0.92 * facing) + ')';
    }
    function tick(now) {
      var dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016); last = now;
      advance(turn, dt); advance(tiltX, dt); advance(tiltY, dt); advance(lift, dt); advance(sheen, dt); render();
      frame = requestAnimationFrame(tick);
    }
    function wake() { if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); } }
    function setTarget(s, value, velocity) { s.target = value; if (velocity !== undefined) s.velocity = velocity; if (reduced) { s.value = value; s.velocity = 0; } wake(); }
    function rest() { setTarget(tiltX, 0); setTarget(tiltY, 0); setTarget(lift, 1); setTarget(sheen, 0); }
    function settle(to, velocity) {
      setTarget(turn, to, velocity || 0); card.toggleAttribute('data-flipped', isBack(to));
      card.dispatchEvent(new CustomEvent('flipchange', { detail: { flipped: isBack(to) } }));
    }
    function flip(instant) {
      var base = snap(turn.value), next = isBack(base) ? base - 180 : base + 180;
      if (instant || reduced) {
        turn.value = next; turn.target = next; turn.velocity = 0; render();
        card.toggleAttribute('data-flipped', isBack(next));
        card.dispatchEvent(new CustomEvent('flipchange', { detail: { flipped: isBack(next) } }));
      } else {
        settle(next, 0);
      }
      wake();
    }
    card.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || grip) return; try { card.setPointerCapture(e.pointerId); } catch (_) {}
      width = card.getBoundingClientRect().width || width; height = card.getBoundingClientRect().height || height; turn.velocity = 0;
      grip = { id: e.pointerId, x: e.clientX, y: e.clientY, base: turn.value, moved: false, slop: e.pointerType === 'touch' ? SLOP.coarse : SLOP.fine, hist: [] };
      if (!reduced) setTarget(lift, hoverScale);
    });
    card.addEventListener('pointermove', function (e) {
      var g = grip;
      if (g && g.id === e.pointerId) {
        var d = axis === 'x' ? e.clientY - g.y : e.clientX - g.x;
        if (!g.moved) { if (Math.abs(d) < g.slop || !draggable || reduced) return; g.moved = true; card.toggleAttribute('data-dragging', true); rest(); }
        var span = axis === 'x' ? height : width; turn.value = g.base + (axis === 'x' ? -1 : 1) * (d / span) * 180; turn.target = turn.value; turn.velocity = 0; render();
        var now = performance.now(); g.hist.push({ t: now, v: turn.value }); while (g.hist.length > 2 && now - g.hist[0].t > HISTORY_MS) g.hist.shift(); return;
      }
      if (reduced || e.pointerType === 'touch') return;
      var rect = card.getBoundingClientRect(), px = clamp((e.clientX - rect.left) / rect.width, 0, 1), py = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      setTarget(tiltX, (0.5 - py) * 2 * tiltMax); setTarget(tiltY, (px - 0.5) * 2 * tiltMax);
      card.style.setProperty('--fc-gx', px * 100 + '%'); card.style.setProperty('--fc-gy', py * 100 + '%'); setTarget(sheen, 1); setTarget(lift, hoverScale);
    });
    function release(e, cancelled) {
      var g = grip; if (!g || g.id !== e.pointerId) return; grip = null; card.toggleAttribute('data-dragging', false); rest();
      try { if (card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!g.moved) { if (!cancelled && flipOnClick) flip(false); else settle(turn.target, 0); return; }
      var velocity = 0, a = g.hist[0], b = g.hist[g.hist.length - 1];
      if (!cancelled && a && b && b.t > a.t && performance.now() - b.t < 60) velocity = (b.v - a.v) / (b.t - a.t) * 1000;
      var to = cancelled ? snap(g.base) : clamp(snap(turn.value + velocity * FLING), snap(turn.value) - 180, snap(turn.value) + 180); settle(to, velocity);
    }
    card.addEventListener('pointerup', function (e) { release(e, false); }); card.addEventListener('pointercancel', function (e) { release(e, true); }); card.addEventListener('lostpointercapture', function (e) { release(e, true); });
    card.addEventListener('pointerleave', function () { if (!grip) rest(); });
    card.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); flip(true); } });
    card.addEventListener('dragstart', function (e) { e.preventDefault(); });
    card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', card.getAttribute('aria-label') || 'Flip card'); render(); wake();
  }
  function boot() { document.querySelectorAll('[data-flip-card]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
