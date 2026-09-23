import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const font = readFileSync('assets/fonts/ABCFavoritMono-Bold.otf');
assert.equal(font.subarray(0, 4).toString(), 'OTTO', 'the bundled font is an OpenType file');
assert.match(html, /@font-face\s*\{[^}]*font-family: "ABC Favorit Mono";[^}]*font-weight: 700;/);
for (const heading of ['h1', 'h2']) {
  assert.match(html, new RegExp(`${heading} \\{[^}]*font-family: var\\(--heading\\);[^}]*font-weight: 700;`));
}
assert.match(html, /<span class="press-start">PRESS SPACE TO START<\/span>/);
assert(!html.includes('startGame'), 'start text has no game reset or click handler');
assert.match(html, /\.press-start \{[^}]*color: #58364a;[^}]*cursor: default;[^}]*text-shadow: none;/);
assert(!html.includes('.press-start:hover'), 'plain text has no hover glow');

let keydown, jumps = 0, prevented = 0;
const start = html.indexOf('window.addEventListener("keydown"');
const source = html.slice(start, html.indexOf('canvas.addEventListener("pointerdown"', start));
const scope = vm.createContext({
  window: { innerHeight: 720, addEventListener: (name, handler) => { keydown = handler; } },
  document: { getElementById: () => ({ getBoundingClientRect: () => ({ top: 0, bottom: 900 }) }) },
  state: { mode: 'intro' }, jump: () => { jumps++; }
});
vm.runInContext(source, scope);
const event = { code: 'Space', repeat: false, target: { closest: () => null }, preventDefault: () => { prevented++; } };
keydown(event);
assert.equal(jumps, 1, 'Space still starts the game');
assert.equal(prevented, 1, 'Space does not scroll the page while playing');
keydown({ ...event, repeat: true });
assert.equal(jumps, 1, 'holding Space does not queue extra jumps');
console.log('ok bundled bold headings, non-interactive start text, no glow, and keyboard start');
