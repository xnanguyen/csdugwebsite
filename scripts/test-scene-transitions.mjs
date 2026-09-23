import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
assert.match(html, /\.nav-links a \{[^}]*border: 0;[^}]*text-decoration: none;/,
  'navigation links have no underline or bottom border');
assert.match(html, /\.nav-links a:hover,\s*\.nav-links a:focus-visible \{[^}]*color: #fff0b3;[^}]*text-decoration: none;/,
  'navigation uses the existing pale yellow on hover and keyboard focus');
assert.match(html, /\.resources-atmosphere \{[^}]*opacity: 1;[^}]*filter: url\("#night-cloud-colors"\);/,
  'background clouds use solid, muted colors rather than a translucent layer');
assert.match(html, /\.cit-clouds \{[^}]*z-index: 1;[^}]*opacity: 1;[^}]*filter: url\("#night-cloud-colors"\);/,
  'foreground clouds keep the same muted palette without showing the building through');
assert.match(html, /<feFuncA type="discrete" tableValues="0 1"\/>/,
  'cloud interiors are opaque and the translucent image halos are removed');
assert.match(html, /<feColorMatrix type="matrix" values="\.4 0 0 0 \.20  0 \.4 0 0 \.23  0 0 \.4 0 \.30  0 0 0 1 0"\/>/,
  'cloud colors stay in the muted blue-lilac palette without reducing alpha');
assert.match(html, /\.cit-clouds::before, \.cit-clouds::after \{[^}]*width: 108%;/, 'cloud banks reach across the central gap at the CIT base');
assert.match(html, /\.cit-clouds \{[^}]*center 125%/, 'the central bank sits lower against the building base');
assert(html.indexOf('class="cit-clouds"') > html.indexOf('class="cit-building"'), 'clouds overlay the building, not only its background');
assert.match(html, /\.cit-clouds::after \{[^}]*right: 0;[^}]*scaleX\(-1\)/, 'both sides overlap across the building base');
assert.match(html, /\.resources-atmosphere::after \{[^}]*right: 0;[^}]*bottom: 0;[^}]*night-cloud-banks\.png[^}]*transform: scaleX\(-1\);/, 'a matching cloud bank fills the lower right');
assert.match(html, /\.resources-atmosphere::after \{[^}]*mask-image: linear-gradient\([^;]*transparent\);/, 'the added bank fades without a hard edge');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const aboutSource = inline.slice(inline.indexOf('function dissolveSceneBottom('), inline.indexOf('function createHomeCloudLayout('));
const citySource = inline.slice(inline.indexOf('const cityScene ='), inline.indexOf('const teamScene ='));

function canvas() {
  const rects = [], images = [];
  const paint = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    clearRect() {},
    fillRect(x, y, width, height) {
      assert([x, y, width, height].every(Number.isFinite));
      assert(width >= 0 && height >= 0);
      rects.push({ x, y, width, height, alpha: this.globalAlpha, mode: this.globalCompositeOperation });
    },
    drawImage(...args) { images.push(args); }
  };
  return { width: 0, height: 0, rects, images, getContext: () => paint };
}

function checkDissolve(surface) {
  const rows = surface.rects.filter(rect => rect.mode === 'destination-out');
  assert(rows.length > 0);
  assert.equal(rows.at(-1).y, surface.height - 1);
  assert.equal(rows.at(-1).alpha, 1, 'artwork is fully transparent before its canvas edge');
  assert(rows.every((row, i) => row.alpha >= 0 && row.alpha <= 1 && (!i || row.alpha >= rows[i - 1].alpha)));
  assert.equal(surface.getContext().globalCompositeOperation, 'source-over');
  assert.equal(surface.getContext().globalAlpha, 1);
}

for (const width of [390, 1280, 1920]) {
  const sectionHeight = width < 640 ? 980 : 805;
  const forest = canvas();
  forest.parentElement = { getBoundingClientRect: () => ({ width, height: sectionHeight }) };
  const scope = vm.createContext({
    document: { getElementById: () => forest, createElement: canvas },
    aboutStatue: { complete: true, naturalWidth: 992, naturalHeight: 1586 }
  });
  vm.runInContext(aboutSource + '\ndrawAboutScene();', scope);
  assert.equal(forest.height, Math.ceil((sectionHeight + 120) / 3), 'forest overlaps the next section');
  checkDissolve(forest);
  const [statue, , y] = forest.images.at(-1);
  checkDissolve(statue);
  assert(y + statue.height < sectionHeight / 3, 'the pedestal is not cropped at the section boundary');
  assert(statue.rects[0].y >= statue.height * .78, 'only the pedestal dissolves, not the statue');

  const sceneHeight = width <= 640 ? 420 : Math.min(680, Math.max(480, width * .45));
  const buildingHeight = Math.min(760, width * (width <= 640 ? .84 : .66)) * 2 / 3;
  const buildingBottom = sceneHeight - 80;
  const groundPx = buildingBottom - buildingHeight * .06;
  const city = canvas(), styles = new Map();
  city.getBoundingClientRect = () => ({ width, height: sceneHeight, top: 0, bottom: sceneHeight });
  city.parentElement = {
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: buildingBottom, height: buildingHeight }) }),
    style: { setProperty: (key, value) => styles.set(key, value) }
  };
  const cityScope = vm.createContext({
    document: { getElementById: () => city, createElement: canvas },
    cloudTime: 0, innerHeight: 1000, prefersReduced: true
  });
  vm.runInContext(citySource + '\nsetupCityBackdrop();', cityScope);
  assert.equal(styles.get('--cit-ground'), `${groundPx}px`, 'CIT and skyline share one CSS fade');
  assert.equal(styles.get('--cit-fade'), `${Math.min(150, buildingHeight * .3)}px`, 'the fade scales with the building on mobile');
  const ground = Math.floor(groundPx * city.height / sceneHeight);
  const base = vm.runInContext('cityScene.base', cityScope);
  assert(base.rects.every(rect => rect.y + rect.height <= ground), 'no distant building extends below CIT');
  const maxBuildingHeight = Math.max(...base.rects.map(rect => rect.height));
  assert(maxBuildingHeight < buildingHeight * city.height / sceneHeight * .6, 'distant skyline stays smaller than CIT');
  const lights = vm.runInContext('cityScene.windows', cityScope);
  assert(lights.every(light => light.y + 2 <= ground), 'no floating windows below the shared horizon');
  console.log(`ok ${width}px: pedestal fade, forest overlap, shared CIT horizon, and shorter skyline`);
}
