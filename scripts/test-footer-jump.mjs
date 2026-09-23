import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));

for (const width of [390, 1280]) for (const reduced of [false, true]) {
  const window = { innerWidth: width, innerHeight: width < 600 ? 844 : 900, scrollY: 0,
    scrollTo({ top }) { this.scrollY = top; } };
  const documentElement = { scrollHeight: 6600 };
  const platform = y => ({
    querySelector: () => null, classList: { contains: () => false },
    getBoundingClientRect: () => ({ left: 100, width: 144, top: y - window.scrollY }),
    focus() {}
  });
  const sections = ['events', 'about', 'resources', 'team', 'contact'].map((id, index) => ({
    id,
    querySelectorAll: () => id === 'contact' ? [] : [platform(1100 + index * 1100)],
    getBoundingClientRect: () => ({ top: 1000 + index * 1100 - window.scrollY })
  }));
  const document = {
    documentElement,
    getElementById: () => ({ offsetHeight: 900 }),
    querySelector: selector => {
      assert.equal(selector, 'footer');
      return { getBoundingClientRect: () => ({ left: 0, width, bottom: documentElement.scrollHeight - window.scrollY }) };
    },
    body: { classList: { toggle() {} } }
  };
  const state = { mode: 'section', sectionIndex: 3, sectionBarIndex: 0,
    platforms: [{ x: 30, y: 200 }, { x: 240, y: 320 }], barWidth: 100,
    scrollOrigin: 0, scrollBias: 0, current: 1 };
  const scrollBear = { style: {}, classList: { add() {}, remove() {}, toggle() {} } };
  const context = vm.createContext({ window, document, sections, state, scrollBear,
    prefersReduced: reduced, faceTarget() {}, onPlatformLanding() {},
    getComputedStyle: () => ({ scrollMarginTop: '120px' }),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: -window.scrollY }) }
  });
  vm.runInContext(extract('function landingPoint(', 'window.addEventListener("resize"'), context);
  const run = source => vm.runInContext(source, context);
  const route = run('scrollRoute()');
  const teamIndex = route.length - 2;
  const footerIndex = route.length - 1;
  state.autoIndex = state.autoDesired = teamIndex;
  state.scrollDriven = true;
  state.scrollPosition = run('landingPoint(3)');
  const oldScrollHeight = documentElement.scrollHeight;

  window.scrollY = route.at(-1).scrollAt - 1;
  run('updateScrollProgress()');
  assert.equal(state.autoLeap, undefined, 'bear stays at Team before the footer trigger');
  window.scrollY = route.at(-1).scrollAt + 1;
  run('updateScrollProgress()');
  assert.equal(state.autoLeap.sectionIndex, 4, 'scrolling down starts the footer drop');
  run('updateAutoJump(430)');
  if (!reduced) assert(state.scrollPosition.y > route[teamIndex].point.y, 'bear animates downward');
  run('updateAutoJump(1000)');
  assert.equal(state.autoIndex, footerIndex);
  assert.equal(state.autoLeap, null);
  assert.equal(state.scrollTarget, null, 'there is no wraparound to the hero');
  assert(parseFloat(scrollBear.style.top) > window.innerHeight, 'whole bear disappears below the viewport');
  assert.equal(documentElement.scrollHeight, oldScrollHeight, 'virtual stop needs no extra page space');

  window.scrollY = route.at(-1).scrollAt - 1;
  run('updateScrollProgress()');
  assert.equal(state.autoLeap.sectionIndex, 3, 'scrolling up reverses the footer drop');
  run('updateAutoJump(1000)');
  assert.equal(state.autoIndex, teamIndex);
  assert.equal(state.scrollPosition.y, route[teamIndex].point.y, 'return lands exactly on the Team bar');

  // A reversal during flight queues the return instead of stranding the bear below the page.
  window.scrollY = route.at(-1).scrollAt + 1;
  run('updateScrollProgress(); updateAutoJump(0)');
  window.scrollY = route.at(-1).scrollAt - 1;
  run('updateScrollProgress(); updateAutoJump(1000); updateAutoJump(1000)');
  assert.equal(state.autoIndex, teamIndex);
  assert.equal(state.autoLeap, null);

  state.scrollDriven = false;
  state.mode = 'section';
  run('startSectionJump(4); updateTravel(2000)');
  assert.equal(state.sectionIndex, 4, 'keyboard travel can reach the same footer endpoint without focusing a missing platform');
  assert.equal(window.scrollY, documentElement.scrollHeight - window.innerHeight);
  assert(parseFloat(scrollBear.style.top) >= window.innerHeight + 30);
  documentElement.scrollHeight += 300;
  run('syncScrollBear()');
  assert.equal(parseFloat(scrollBear.style.top), documentElement.scrollHeight + 31 - window.scrollY,
    'resizing recomputes the off-screen endpoint from the real footer');
  console.log(`ok ${width}px${reduced ? ' reduced motion' : ''}: footer drop, return, mid-jump reversal, keyboard landing, and resize`);
}
