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
      import { AdminManagement } from './src/components/admin/AdminManagement';
      export * from './src/services/api';
      export const navbar = props => renderToStaticMarkup(React.createElement(Navbar, props));
      export const dashboard = props => renderToStaticMarkup(React.createElement(StudentDashboard, props));
      export const adminManagement = props => renderToStaticMarkup(React.createElement(AdminManagement, props));
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
const { navbar, dashboard, getCourses, getLogsFromPostgres, createLogEntry, syncUserToPostgres } = compiled.exports;
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


test('login reads the PostgreSQL role and does not submit a client role', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: 'student', nama: 'Nama',
      email: 'student@unsrat.ac.id', role: 'admin', created_at: '2026-09-14T00:00:00Z' }) };
  };
  try {
    const profile = await syncUserToPostgres({ uid: 'student', name: 'Nama', email: 'student@unsrat.ac.id' });
    assert.equal(request.url, '/mahasiswa/login');
    assert.equal(JSON.parse(request.options.body).role, undefined);
    assert.equal(profile.role, 'admin');
    assert.equal(profile.createdAt, '2026-09-14T00:00:00Z');
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    await assert.rejects(syncUserToPostgres({ uid: 'student', name: 'Nama', email: 'student@unsrat.ac.id' }), /Gagal memuat profil/);
  } finally { globalThis.fetch = originalFetch; }
});

test('group picker is shown for an active course without a group and starts disabled', () => {
  const props = { user: { uid: 'student' }, profile: { name: 'Mahasiswa' },
    courseId: 'mk1', courseName: 'MK Satu', onChanged: noop, logs: [], groups: [] };
  const html = dashboard(props);
  assert.match(html, /Anda belum memiliki kelompok pada mata kuliah ini/);
  assert.match(html, /<button[^>]*disabled[^>]*>Pilih Kelompok<\/button>/);
  assert.doesNotMatch(dashboard({ ...props, courseId: '' }), />Pilih Kelompok</);
  assert.doesNotMatch(dashboard({ ...props, groups: [
      { id: 'g1', courseId: 'mk1', name: 'Kelompok 1', members: ['student'] },
    ] }), />Pilih Kelompok</);
});

test('admin list shows only administrators and provides the add action', () => {
  const html = compiled.exports.adminManagement({ users: [
    { uid: 'admin', name: 'Admin Satu', email: 'admin@unsrat.ac.id', role: 'admin' },
    { uid: 'student', name: 'Mahasiswa Satu', email: 'student@unsrat.ac.id', role: 'student' },
  ], onChanged: noop });
  assert.match(html, /Admin Satu/);
  assert.match(html, /admin@unsrat.ac.id/);
  assert.match(html, /Tambah Admin/);
  assert.doesNotMatch(html, /Mahasiswa Satu/);
});
