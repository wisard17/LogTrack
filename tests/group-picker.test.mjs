import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';

const output = await build({
  entryPoints: ['src/components/student/GroupPicker.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'picker-harness', setup(build) {
    build.onResolve({ filter: /^(react|sonner)$|services\/api$|@\/components\/ui\// }, args => ({ path: args.path, namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path: name }) => ({ contents:
      name === 'react' ? 'export const useState = (...args) => globalThis.pickerHarness.useState(...args); export const useEffect = (...args) => globalThis.pickerHarness.useEffect(...args);' :
      name === 'sonner' ? 'export const toast = { success() {}, error() {} };' :
      name.endsWith('/api') ? 'export const getGroupSelection = () => globalThis.pickerHarness.status(); export const selectStudentGroup = (...args) => globalThis.pickerHarness.join(...args);' :
      'export const Button="button", Dialog="dialog", DialogContent="section", DialogHeader="header", DialogTitle="h2", DialogDescription="p";'
    }));
  } }],
});
const compiled = new Module(path.resolve('tests/group-picker.cjs'));
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(process.cwd());
compiled._compile(output.outputFiles[0].text, compiled.filename);

function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  for (const child of [element.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

test('successful join hides the notice immediately before group polling catches up', async () => {
  const previousSet = globalThis.setInterval, previousClear = globalThis.clearInterval;
  globalThis.setInterval = () => 1;
  globalThis.clearInterval = () => {};
  const state = [], cleanup = [];
  let cursor = 0, mounted = false, refreshCount = 0, rejectJoin = true;
  const group = { id: 'g1', courseId: 'mk1', name: 'Kelompok 1', members: [] };
  globalThis.pickerHarness = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect(effect) { if (!mounted) cleanup.push(effect()); },
    async status() { return { is_open: true, deadline: new Date(Date.now() + 60000).toISOString(), server_now: new Date().toISOString() }; },
    async join(...args) {
      assert.deepEqual(args, ['mk1', 'student', 'g1']);
      if (rejectJoin) throw new Error('Network error');
      return { mahasiswa_id: 'student', matakuliah_id: 'mk1', grup_id: 'g1' };
    },
  };
  const render = () => {
    cursor = 0;
    const result = compiled.exports.GroupPicker({ courseId: 'mk1', studentId: 'student', groups: [group], onChanged: () => refreshCount++ });
    mounted = true;
    return result;
  };
  try {
    render();
    await new Promise(resolve => setImmediate(resolve));
    let tree = render();
    assert.equal(find(tree, item => item.props?.children === 'Pilih Kelompok' && item.type === 'button').props.disabled, false);
    find(tree, item => item.type === 'select').props.onChange({ target: { value: 'g1' } });
    tree = render();
    await find(tree, item => item.props?.children === 'Gabung Kelompok').props.onClick();
    assert.notEqual(render(), null, 'A failed join must leave the picker available');
    rejectJoin = false;
    await find(render(), item => item.props?.children === 'Gabung Kelompok').props.onClick();
    assert.equal(refreshCount, 1);
    assert.equal(render(), null, 'Hide immediately even while groups still contains no membership');
  } finally {
    cleanup.forEach(dispose => dispose?.());
    globalThis.setInterval = previousSet; globalThis.clearInterval = previousClear;
    delete globalThis.pickerHarness;
  }
});
