import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const blend = extract('function blendSkyBoundary(', 'const cityScene =');
const dither = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
let reads = 0;
function canvas(width = 64, height = 80, displayHeight = 320) {
  let saved;
  const surface = { width, height, images: [], getBoundingClientRect: () => ({ height: displayHeight }) };
  const paint = {
    globalAlpha: .4, globalCompositeOperation: 'source-over',
    getImageData() {
      reads++;
      throw new DOMException('Canvas readback is blocked', 'SecurityError');
    },
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: pixels => { surface.pixels = pixels; },
    drawImage: (...args) => { surface.images.push(args); },
    save() { saved = { globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }; },
    restore() { Object.assign(this, saved); }
  };
  surface.getContext = () => paint;
  return surface;
}

for (const atTop of [false, true]) for (const depthPx of [1, 80, 220, 1000]) {
  const sky = canvas();
  const boundary = [184, 137, 157];
  const context = vm.createContext({ sky, atTop, boundary, depthPx, document: { createElement: () => canvas() } });
  vm.runInContext(blend + '\nblendSkyBoundary(sky, atTop, boundary, depthPx);', context);
  const [tint, x, y] = sky.images[0];
  const depth = Math.max(1, Math.min(sky.height, Math.ceil(depthPx * sky.height / 320)));
  assert.equal(x, 0);
  assert.equal(y, atTop ? 0 : sky.height - depth);
  assert.equal(tint.height, depth);
  for (let row = 0; row < depth; row++) {
    const sourceY = atTop ? row : sky.height - 1 - row;
    const progress = depth === 1 ? 1 : 1 - row / (depth - 1);
    const value = progress * progress * (3 - 2 * progress) * 32;
    for (let x = 0; x < sky.width; x++) {
      const mix = Math.min(32, Math.floor(value) + (value % 1 > (dither[sourceY % 4][x % 4] + .5) / 16 ? 1 : 0)) / 32;
      const offset = ((atTop ? row : depth - 1 - row) * sky.width + x) * 4;
      assert.deepEqual([...tint.pixels.data.slice(offset, offset + 3)], boundary);
      const alpha = tint.pixels.data[offset + 3] / 255;
      for (const [channel, base] of [51, 121, 211].entries()) {
        const oldColor = Math.round(base * (1 - mix) + boundary[channel] * mix);
        const newColor = Math.round(base * (1 - alpha) + boundary[channel] * alpha);
        assert(Math.abs(newColor - oldColor) <= 1, 'compositing preserves the original palette and dither within one color level');
      }
    }
  }
  assert.equal(sky.getContext().globalAlpha, .4, 'drawing state is restored');
}

const painted = [];
const sky = canvas();
const context = vm.createContext({
  document: { getElementById: () => sky, createElement: () => canvas() },
  drawPixelSky() {}, drawSkyScene() {}, drawEventAtmosphere() {}, drawCampus() {},
  drawNightSky: () => painted.push('night'), drawAboutScene: () => painted.push('about'),
  setupCityBackdrop: () => painted.push('CIT'), setupTeamScene: () => painted.push('SciLi'),
  drawTeamWater: () => painted.push('river'), setupClouds() {}, drawFloatingClouds() {}, syncScrollBear() {},
  cloudScenes: []
});
sky.parentElement = { getBoundingClientRect: () => ({ width: 1280, height: 900 }) };
vm.runInContext(blend + extract('function drawSkies()', 'function resizeCanvas()') + '\ndrawSkies();', context);
assert.deepEqual(painted, ['night', 'about', 'CIT', 'SciLi', 'river'], 'blocked pixel readback cannot interrupt later scenery initialization');
assert.equal(reads, 0, 'no canvas pixel readback is needed');
console.log('ok restricted-canvas rendering, full scenery initialization, unchanged sky tint, and one-pixel transitions');
