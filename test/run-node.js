/**
 * Запуск тестов в терминале:  node test/run-node.js  (или npm test)
 *
 * Исходники игры — обычные браузерные скрипты, поэтому выполняем их в песочнице vm,
 * где window — это сам глобальный объект. Тесты, которым нужен WebGL
 * (describe.browser), здесь пропускаются — их гоняет test/index.html.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const root = path.resolve(__dirname, '..');
const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, performance };
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(relative) {
  const file = path.join(root, relative);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}

load('test/manifest.js');
const manifest = sandbox.GK_TEST_MANIFEST;
load('test/lib/gk-test.js');
load('test/lib/fakes.js');
manifest.sources.forEach(load);
manifest.specs.forEach((spec) => load(path.join('test', spec)));

const colors = process.stdout.isTTY
  ? { green: '\x1b[32m', red: '\x1b[31m', gray: '\x1b[90m', reset: '\x1b[0m' }
  : { green: '', red: '', gray: '', reset: '' };

sandbox.GKTest.run({ env: 'node' }).then((results) => {
  results.forEach((r) => {
    if (r.status === 'pass') console.log(colors.green + '  ✓ ' + colors.reset + r.name + colors.gray + ' (' + r.ms + ' мс)' + colors.reset);
    else if (r.status === 'skip') console.log(colors.gray + '  – ' + r.name + ' (только в браузере)' + colors.reset);
    else {
      console.log(colors.red + '  ✗ ' + r.name + colors.reset);
      console.log(colors.red + '    ' + r.error.message + colors.reset);
      String(r.error.stack || '').split('\n').slice(1, 3).forEach((line) => console.log(colors.gray + '  ' + line + colors.reset));
    }
  });
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log('');
  console.log('Прошло: ' + count('pass') + ', упало: ' + count('fail') + ', пропущено: ' + count('skip'));
  process.exitCode = count('fail') ? 1 : 0;
});
