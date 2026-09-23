import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const engineSource = readFileSync('assets/js/tetris-engine.js', 'utf8');
const playerSource = readFileSync('assets/js/team-tetris.js', 'utf8');
const inline = readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(inline);
const sceneSource = inline.slice(inline.indexOf('const teamScene ='), inline.indexOf('function drawNightSky()'));

function context(seed = 42) {
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const scope = vm.createContext({ Math: math, assert });
  vm.runInContext(engineSource + playerSource, scope);
  return scope;
}

vm.runInContext(`
  const heap = Array.from({length: 4}, () => [...Array(9).fill(1), 0]);
  const engine = new TetrisEngine(10, 22, () => {}, heap);
  engine._shapesSet = { IShape: engine._shapesSet.IShape };
  engine.start();
  const original = JSON.stringify(engine._shape.body);
  for (let n = 0; n < 4; n++) engine.rotate();
  assert.equal(JSON.stringify(engine._shape.body), original);
  engine.rotate();
  for (let n = 0; n < 20; n++) engine.moveRight();
  const right = engine._shape.position.X;
  engine.moveRight(); assert.equal(engine._shape.position.X, right);
  for (let n = 0; n < 28 && engine._statistic.countShapesFalled === 1; n++) engine.moveDown();
  assert.equal(engine.state.statistic.countLinesReduced, 4);
  assert.equal(engine.state.body.flat().filter(c => c.val === 2).length, 0);
`, context());
console.log('ok rotation, wall collision, gravity, and four-line clear');

for (const seed of [42, 8142, 2026]) {
  const scope = context(seed);
  vm.runInContext(`
    const game = new TeamTetris();
    const initial = game.state.body.flat().filter(c => c.val === 2).length;
    assert(initial <= 24, 'initial stack contains only six legal placements');
    let ticks = 0;
    while (game.state.statistic.countShapesFalled < 107 && ticks++ < 5000) {
      const before = game.state;
      const result = game.step();
      const state = game.state;
      assert.equal(state.gameStatus, 1, 'autoplayer survives the run');
      const locked = state.body.flat().filter(c => c.val === 2).length;
      const pieces = state.statistic.countShapesFalled - 1;
      assert.equal(locked, pieces * 4 - state.statistic.countLinesReduced * 10, 'no invented or missing blocks');
      assert(state.body.flat().filter(c => c.val === 1).length <= 4, 'one active tetromino');
      assert(!state.body.flat().some(c => c.cssClasses.includes('heap') && c.cssClasses.includes('shape')), 'no overlap');
      assert(!state.body.some(row => row.every(c => c.val === 2)), 'full lines clear');
      if (result === 'locked') {
        assert(before.body.some((row, y) => row.some((c, x) => c.val === 1 && (y === 21 || before.body[y + 1][x].val === 2))), 'pieces lock only on support');
      }
    }
    assert(game.state.statistic.countLinesReduced > 20, 'ongoing line clears keep the pile low');
    assert(ticks < 5000);
  `, scope);
  console.log(`ok seed ${seed}: 100 legal placements, conserved blocks, collisions, and row clears`);
}

vm.runInContext(`
  let game = new TeamTetris({ cols: 6, rows: 11, seedPieces: 3 });
  assert(game.state.body.flat().filter(c => c.val === 2).length <= 12);
  let clears = 0;
  for (let tick = 0; tick < 400; tick++) {
    const before = game.state;
    const result = game.step();
    const state = game.state;
    assert.equal(state.body.length, 11);
    assert(state.body.every(row => row.length === 6));
    if (result === 'over') {
      assert.equal(state.gameStatus, 3, 'reset only after a real top-out');
      clears += state.statistic.countLinesReduced;
      game = new TeamTetris({ cols: 6, rows: 11, seedPieces: 3 });
      continue;
    }
    const locked = state.body.flat().filter(c => c.val === 2).length;
    assert.equal(locked, (state.statistic.countShapesFalled - 1) * 4 - state.statistic.countLinesReduced * 6);
    assert(!state.body.some(row => row.every(c => c.val === 2)), 'complete window rows clear');
    assert(!state.body.flat().some(c => c.cssClasses.includes('heap') && c.cssClasses.includes('shape')), 'no window overlap');
    if (result === 'locked') {
      assert(before.body.some((row, y) => row.some((c, x) => c.val === 1 && (y === 10 || before.body[y + 1][x].val === 2))), 'pieces lock on support');
    }
  }
  assert(clears + game.state.statistic.countLinesReduced > 0);
`, context());
console.log('ok six-pane, eleven-floor board: legal placements, clears, and top-out resets');

for (const width of [320, 390, 640, 768, 1280, 1920, 2560]) {
  const scope = context();
  const height = width <= 640 ? 1670 : 1200;
  const visibleRects = [];
  const compositing = [];
  function paint(record = false, rects = []) {
    return {
      colors: new Set(),
      clearRect() { if (record) { visibleRects.length = 0; compositing.length = 0; } },
      drawImage(image) { if (record) compositing.push(image); },
      fillRect(...args) {
        assert(args.every(Number.isFinite));
        assert(args[2] >= 0 && args[3] >= 0);
        this.colors.add(this.fillStyle);
        if (record) visibleRects.push(args);
        else rects.push(args);
      }
    };
  }
  const visiblePaint = paint(true);
  const layer = {
    getBoundingClientRect: () => ({ width, height, top: 0, bottom: height }),
    getContext: () => visiblePaint,
    parentElement: { querySelector: selector => ({ getBoundingClientRect: () => selector === '.section-header' ? { bottom: 320 } : { top: 730, bottom: 880 } }) }
  };
  Object.assign(scope, {
    document: {
      getElementById: () => layer,
      createElement: () => {
        const rects = [], context = paint(false, rects);
        return { rects, getContext: () => context };
      }
    },
    cloudTime: 0, innerHeight: 2000, prefersReduced: true
  });
  vm.runInContext(sceneSource + `
    setupTeamScene();
    const {x, y, pitchX, pitchY, paneWidth, paneHeight, rows, cols} = teamScene.grid;
    assert([x, y, pitchX, pitchY, paneWidth, paneHeight].every(Number.isInteger));
    assert.equal(rows, 11, 'one window row per floor');
    assert.equal(cols, 6);
    assert(paneWidth > 0 && paneWidth < pitchX && paneHeight > 0 && paneHeight < pitchY);
    assert(x >= 0 && y >= 0 && x + pitchX * cols <= teamScene.layer.width && y + pitchY * rows <= teamScene.layer.height);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        assert(teamScene.base.rects.some(rect => rect[0] === x + col * pitchX && rect[1] === y + row * pitchY && rect[2] === paneWidth && rect[3] === paneHeight), 'each game cell maps to one complete physical pane');
      }
    }
    const before = JSON.stringify(teamScene.game.state);
    cloudTime += 20; drawTeamScene();
    assert.equal(JSON.stringify(teamScene.game.state), before, 'reduced motion freezes the game');
    const game = teamScene.game;
    setupTeamScene();
    assert.equal(teamScene.game, game, 'resize preserves the game');
  `, scope);
  assert(visibleRects.length > 0);
  assert.equal(visibleRects.length % 3, 0);
  const grid = vm.runInContext('teamScene.grid', scope);
  for (let n = 0; n < visibleRects.length; n += 3) {
    const [x, y, w, h] = visibleRects[n];
    assert.equal(w, grid.paneWidth, 'every illuminated cell fills the pane width');
    assert.equal(h, grid.paneHeight, 'every illuminated cell fills the pane height');
    assert.equal((x - grid.x) % grid.pitchX, 0, 'light aligned to a window column');
    assert.equal((y - grid.y) % grid.pitchY, 0, 'light aligned to a window floor');
    assert(x >= grid.x && x < grid.x + grid.cols * grid.pitchX);
    assert(y >= grid.y && y < grid.y + grid.rows * grid.pitchY);
    assert([x, y, w, h].every(Number.isInteger), 'no fractional block edges');
    assert.deepEqual(visibleRects[n + 1], [x + w - 1, y, 1, h], 'right divider stays inside the cell');
    assert.deepEqual(visibleRects[n + 2], [x, y + h - 1, w - 1, 1], 'bottom divider stays inside the cell');
  }
  const foreground = vm.runInContext('teamScene.foreground', scope);
  assert.equal(compositing.at(-1), foreground, 'planting is in front of the tower');
  assert(foreground.rects.length > 0);
  assert.deepEqual([...foreground.getContext().colors].sort(), ['#55798f', '#647f9e'], 'bushes use only two existing skyline tones');
  if (width > 640) {
    assert(vm.runInContext('teamScene.ground * 2', scope) >= 1024, 'the horizon stays at least 144px below the cards');
  }
  const plantingColumns = new Map();
  const ground = Math.max(...foreground.rects.map(([, y, , h]) => y + h));
  for (const [x, y, w, h] of foreground.rects) {
    if (!w || !h) continue;
    assert(x >= 0 && x + w <= foreground.width, 'all planting stays inside the scene');
    assert(x + w <= grid.x || x >= grid.x + grid.cols * grid.pitchX || y + h <= grid.y || y >= grid.y + grid.rows * grid.pitchY, 'foliage never covers Tetris cells');
    assert([x, y, w, h].every(Number.isInteger), 'foliage stays on the pixel grid');
    for (let col = x; col < x + w; col++) {
      if (!plantingColumns.has(col)) plantingColumns.set(col, []);
      plantingColumns.get(col).push([y, y + h]);
    }
  }
  for (const intervals of plantingColumns.values()) {
    intervals.sort((a, b) => a[0] - b[0]);
    let end = intervals[0][1];
    for (const [top, bottom] of intervals) {
      assert(top <= end, 'bushes have no floating crowns or gaps beneath foliage');
      end = Math.max(end, bottom);
    }
    assert.equal(end, ground, 'every foliage column is grounded');
  }
  assert(plantingColumns.has(0) && plantingColumns.has(foreground.width - 1), 'bush beds reach both scene edges');
  assert(plantingColumns.size > foreground.width * .65, 'planting stretches across most of the scene');
  assert(!plantingColumns.has(Math.floor(grid.x + grid.cols * grid.pitchX / 2)), 'the library entrance remains open');
  console.log(`ok ${width}px: whole-pane lights, inset dividers, connected bushes, foreground clearance, bounds, resize, and reduced motion`);
}
