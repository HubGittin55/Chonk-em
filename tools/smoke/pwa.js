/* CHONK'EM smoke suite: PWA shell — manifest, icons, service worker, menu title anim
   Loaded by tools/smoke.js — file-system checks, runs outside the game vm context. */
// 2026-10-16
const _fs = require('fs'), _path = require('path');
const _root = _path.join(__dirname, '..', '..');
const _manifest = (() => { try { return JSON.parse(_fs.readFileSync(_path.join(_root, 'manifest.webmanifest'), 'utf8')); } catch (e) { return null; } })();

T('pwa: manifest is valid JSON with name, start_url, display, and icons', (() =>
  !!_manifest && !!_manifest.name && !!_manifest.short_name && !!_manifest.start_url &&
  !!_manifest.display && Array.isArray(_manifest.icons) && _manifest.icons.length >= 2)());
T('pwa: every manifest icon exists on disk', (() =>
  !!_manifest && _manifest.icons.every(ic => _fs.existsSync(_path.join(_root, ic.src))))());
T('pwa: service worker precaches the full offline shell', (() => {
  const sw = _fs.readFileSync(_path.join(_root, 'sw.js'), 'utf8');
  const need = ['index.html', 'css/style.css', 'js/main.js', 'js/save.js', 'js/weighin.js', 'icons/icon-192.svg'];
  return need.every(f => sw.includes(f)) && /install/.test(sw) && /activate/.test(sw) && /fetch/.test(sw) &&
    /skipWaiting/.test(sw);
})());
T('pwa: index.html links manifest + theme color, registers the worker, has the endless card slot', (() => {
  const html = _fs.readFileSync(_path.join(_root, 'index.html'), 'utf8');
  return /rel="manifest" href="manifest.webmanifest"/.test(html) &&
    /name="theme-color"/.test(html) &&
    /navigator\.serviceWorker\.register\('sw\.js'\)/.test(html) &&
    /location\.protocol\.indexOf\('http'\) === 0/.test(html) && // no SW attempt off file://
    /id="endlessRow"/.test(html);
})());
T('pwa: menu title bounces, with a reduced-motion guard', (() => {
  const css = _fs.readFileSync(_path.join(_root, 'css/style.css'), 'utf8');
  return /#menuOverlay h1 \{[^}]*animation: chonk-bounce/.test(css) &&
    /@keyframes chonk-bounce/.test(css) &&
    /prefers-reduced-motion: reduce/.test(css);
})());
