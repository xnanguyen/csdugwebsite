import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { setupNavigation } = createRequire(import.meta.url)('../assets/js/navigation.js');
const events = {}, attrs = new Map([['aria-expanded', 'false']]);
let open = false, focused = false;
const button = {
  setAttribute: (key, value) => attrs.set(key, value), getAttribute: key => attrs.get(key),
  addEventListener: (type, fn) => { events['button:' + type] = fn; }, focus: () => { focused = true; }
};
const nav = {
  querySelector: () => button, classList: { toggle: (_, value) => { open = value; } },
  addEventListener: (type, fn) => { events['nav:' + type] = fn; }, contains: target => target === button
};
const document = { addEventListener: (type, fn) => { events[type] = fn; } };
const media = { addEventListener: (type, fn) => { events[type] = fn; } };
setupNavigation(nav, document, media);
events['button:click'](); assert(open); assert.equal(attrs.get('aria-expanded'), 'true');
events.keydown({ key: 'Escape' }); assert(!open); assert(focused);
events['button:click'](); events['nav:click']({ target: { closest: () => ({}) } }); assert(!open);
events['button:click'](); events.pointerdown({ target: button }); assert(open);
events.pointerdown({ target: {} }); assert(!open);
events['button:click'](); events.change(); assert(!open);
assert.equal(attrs.get('aria-label'), 'Open navigation');
const html = readFileSync('index.html', 'utf8');
assert.match(html, /<a class="brand" href="index\.html" aria-label="Brown CS DUG home" title="Back to home">/,
  'logo opens the home page relative to the deployment directory, including GitHub project sites');
const start = html.indexOf('window.addEventListener("keydown"');
let keydown, jumps = 0;
vm.runInNewContext(html.slice(start, html.indexOf('canvas.addEventListener("pointerdown"', start)), {
  window: { addEventListener: (_, listener) => { keydown = listener; } },
  state: { mode: 'scroll' }, jump: () => jumps++
});
keydown({ code: 'Space', target: { closest: selector => selector === '.site-nav' ? {} : null } });
assert.equal(jumps, 0, 'Space on the mobile menu does not trigger a game jump');
console.log('ok home logo link, mobile menu toggle, Escape focus, link selection, outside click, and resize');
