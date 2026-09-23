import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
assert.match(html, /\.section-platform:focus-visible\s*\{\s*outline: none;/,
  'landing platforms remain borderless when keyboard jumps focus them');
assert(!html.includes('.moon-platform:focus-visible'),
  'the moon must not override the borderless landing style with a circular outline');
const start = html.indexOf('function drawSkyScene(');
const palette = html.slice(html.indexOf('const eventArt ='), start);
const source = palette + html.slice(start, html.indexOf('\n    function ', start + 1));
const skiesStart = html.indexOf('function drawSkies(');
const skies = html.slice(skiesStart, html.indexOf('function resizeCanvas(', skiesStart));
const moonDraw = skies.indexOf('drawSkyScene(document.getElementById("eventsSky"), true)');
assert(moonDraw > skies.indexOf('blendSkyBoundary(document.getElementById("eventsSky")'),
  'moon is drawn above the sky-transition tint so its details stay clear');
assert(skies.indexOf('drawEventAtmosphere(document.getElementById("eventsSky"), true)') > moonDraw,
  'a light foreground veil still connects the moon to the clouds');
assert(skies.indexOf('syncScrollBear();') > skies.indexOf('drawSkyScene('),
  'the bear realigns after responsive moon artwork is redrawn');

for (const width of [320, 390, 768, 1179, 1180, 1280, 1920]) {
  const height = 1200, sectionTop = 720;
  const elements = new Map();
  const rects = [];
  const paint = { globalAlpha: 1, fillRect(x, y, w, h) {
    assert([x, y, w, h].every(Number.isFinite));
    if (['#b8a2bc', '#c6afc5', '#d7bfce', '#e6ced7'].includes(this.fillStyle)) {
      assert.equal(this.globalAlpha, 1, 'moon remains opaque against the dusk clouds');
      rects.push({ x, y });
    }
  } };
  const sky = {
    width: Math.ceil(width / 2), height: height / 2,
    parentElement: {
      clientWidth: width, clientHeight: height, offsetTop: sectionTop,
      getBoundingClientRect: () => ({ top: sectionTop })
    },
    getContext: () => paint
  };
  const scope = vm.createContext({ sky, document: { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, { style: {} });
    return elements.get(selector);
  } } });
  vm.runInContext(source + '\ndrawSkyScene(sky, true);', scope);
  const platform = elements.get('.moon-platform').style;
  const moonTop = parseFloat(platform.top) * height / 100;
  const diameter = parseFloat(platform.width) * width / 100;
  assert(diameter <= (width < 1180 ? 90 : 130));
  assert(Math.abs(moonTop - Math.min(...rects.map(rect => rect.y)) * 2) < .001,
    'landing point matches the first visible row of the moon');
  assert.equal(moonTop, width < 1180 ? 112 : 40, 'moon is raised above the heading');
  assert(moonTop + 120 - 89 >= 70, 'anchor scroll leaves room for the bear below navigation');
  assert(!html.includes('class="moon-cloud'), 'no separate cloud pedestal images');
  const atmosphereStart = html.indexOf('function drawEventAtmosphere(');
  const atmosphere = html.slice(atmosphereStart, html.indexOf('function createCloudSprite', atmosphereStart));
  const clouds = [];
  paint.fillRect = () => assert.fail('cloud atmosphere must not draw horizontal ribbons beside the moon');
  scope.duskCloud = { complete: true, naturalWidth: 1983, naturalHeight: 793 };
  paint.drawImage = (image, sx, sy, sw, sh, x, y, w, h) => {
    assert([sx, sy, sw, sh, x, y, w, h].every(Number.isFinite));
    assert(w > 0 && h > 0 && sw > 0 && sh > 0);
    assert(sx >= 0 && sy >= 0 && sx + sw <= image.naturalWidth + 1 && sy + sh <= image.naturalHeight + 1);
    clouds.push({ x, y, w, h, opacity: paint.globalAlpha });
  };
  vm.runInContext(atmosphere + '\ndrawEventAtmosphere(sky);', scope);
  assert.equal(clouds.length, 8, 'distant, middle, and low cloud banks add depth');
  assert(clouds.filter(cloud => cloud.y < sky.height * .2).length >= 5, 'upper sky includes several cloud layers');
  assert(new Set(clouds.map(cloud => cloud.opacity)).size >= 5, 'layers have distinct atmospheric depth');
  vm.runInContext('drawEventAtmosphere(sky, true);', scope);
  assert.equal(clouds.length, 9, 'foreground veil links the moon to the wider sky');
  const veil = clouds.at(-1);
  assert.equal(veil.opacity, .16, 'foreground haze is subtle enough to preserve lunar detail');
  const moonX = (parseFloat(platform.left) + parseFloat(platform.width) / 2) * sky.width / 100;
  assert(veil.x < moonX && veil.x + veil.w > moonX, 'veil crosses the moon horizontally');
  assert(veil.y > moonTop / 2 + diameter / 4, 'clouds leave the upper half and landing edge clear');
  assert.equal(paint.globalAlpha, 1);
  console.log(`ok ${width}px: higher moon landing, nine cloud layers, foreground veil, responsive placement`);
}
