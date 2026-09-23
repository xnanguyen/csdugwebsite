import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { getMemberPage, setupMemberTilt, mountTeamMembers } = require('../assets/js/team-members.js');
const html = readFileSync('index.html', 'utf8');
const publishedRoster = JSON.parse(html.match(/<script type="application\/json" id="team-member-data">([\s\S]*?)<\/script>/)[1]);
assert(Array.isArray(publishedRoster));
for (const member of publishedRoster) {
  for (const field of ['name', 'pronouns', 'study', 'role', 'photo']) assert.equal(typeof member[field], 'string');
}
// Test the requested placeholder design without preventing real roster edits later.
const roster = Array.from({ length: 16 }, () => ({ name: 'Name', pronouns: 'pronouns', study: 'major + year', role: 'position', photo: '' }));

for (const size of [0, 1, 4, 5, 16, 17, 28]) {
  const members = Array.from({ length: size }, (_, n) => ({ name: `Member ${n + 1}` }));
  const count = Math.ceil(size / 4);
  assert.equal(getMemberPage(members, -1).page, 0);
  assert.equal(getMemberPage(members, 999).page, Math.max(0, count - 1));
  const all = [];
  for (let page = 0; page < count; page++) {
    const result = getMemberPage(members, page);
    assert.equal(result.pageCount, count);
    assert(result.members.length <= 4);
    all.push(...result.members);
  }
  assert.deepEqual(all, members, 'every roster member appears exactly once');
}

class Element {
  constructor(tag = 'div', document) {
    this.tagName = tag;
    this.ownerDocument = document;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.styles = new Map();
    this.classes = new Set();
    this.selectors = new Map();
    this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
    this.style = { setProperty: (name, value) => this.styles.set(name, value), removeProperty: name => this.styles.delete(name) };
  }
  querySelector(selector) { return this.selectors.get(selector); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  append(child) { this.children.push(child); }
  replaceChildren(fragment) { this.children = fragment.children; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  focus() { this.ownerDocument.activeElement = this; }
  click() { if (!this.disabled) { this.focus(); this.listeners.get('click')?.(); } }
  getBoundingClientRect() { return { left: 100, top: 100, width: 400, height: 240 }; }
  remove() { this.removed = true; }
}

const document = {
  activeElement: null,
  createElement: tag => new Element(tag, document),
  createDocumentFragment: () => new Element('fragment', document)
};
function makeCard() {
  const card = new Element('article', document);
  for (const selector of ['.member-name', '.member-pronouns', '.member-study', '.member-role', '.member-photo']) {
    card.selectors.set(selector, new Element('div', document));
  }
  return card;
}
const template = { content: { firstElementChild: { cloneNode: makeCard } } };
function mount(members) {
  const gallery = new Element('div', document);
  for (const selector of ['.profiles', '.team-page-numbers', '.team-pagination', '[data-page-previous]', '[data-page-next]', '[data-page-status]']) {
    gallery.selectors.set(selector, new Element('div', document));
  }
  gallery.querySelector('.profiles').id = 'member-cards';
  mountTeamMembers(gallery, members, template, { matches: false });
  return {
    cards: gallery.querySelector('.profiles'), numbers: gallery.querySelector('.team-page-numbers'),
    previous: gallery.querySelector('[data-page-previous]'), next: gallery.querySelector('[data-page-next]'),
    navigation: gallery.querySelector('.team-pagination'), status: gallery.querySelector('[data-page-status]')
  };
}

const gallery = mount(roster);
assert.equal(gallery.cards.children.length, 4);
assert.equal(gallery.numbers.children.length, Math.ceil(roster.length / 4));
assert.equal(gallery.previous.disabled, true);
assert.equal(gallery.cards.children[0].querySelector('.member-name').textContent, 'Name');
assert.equal(gallery.cards.children[0].querySelector('.member-pronouns').textContent, '(pronouns)');
assert.equal(gallery.cards.children[0].querySelector('.member-study').textContent, 'major + year');
assert.equal(gallery.cards.children[0].querySelector('.member-role').textContent, 'position');
gallery.next.click();
assert.equal(gallery.previous.disabled, false);
assert.equal(gallery.numbers.children[1].attributes.get('aria-current'), 'page');
assert.equal(gallery.cards.children[0].querySelector('.member-name').textContent, roster[4].name);
gallery.previous.click();
assert.equal(gallery.numbers.children[0].attributes.get('aria-current'), 'page');
assert.equal(document.activeElement, gallery.numbers.children[0], 'focus remains usable at a disabled boundary');
gallery.numbers.children.at(-1).click();
assert.equal(gallery.next.disabled, true);
assert.equal(gallery.cards.children.length, 4);
assert.match(gallery.status.textContent, /Page 4 of 4/);
gallery.previous.click();
assert.equal(gallery.numbers.children[2].attributes.get('aria-current'), 'page');

const partial = mount(roster.slice(0, 5));
partial.next.click();
assert.equal(partial.cards.children.length, 4, 'last page reserves all four slots to avoid shifting scenery');
assert.equal(partial.cards.children.filter(card => card.attributes.get('aria-hidden') === 'true').length, 3);
assert.equal(mount(roster.slice(0, 1)).navigation.hidden, true);
const empty = mount([]);
assert.equal(empty.navigation.hidden, true);
assert.equal(empty.cards.children[0].textContent, 'Meet the team soon.');

const portrait = mount([{ ...roster[0], photo: 'assets/images/example.jpg' }]);
const photo = portrait.cards.children[0].querySelector('.member-photo');
assert.equal(photo.children[0].alt, 'Name');
photo.children[0].listeners.get('error')();
assert.equal(photo.children[0].removed, true);
assert.equal(photo.attributes.get('aria-label'), 'Photo coming soon for Name');

for (const reduced of [false, true]) {
  const card = makeCard();
  const preference = { matches: reduced };
  setupMemberTilt(card, preference);
  card.listeners.get('pointermove')({ clientX: 900, clientY: -20, pointerType: 'mouse' });
  if (reduced) assert.equal(card.styles.size, 0);
  else {
    assert.equal(card.styles.get('--card-rotate-x'), '4deg');
    assert.equal(card.styles.get('--card-rotate-y'), '4deg');
    assert(card.classes.has('is-tilted'));
    card.listeners.get('pointerleave')();
    assert.equal(card.styles.size, 0);
    assert(!card.classes.has('is-tilted'));
    card.listeners.get('pointermove')({ clientX: 400, clientY: 150, pointerType: 'touch' });
    assert.equal(card.styles.size, 0, 'touch scrolling does not tilt cards');
  }
}

let keydown, jumps = 0;
const start = html.indexOf('window.addEventListener("keydown"');
vm.runInNewContext(html.slice(start, html.indexOf('canvas.addEventListener("pointerdown"', start)), {
  window: { addEventListener: (_, listener) => { keydown = listener; } },
  state: { mode: 'scroll' }, jump: () => jumps++
});
keydown({ code: 'Space', target: { closest: selector => selector === '.team-pagination' ? {} : null } });
assert.equal(jumps, 0, 'Space on pagination never jumps the game character');

assert.equal(readFileSync('assets/fonts/ABCFavoritMono-Book.otf').subarray(0, 4).toString(), 'OTTO');
assert.match(html, /@font-face\s*\{[^}]*ABCFavoritMono-Book\.otf[^}]*font-weight: 400/);
assert.match(html, /\.member-name \{[^}]*font: 700/);
assert.match(html, /\.member-details \{[^}]*font-weight: 400/);
assert(!html.includes('member-decoration'), 'no star decorations are rendered on member cards');
assert.match(html, /\.team-page-button \{[^}]*border: 0;[^}]*background: transparent;[^}]*box-shadow: none;/);
assert.match(html, /\.team-page-button\[aria-current="page"\]::after/, 'the current page has an unboxed underline indicator');
console.log('ok member roster pagination, page boundaries, stable slots, photo fallback, subtle tilt, touch/reduced motion, and keyboard isolation');
