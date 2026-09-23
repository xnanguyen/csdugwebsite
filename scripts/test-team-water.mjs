import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const source = html.slice(html.indexOf('function drawTeamWater()'), html.indexOf('function drawSkies()'));
assert.match(html, /#contact \{[^}]*padding: 18px 18px 10px;/, 'contact stays compact');
assert(!html.includes('contactClouds'), 'the footer continues the water instead of a separate star scene');

for (const width of [390, 1280, 1920]) {
  const compact = width <= 640, styles = {}, fills = [], images = [], sources = [];
  const paint = {
    fillRect(x, y, w, h) {
      assert([x, y, w, h].every(Number.isFinite));
      fills.push({ x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha });
    },
    drawImage(...args) { images.push({ args, alpha: this.globalAlpha }); }
  };
  const water = {
    style: styles, getContext: () => paint,
    parentElement: { getBoundingClientRect: () => ({ top: 0, bottom: 4200, width }) }
  };
  const ground = 500 + (width === 1920 ? .75 : width === 390 ? .25 : 0);
  const shoreline = Math.round(ground);
  const scene = {
    ground, towerHeight: 320, backdrop: {}, base: {}, foreground: {},
    layer: { width: Math.ceil(width / 2), height: 600, getBoundingClientRect: () => ({ top: 2800, bottom: 4000, height: 1200 }) }
  };
  const scope = vm.createContext({ teamScene: scene, document: {
    getElementById: () => water,
    createElement: () => ({ getContext: () => ({ drawImage: image => sources.push(image) }) })
  } });
  vm.runInContext(source + '\ndrawTeamWater();', scope);
  const top = compact ? 3880 : 2800 + shoreline * 2;
  assert.equal(styles.top, `${top}px`);
  assert.equal(styles.height, `${4200 - top}px`, 'reflection continues to the end of Contact');
  assert.deepEqual(sources, [scene.backdrop, scene.base, scene.foreground], 'reflection uses the real city and foliage');
  const background = fills.filter(fill => fill.w === water.width);
  assert.equal(background.length, water.height);
  assert.equal(background[0].alpha, compact ? 0 : 1,
    'the desktop river is opaque at the shoreline so the dark underlying sky cannot show through');
  assert.equal(background.at(-1).color, 'rgb(8,15,34)', 'last water row exactly matches the copyright footer');
  const middleColor = background[Math.floor(background.length / 2)].color.match(/\d+/g).map(Number);
  assert(middleColor[0] >= 63 && middleColor[1] >= 91 && middleColor[2] >= 126,
    'the river remains a lighter clear blue before blending into the footer');
  assert(images.length > 0);
  assert(images.every(({ args: [, x, y, w, h], alpha }) => y >= 0 && y < ground && h === 1 && x === 0 && w === scene.layer.width && alpha <= 1));
  assert.equal(images[0].alpha, compact ? 0 : 1,
    'the first reflection row matches the unmodified land above instead of creating a shadow line');
  assert(images.filter(({ args }) => args[6] >= 16).every(({ alpha }) => alpha <= (compact ? .26 : .38)),
    'the shoreline softens into the same pale reflection after the short transition');
  assert(Math.max(...images.map(image => image.alpha)) > (compact ? .18 : .26), 'the pale reflection remains visible near the riverbank');
  assert(images[Math.floor(images.length / 2)].alpha > (compact ? .08 : .11), 'building silhouettes fade gradually through the river');
  assert(images.every(({ args }) => args[2] === shoreline - 1 - args[6]),
    'each reflected row is the same distance below the bank as its source above: no vertical squeezing');
  assert(images.every(({ args }) => args[5] === 0 && args[7] === args[3]),
    'still-water reflection keeps building positions and widths unchanged');
  assert(images.at(-1).alpha < Math.max(...images.map(image => image.alpha)), 'reflections fade toward the footer after the mobile fade-in');
  assert.equal(paint.globalAlpha, 1);
  console.log(`ok ${width}px: one-to-one still-water reflection, pale clear river, compact footer, seamless bottom color`);
}
