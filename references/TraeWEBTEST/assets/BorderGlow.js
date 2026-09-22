(function () {
  'use strict';
  var positions = ['80% 55%','69% 34%','8% 6%','41% 38%','86% 85%','82% 18%','51% 4%'];
  var keys = ['one','two','three','four','five','six','seven'];
  var colors = ['#c084fc','#f472b6','#38bdf8'];
  function hslVars(value, intensity) {
    var match = String(value).match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/), h = match ? match[1] : 40, s = match ? match[2] : 80, l = match ? match[3] : 80;
    var vars = {}, opacities = [100,60,50,40,30,20,10], suffixes = ['','-60','-50','-40','-30','-20','-10'];
    opacities.forEach(function (o, i) { vars['--glow-color' + suffixes[i]] = 'hsl(' + h + 'deg ' + s + '% ' + l + '% / ' + Math.min(o * intensity, 100) + '%)'; });
    return vars;
  }
  function init(card) {
    var edgeSensitivity = Number(card.getAttribute('data-edge-sensitivity') || 30), glowRadius = Number(card.getAttribute('data-glow-radius') || 40), spread = Number(card.getAttribute('data-cone-spread') || 25), glowColor = card.getAttribute('data-glow-color') || '40 80 80';
    card.style.setProperty('--edge-sensitivity', edgeSensitivity); card.style.setProperty('--color-sensitivity', edgeSensitivity + 20); card.style.setProperty('--glow-padding', glowRadius + 'px'); card.style.setProperty('--cone-spread', spread); card.style.setProperty('--border-radius', (card.getAttribute('data-border-radius') || 28) + 'px');
    card.style.setProperty('--card-bg', card.getAttribute('data-background') || '#120F17');
    Object.keys(hslVars(glowColor, Number(card.getAttribute('data-glow-intensity') || 1))).forEach(function (key) { card.style.setProperty(key, hslVars(glowColor, Number(card.getAttribute('data-glow-intensity') || 1))[key]); });
    keys.forEach(function (key, i) { var c = colors[i === 0 || i === 3 ? 0 : i === 1 || i === 4 || i === 6 ? 1 : 2]; card.style.setProperty('--gradient-' + key, 'radial-gradient(at ' + positions[i] + ', ' + c + ' 0px, transparent 50%)'); });
    card.style.setProperty('--gradient-base', 'linear-gradient(' + colors[0] + ' 0 100%)');
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, cx = r.width / 2, cy = r.height / 2;
      var dx = x - cx, dy = y - cy, edge = Math.min(Math.max(Math.min(Math.abs(dx) ? Math.abs(dx) / cx : 0, Math.abs(dy) ? Math.abs(dy) / cy : 0), 0), 1);
      var radians = Math.atan2(dy, dx), angle = radians * 180 / Math.PI + 90; if (angle < 0) angle += 360;
      card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3)); card.style.setProperty('--cursor-angle', angle.toFixed(3) + 'deg');
    });
    card.addEventListener('pointerleave', function () { card.style.setProperty('--edge-proximity', '0'); });
  }
  function boot() { document.querySelectorAll('[data-border-glow]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
