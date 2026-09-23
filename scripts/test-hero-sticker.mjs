import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const start = html.indexOf('function setupHeroSticker(');
const source = html.slice(start, html.indexOf('setupHeroSticker(document.', start));
assert(html.includes('src="assets/images/hero-bear-sticker-source.png"'));
assert(!html.includes('src="assets/images/hero-bear-head.png"'));
assert.match(html, /\.hero-title-cs \{[^}]*z-index: 1/);
assert.match(html, /\.hero-title-dug \{[^}]*z-index: 3/);
assert.match(html, /\.hero-title-sticker \{[^}]*z-index: 2/);
assert.match(html, /\.hero-title-sticker \{[^}]*width: \.9em/);
assert.match(html, /\.hero-title-sticker:focus-visible \{ outline: none; \}/,
  'keyboard focus keeps the sticker borderless; its lifted state remains the focus cue');
assert.match(html, /translate3d\(var\(--shift-x, 0px\), -7px, 22px\)/);
assert.match(html, /\.hero-title-sticker\.is-active \.hero-title-bear::after \{ opacity: \.32/);

for (const prefersReduced of [false, true]) {
  const events = {}, classes = new Set(), styles = new Map();
  const sticker = {
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    style: { setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name) },
    addEventListener: (name, handler) => { events[name] = handler; },
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 100, height: 100 })
  };
  const scope = vm.createContext({ sticker, prefersReduced });
  vm.runInContext(source + '\nsetupHeroSticker(sticker);', scope);
  events.pointerenter();
  assert(classes.has('is-active'));
  events.pointermove({ clientX: 200, clientY: 100, pointerType: 'mouse' });
  if (prefersReduced) assert.equal(styles.size, 0, 'no pointer-driven motion when reduced motion is enabled');
  else {
    assert.equal(styles.get('--rotate-x'), '24deg');
    assert.equal(styles.get('--rotate-y'), '10deg');
    assert.equal(styles.get('--shift-x'), '3px');
    assert.equal(styles.get('--shine-x'), '85%');
    events.pointermove({ clientX: 150, clientY: 150, pointerType: 'mouse' });
    assert.equal(styles.get('--rotate-x'), '14deg', 'sticker stays lifted even when the pointer is centered');
    assert.equal(styles.get('--rotate-y'), '-10deg');
  }
  events.pointerleave();
  assert.equal(styles.size, 0);
  assert(!classes.has('is-active'));
  events.focus();
  events.click();
  assert(classes.has('is-active'), 'keyboard and tap keep the foil effect visible');
  events.blur();
  assert(!classes.has('is-active'));
  console.log(`ok hero sticker: layering, hover, tap, focus, cleanup, reduced motion=${prefersReduced}`);
}
