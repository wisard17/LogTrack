import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';

// Bundle the actual UI, replacing only Firebase login (no real account needed).
const bundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { Navbar } from './src/components/layout/Navbar';
      import { StudentDashboard } from './src/components/student/StudentDashboard';
      export * from './src/services/api';
      export const navbar = props => renderToStaticMarkup(React.createElement(Navbar, props));
      export const dashboard = props => renderToStaticMarkup(React.createElement(StudentDashboard, props));
    `,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'firebase-login-stub', setup(build) {
    build.onResolve({ filter: /\/firebase$/ }, () => ({ path: 'firebase', namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const logout = async () => {};' }));
  } }],
});
const compiled = new Module(path.resolve('tests/frontend-matakuliah.cjs'));
compiled.filename = path.resolve('tests/frontend-matakuliah.cjs');
compiled.paths = Module._nodeModulePaths(process.cwd());
compiled._compile(bundle.outputFiles[0].text, compiled.filename);
const { navbar, dashboard, getCourses, getLogsFromPostgres, createLogEntry } = compiled.exports;
const noop = () => {};
const course1 = { id: 'mk1', name: 'MK Satu', members: ['student'] };
const course2 = { id: 'mk2', name: 'MK Dua', members: ['student'] };

test('MK selector is hidden for zero/one course and shown for two courses', () => {
  const props = { user: { uid: 'student' }, profile: { name: 'Mahasiswa' }, isAdmin: false,
    view: 'student', setView: noop, onCourseChange: noop, courseId: 'mk2' };
  assert.doesNotMatch(navbar({ ...props, courses: [] }), /<select/);
  assert.doesNotMatch(navbar({ ...props, courses: [course1] }), /<select/);
  const html = navbar({ ...props, courses: [course1, course2] });
  assert.match(html, /aria-label="Pilih mata kuliah"/);
  assert.match(html, /value="mk2" selected=""/);
  assert.match(html, /MK Satu/);
  assert.match(html, /MK Dua/);
});

test('dashboard displays the selected course, group and report', () => {
  for (const course of [course1, course2]) {
    const other = course.id === 'mk1' ? course2 : course1;
    const html = dashboard({ user: { uid: 'student' }, profile: { name: 'Mahasiswa' },
      courseName: course.name, onChanged: noop,
      groups: [{ id: course.id + '-group', courseId: course.id, name: 'Kelompok ' + course.name, members: ['student'] }],
      logs: [{ id: course.id + '-log', courseId: course.id, groupId: course.id + '-group', studentId: 'student',
        weekNumber: 1, description: 'Laporan ' + course.name, evidenceUrl: '/evidence.pdf', timestamp: { seconds: 1000 } }],
    });
    assert.match(html, new RegExp('Laporan ' + course.name));
    assert.match(html, new RegExp('Kelompok ' + course.name));
    assert.doesNotMatch(html, new RegExp(other.name));
  }
});

test('API requests carry course and student IDs and share one initial CSRF request', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => url === '/csrf-token'
      ? { 'X-CSRF-Token': 'test-token' } : [] };
  };
  try {
    await Promise.all([getCourses('student'), getLogsFromPostgres('mk2', 'student')]);
    await createLogEntry({ weekNumber: 1, description: 'MK2', evidenceUrl: '/file.pdf' },
      { uid: 'student' }, { id: 'group2', courseId: 'mk2' });
    assert.equal(requests.filter(r => r.url === '/csrf-token').length, 1);
    assert.ok(requests.some(r => r.url === '/matakuliah?mahasiswa_id=student'));
    assert.ok(requests.some(r => r.url === '/logbook?matakuliah_id=mk2&mahasiswa_id=student'));
    const payload = JSON.parse(requests.find(r => r.options.method === 'POST').options.body);
    assert.equal(payload.matakuliah_id, 'mk2');
    assert.equal(payload.grup_id, 'group2');
    assert.equal(payload.mahasiswa_id, 'student');
  } finally { globalThis.fetch = originalFetch; }
});
