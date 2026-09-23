import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
assert(!html.includes('id="score"') && !html.includes('scoreEl') && !html.includes('state.score'), 'score display and updates are removed without leaving stale DOM references');
const start = html.indexOf('function resetGame(');
const source = html.slice(start, html.indexOf('function drawAscii(', start));
for (const width of [280, 390, 600, 900]) {
  const height = width < 400 ? 320 : 420;
  const state = { width, height, barWidth: Math.min(144, (width - 36) / 3.65),
    current: 2, bear: { w: 54, h: 89 } };
  const scope = vm.createContext({ state,
    document: { getElementById: () => ({ getBoundingClientRect: () => ({ width, height: 900, top: 0 }) }) },
    canvas: { getBoundingClientRect: () => ({ top: 150 }) },
    campusSkylineTop: () => 550,
    faceTarget() {}
  });
  vm.runInContext(source + '\nresetGame(false);', scope);
  assert.equal(state.platforms.length, 2, 'middle home bar removed');
  assert.equal(state.current, 1, 'resize cannot retain a removed platform index');
  const [first, last] = state.platforms;
  assert(last.x > first.x && last.y > first.y + 60, 'remaining right bar is a descending jump');
  assert(last.y + 17 <= height - 28, 'landing stays inside the game canvas');
  assert.equal(state.bear.y + state.bear.h, last.y);
  vm.runInContext('resetGame();', scope);
  assert.equal(state.current, 0);
  console.log(`ok ${width}px: two home platforms, downward jump, safe resize and reset`);
}

const sections = Object.fromEntries(['events', 'about', 'resources', 'team', 'contact'].map(id => {
  const start = html.indexOf(`<section class="section" id="${id}">`);
  return [id, html.slice(start, html.indexOf('</section>', start))];
}));
assert.equal((sections.events.match(/class="section-platform/g) || []).length, 2);
assert(sections.about.indexOf('about-entry') < sections.about.indexOf('folder-platform'));
assert.equal((sections.resources.match(/class="section-platform/g) || []).length, 2);
assert(sections.resources.indexOf('resource-upper') < sections.resources.indexOf('resource-lower'));
assert(!sections.contact.includes('section-platform'), 'footer has no landing or restart bar');
assert.match(sections.team, /<span class="section-platform team-stop" aria-hidden="true"><\/span>/, 'Team is a non-interactive final landing');
assert.match(html, /#team \.team-stop \{ margin-top: 32px;/, 'Team landing is lower');

const routeSections = ['events', 'about', 'resources', 'team', 'contact'].map((id, index) => ({
  id, querySelectorAll: () => Array(id === 'contact' ? 0 : 1).fill({}),
  getBoundingClientRect: () => ({ top: 1000 + index * 900 })
}));
const extract = (begin, end) => html.slice(html.indexOf(begin), html.indexOf(end, html.indexOf(begin)));
const endpointState = { mode: 'scroll', scrollDriven: true, autoIndex: 5, autoDesired: 5, platforms: [{}, {}] };
const endpoint = vm.createContext({
  sections: routeSections, state: endpointState,
  window: { innerHeight: 720, scrollY: 0 },
  document: { getElementById: () => ({ offsetHeight: 900 }), documentElement: { scrollHeight: 6200 } },
  landingPoint: (sectionIndex, barIndex) => ({ x: 100, y: sectionIndex < 0 ? 100 + barIndex * 200 : 1100 + sectionIndex * 900 }),
  scrollBear: { classList: { remove() {} } }, positionFollower() {}
});
vm.runInContext(extract('function landingSectionIndex(', 'document.querySelectorAll(\'.site-nav'), endpoint);
assert.equal(vm.runInContext('landingSectionIndex("contact")', endpoint), 3, 'Contact navigation and deep links retain the Team landing');
assert.equal(vm.runInContext('landingSectionIndex("top")', endpoint), -1);
vm.runInContext(extract('function scrollRoute()', 'function updateScrollProgress()'), endpoint);
const route = vm.runInContext('scrollRoute()', endpoint);
assert.equal(route.at(-1).sectionIndex, 3, 'scrolling ends at Team');
vm.runInContext(extract('function startAutoJump(', 'function updateAutoJump('), endpoint);
vm.runInContext('startAutoJump();', endpoint);
assert.equal(endpointState.scrollTarget, null, 'the last landing has no next destination');
vm.runInContext(extract('function jump()', 'function update(delta)'), endpoint);
vm.runInContext('jump();', endpoint);
assert.equal(endpointState.scrollDriven, true, 'Space at the route end leaves the standing bear alone');
vm.runInContext(extract('function startSectionJump(', 'function updateTravel('), endpoint);
vm.runInContext('startSectionJump(4); startSectionJump(5);', endpoint);
assert.equal(endpointState.mode, 'scroll', 'missing footer landings cannot start travel or reset the game');
console.log('ok route order: Events -> lower About entry -> folders -> Resources left -> right -> Team');
