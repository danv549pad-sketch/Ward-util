import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

test('isolated Staff API stores one recurrence definition, validates it, and preserves old entries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'wardspace-recurrence-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}/api/wardspace`;
  const server = spawn(process.execPath, ['artifacts/api-server/dist/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port),
      WARDSPACE_DB_PATH: join(directory, 'fixture.sqlite'),
      WARDSPACE_STAFF_PIN: 'isolated-test-pin',
      SESSION_SECRET: 'isolated-test-secret-only-not-for-deployment-12345' },
    stdio: 'ignore',
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`isolated server exited ${server.exitCode}`);
      try { const response = await fetch(`${base}/staff/status`); if (response.ok) { ready = true; break; } }
      catch { /* waiting for test server */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(ready, true, 'isolated API started');
    const login = await fetch(`${base}/staff/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'isolated-test-pin' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie, 'test session cookie returned');
    const request = (method, path, body) => fetch(`${base}${path}`, {
      method, headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const old = await request('POST', '/schedule', { title: 'One-time fixture', date: '2026-09-30', time: '09:00' });
    assert.equal(old.status, 201);
    const oldItem = await old.json();
    assert.equal(oldItem.recurrence, 'none');
    const invalid = await request('POST', '/schedule', { title: 'Invalid fixture', date: '2026-09-30', recurrence: 'daily', recurrenceEndDate: '2026-09-29' });
    assert.equal(invalid.status, 400);
    const created = await request('POST', '/schedule', { title: 'Recurring Test Breakfast', date: '2026-09-30', time: '08:00', recurrence: 'daily', recurrenceEndDate: '2026-10-03', published: true });
    assert.equal(created.status, 201);
    const item = await created.json();
    assert.equal(item.recurrence, 'daily');
    assert.equal(item.recurrenceEndDate, '2026-10-03');
    const edited = await request('PATCH', `/schedule/${item.id}`, { recurrence: 'weekly', recurrenceEndDate: '2026-10-21' });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).recurrence, 'weekly');
    const list = await request('GET', '/schedule');
    assert.equal(list.status, 200);
    const rows = await list.json();
    assert.equal(rows.filter(row => row.title === 'Recurring Test Breakfast').length, 1, 'no duplicate occurrence rows');
    assert.equal(rows.find(row => row.id === item.id).recurrence, 'weekly');
    assert.equal(rows.find(row => row.id === oldItem.id).recurrence, 'none');
    assert.equal((await request('DELETE', `/schedule/${item.id}`)).status, 204);
    assert.equal((await request('DELETE', `/schedule/${oldItem.id}`)).status, 204);
  } finally {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});