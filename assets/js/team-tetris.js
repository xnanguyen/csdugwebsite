(function(root) {
  // The upstream engine owns movement, rotation, locking, and line clearing.
  // Clones let the decorative autoplayer compare legal drops without changing the live game.
  function copyGame(game) {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(game)), game);
    copy._heap = game._heap.map(row => row.map(cell => ({ ...cell })));
    copy._shape = Object.assign(Object.create(Object.getPrototypeOf(game._shape)), game._shape);
    copy._shape.position = { ...game._shape.position };
    copy._nextShape = game._nextShape && Object.assign(Object.create(Object.getPrototypeOf(game._nextShape)), game._nextShape);
    if (copy._nextShape) copy._nextShape.position = { ...game._nextShape.position };
    copy._statistic = { ...game._statistic, countShapesFalledByType: { ...game._statistic.countShapesFalledByType } };
    copy._renderHandle = () => {};
    return copy;
  }

  function score(game, previousLines) {
    const board = game.state.body;
    const heights = Array(game.width).fill(0);
    let holes = 0;
    for (let x = 0; x < game.width; x++) {
      let filled = false;
      for (let y = 0; y < game.height; y++) {
        if (board[y][x].val === 2) {
          if (!filled) heights[x] = game.height - y;
          filled = true;
        } else if (filled) holes++;
      }
    }
    const bumpiness = heights.slice(1).reduce((sum, height, x) => sum + Math.abs(height - heights[x]), 0);
    return (game.state.statistic.countLinesReduced - previousLines) * 7
      - holes * 12 - heights.reduce((sum, height) => sum + height, 0) * .55
      - bumpiness * .35 - Math.max(...heights) * .8;
  }

  function candidates(game) {
    const choices = [];
    for (let rotation = 0; rotation < 4; rotation++) {
      const rotated = copyGame(game);
      const actions = [];
      for (let n = 0; n < rotation; n++) { rotated.rotate(); actions.push('rotate'); }
      for (let n = 0; n < game.width; n++) {
        const before = rotated._shape.position.X;
        rotated.moveLeft();
        if (before === rotated._shape.position.X) break;
        actions.push('moveLeft');
      }
      for (let column = 0; column < game.width; column++) {
        const trial = copyGame(rotated);
        const count = trial._statistic.countShapesFalled;
        const lines = trial._statistic.countLinesReduced;
        for (let n = 0; n < game.height + 6 && trial._statistic.countShapesFalled === count && trial._gameStatus === 1; n++) trial.moveDown();
        const value = trial._gameStatus === 3 ? -Infinity : score(trial, lines);
        if (Number.isFinite(value)) choices.push({ score: value, actions: actions.slice(), game: trial });
        const before = rotated._shape.position.X;
        rotated.moveRight();
        if (before === rotated._shape.position.X) break;
        actions.push('moveRight');
      }
    }
    return choices.sort((a, b) => b.score - a.score);
  }

  function plan(game) {
    const shortlist = candidates(game).slice(0, 4);
    let best = { score: -Infinity, actions: [] };
    // Consider the known next piece to avoid wells and a steadily growing stack.
    for (const choice of shortlist) {
      const next = candidates(choice.game)[0];
      const value = choice.score + (next ? next.score * .8 : -1000);
      if (value > best.score) best = { score: value, actions: choice.actions };
    }
    // Collapse the search's left-then-right walk into the actual destination.
    const rotations = best.actions.filter(action => action === 'rotate');
    const shift = best.actions.reduce((sum, action) => sum + (action === 'moveRight' ? 1 : action === 'moveLeft' ? -1 : 0), 0);
    return [...rotations, ...Array(Math.abs(shift)).fill(shift < 0 ? 'moveLeft' : 'moveRight')];
  }

  class TeamTetris {
    constructor({ cols = 10, rows = 22, seedPieces = 6 } = {}) {
      this.engine = new root.TetrisEngine(cols, rows, () => {});
      this.engine.start();
      this.actions = null;
      // Seed with actual legal placements, scaled to the building's window count.
      while (this.engine._statistic.countShapesFalled < seedPieces + 1 && this.engine._gameStatus === 1) this.step();
    }

    get state() { return this.engine.state; }

    step() {
      const game = this.engine;
      if (game.state.gameStatus === 3) return 'over';
      if (!this.actions) {
        this.actions = plan(game);
        for (let n = 0; n < 5 && !game.state.body.some(row => row.some(cell => cell.val === 1)); n++) game.moveDown();
      }
      const count = game.state.statistic.countShapesFalled;
      game[this.actions.length ? this.actions.shift() : 'moveDown']();
      if (game.state.statistic.countShapesFalled !== count) {
        this.actions = null;
        return 'locked';
      }
      return game.state.gameStatus === 3 ? 'over' : 'falling';
    }
  }
  root.TeamTetris = TeamTetris;
})(globalThis);
