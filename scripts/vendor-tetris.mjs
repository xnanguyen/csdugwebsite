import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// Input: the unmodified npm pack archive for tetris-engine@1.2.18.
const archive = process.argv[2];
if (!archive) throw new Error('Usage: node scripts/vendor-tetris.mjs <package.tgz>');
const files = ['tetra-shapes', 'shape', 'engine'];
const modules = files.map(name => {
  const source = execFileSync('tar', ['-xOf', archive, `package/dist/${name}.js`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  return `${JSON.stringify(`./${name}`)}: function(module, exports, require) {\n${source}\n}`;
});
mkdirSync('assets/js', { recursive: true });
writeFileSync('assets/js/tetris-engine.js', `/* tetris-engine 1.2.18 | ISC | petelinmn | See tetris-engine.LICENSE.txt */
(function(root) {
  const modules = {${modules.join(',\n')}};
  const cache = {};
  function require(id) {
    if (!cache[id]) {
      const module = cache[id] = { exports: {} };
      modules[id](module, module.exports, require);
    }
    return cache[id].exports;
  }
  root.TetrisEngine = require('./engine');
})(globalThis);
`);
