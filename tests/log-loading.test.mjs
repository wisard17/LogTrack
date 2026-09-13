import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';

const output = await build({
  entryPoints: ['src/hooks/useLogs.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'controlled-hooks', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'mock' }));
    build.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'react'
      ? 'export const useState = (...a) => globalThis.logHarness.useState(...a); export const useEffect = (...a) => globalThis.logHarness.useEffect(...a);'
      : 'export const getLogsFromPostgres = (...a) => globalThis.logHarness.fetch(...a);' }));
  } }],
});
const compiled = new Module(path.resolve('tests/log-loading.cjs'));
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(process.cwd());
compiled._compile(output.outputFiles[0].text, compiled.filename);

test('slow responses survive polling and rerenders; previous MK responses are ignored', async () => {
  const originalSet = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  let tick;
  globalThis.setInterval = callback => { tick = callback; return 1; };
  globalThis.clearInterval = () => {};
  let state, deps, cleanup;
  const pending = [];
  globalThis.logHarness = {
    useState(initial) { state ??= initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; },
    useEffect(callback, next) {
      if (!deps || next.some((value, i) => value !== deps[i])) { cleanup?.(); deps = next; cleanup = callback(); }
    },
    fetch(course) { return new Promise((resolve, reject) => pending.push({ course, resolve, reject })); },
  };
  const render = course => compiled.exports.useLogs({ uid: 'admin' }, true, true, 0, course);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(render('mk1').loading, true);
    tick(); tick(); render('mk1');
    assert.equal(pending.length, 1, 'No overlapping request or invalidation while the response is pending');
    pending[0].resolve([{ id: 'old', courseId: 'mk1', weekNumber: 1 }]); await flush();
    assert.equal(render('mk1').logs.length, 1);
    tick();
    assert.equal(render('mk2').loading, true);
    pending[1].resolve([{ id: 'stale', courseId: 'mk1', weekNumber: 2 }]); await flush();
    assert.equal(render('mk2').logs.length, 0);
    pending[2].resolve([{ id: 'new', courseId: 'mk2', weekNumber: 1 }]); await flush();
    assert.equal(render('mk2').logs[0].id, 'new');
    render('mk3'); pending[3].reject(new Error('offline')); await flush();
    assert.equal(render('mk3').loading, false);
    assert.ok(render('mk3').error);
  } finally {
    cleanup?.(); globalThis.setInterval = originalSet; globalThis.clearInterval = originalClear;
    delete globalThis.logHarness;
  }
});
