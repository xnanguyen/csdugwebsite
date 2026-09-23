import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const { createFolderMessages } = createRequire(import.meta.url)('../assets/js/about-folders.js');
function fixture() {
  const handlers = {}, messages = new Map();
  const buttons = ['community', 'academics', 'career'].map(name => {
    const attrs = new Map([['aria-controls', name], ['aria-expanded', 'false']]);
    const events = {};
    messages.set(name, { hidden: true });
    return {
      getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
      addEventListener: (event, listener) => { events[event] = listener; }, click: () => events.click()
    };
  });
  const document = {
    querySelectorAll: () => buttons, getElementById: id => messages.get(id),
    addEventListener: (event, listener) => { handlers[event] = listener; }
  };
  const folder = createFolderMessages(document);
  const visible = () => [...messages.entries()].filter(([, element]) => !element.hidden).map(([name]) => name);
  return { buttons, handlers, folder, visible };
}

const { buttons, handlers, folder, visible } = fixture();
assert.deepEqual(visible(), []);
for (const [index, name] of ['community', 'academics', 'career'].entries()) {
  folder.land(buttons[index]);
  assert.deepEqual(visible(), [name], 'first landing opens only the new folder');
  assert.equal(buttons[index].getAttribute('aria-expanded'), 'true');
}
folder.land({});
assert.deepEqual(visible(), [], 'leaving the folders closes the final message');
for (const button of buttons.toReversed()) {
  folder.land(button);
  assert.deepEqual(visible(), [], 'return trips do not repeat the automatic tour');
  button.click();
  assert.equal(visible().length, 1, 'manual click still opens a visited folder');
  button.click();
  assert.deepEqual(visible(), []);
}
buttons[0].click(); buttons[1].click();
assert.deepEqual(visible(), ['academics'], 'manual controls remain exclusive');
handlers.keydown({ key: 'Escape' });
assert.deepEqual(visible(), []);
buttons[2].click();
handlers.pointerdown({ target: { closest: () => ({}) } });
assert.deepEqual(visible(), ['career'], 'clicking the message itself does not dismiss it');
handlers.pointerdown({ target: { closest: () => null } });
assert.deepEqual(visible(), []);
folder.close(); folder.land(buttons[0]);
assert.deepEqual(visible(), [], 'closing or resetting the game cannot clear visit history');
const fresh = fixture();
fresh.folder.land(fresh.buttons[0]);
assert.deepEqual(fresh.visible(), ['community'], 'a new page visit gets a new first pass');

const html = readFileSync('index.html', 'utf8');
for (const text of [
  'Find your people in CS.',
  'Connect with students across classes and concentrations, make new friends, and get involved in the Brown CS community.',
  'Navigate CS at Brown.',
  'Explore courses, plan your concentration, and find academic resources and advice from fellow students.',
  'Explore what comes next.',
  'Discover career paths, prepare for internships, and connect with alumni and industry professionals.'
]) assert(html.includes(text), text);

const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end));
for (const reduced of [false, true]) {
  const arrivals = [];
  const state = {
    autoLeap: { from: { x: 0, y: 0 }, targetIndex: 5, sectionIndex: 1, barIndex: 1,
      elapsed: 0, turnDuration: reduced ? 0 : 100, duration: reduced ? 1 : 860 },
    platforms: [{}, {}]
  };
  const context = vm.createContext({
    state, prefersReduced: reduced,
    landingPoint: () => ({ x: 100, y: 400 }), positionFollower: () => {}, startAutoJump: () => {},
    scrollBear: { classList: { toggle() {}, remove() {} } },
    onPlatformLanding: (...args) => arrivals.push(args)
  });
  vm.runInContext(extract('function updateAutoJump(', 'function destinationScroll('), context);
  vm.runInContext('updateAutoJump(0);', context);
  assert.equal(arrivals.length, 0, 'scroll hop does not open a message before landing');
  vm.runInContext('updateAutoJump(2000); updateAutoJump(16);', context);
  assert.deepEqual(arrivals, [[1, 1]], 'scroll landing calls the folder handler once');

  arrivals.length = 0;
  state.travel = { from: { x: 0, y: 0 }, fromScroll: 0, targetIndex: 1, targetBar: 2,
    elapsed: 0, turnDuration: reduced ? 0 : 100, duration: reduced ? 1 : 1200, arcHeight: 40 };
  context.destinationScroll = () => 200;
  context.window = { scrollY: 200, scrollTo() {} };
  context.sections = [{}, { querySelectorAll: () => [{}, {}, { focus() {} }] }];
  context.syncScrollBear = () => {};
  vm.runInContext(extract('function updateTravel(', 'window.addEventListener("resize"'), context);
  vm.runInContext('updateTravel(0);', context);
  assert.equal(arrivals.length, 0, 'keyboard hop does not open a message before landing');
  vm.runInContext('updateTravel(2000);', context);
  assert.deepEqual(arrivals, [[1, 2]], 'keyboard landing calls the same first-pass handler');
}
console.log('ok exact folder copy, exclusive first landings, click-only revisits, dismissals, keyboard/scroll arrivals, and reduced motion');
