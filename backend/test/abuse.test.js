const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { io } = require('socket.io-client');
const { startServer, api, storeAdminToken } = require('./helpers');

/** An MP4-looking buffer of the given size (valid header, padding after it). */
function fakeVideo(size) {
  const header = Buffer.from('0000001866747970 69736f6d'.replace(/ /g, ''), 'hex');
  return Buffer.concat([header, Buffer.alloc(size - header.length)]);
}

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const PASSWORD = 'correct-horse-battery';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rawRequest(port, method, p, headers = {}, body) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, headers: {}, body: '' }));
    if (body) req.write(body);
    req.end();
  });
}

function connectScreen(base, id = 'scr-' + crypto.randomBytes(8).toString('hex')) {
  return new Promise((resolve) => {
    const s = io(base, {
      query: { type: 'screen', screenId: id },
      auth: { screenToken: crypto.randomBytes(24).toString('hex') },
      reconnection: false, transports: ['websocket'], timeout: 3000,
    });
    s.on('connect', () => resolve({ socket: s, id }));
    s.on('connect_error', () => { s.close(); resolve(null); });
  });
}
const pairingCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();

test('error handling, caching and file permissions', async (t) => {
  const srv = await startServer();
  t.after(() => srv.stop());
  const reg = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const token = reg.data.token; // super-admin
  const store = await storeAdminToken(srv.base, token);

  await t.test('malformed JSON returns a clean JSON error (no stack trace, no HTML)', async () => {
    const r = await rawRequest(srv.port, 'POST', '/api/auth/login', { 'Content-Type': 'application/json' }, '{bad json');
    assert.equal(r.status, 400);
    assert.match(r.headers['content-type'], /json/);
    assert.doesNotMatch(r.body, /node_modules|\.js:\d+|at \w+/);
  });

  await t.test('unknown API routes return JSON 404', async () => {
    const r = await rawRequest(srv.port, 'GET', '/api/does-not-exist');
    assert.equal(r.status, 404);
    assert.match(r.headers['content-type'], /json/);
  });

  await t.test('API responses are never cacheable', async () => {
    const r = await rawRequest(srv.port, 'GET', '/api/screens', { Authorization: 'Bearer ' + store.token });
    assert.match(r.headers['cache-control'], /no-store/);
  });

  await t.test('database and secret are private to the server user', async () => {
    for (const f of ['signage.db', 'jwt.secret']) {
      const mode = fs.statSync(path.join(srv.dir, f)).mode & 0o077;
      assert.equal(mode, 0, `${f} must not be group/world accessible`);
    }
  });

  await t.test('media usage endpoint reports used and max bytes', async () => {
    const r = await api(srv.base, 'GET', '/media/usage', null, store.token);
    assert.equal(r.status, 200);
    assert.equal(r.data.used, 0);
    assert.ok(r.data.max > 0);
    assert.equal((await api(srv.base, 'GET', '/media/usage')).status, 401);
    assert.equal((await api(srv.base, 'GET', '/media/usage', null, token)).status, 403, 'super-admin has no store content');
  });

  await t.test('events limit is clamped', async () => {
    const r = await api(srv.base, 'GET', '/events?limit=999999999', null, store.token);
    assert.equal(r.status, 200);
    assert.ok(r.data.length <= 500);
  });

  await t.test('license key inputs are validated', async () => {
    assert.equal((await api(srv.base, 'POST', '/admin/keys', { plan: 'pro', duration_days: -5 }, token)).status, 400);
    assert.equal((await api(srv.base, 'POST', '/admin/keys', { plan: 'pro', max_uses: 'lots' }, token)).status, 400);
    assert.equal((await api(srv.base, 'POST', '/admin/keys', { plan: 'pro', duration_days: 30, max_uses: 2 }, token)).status, 201);
  });
});

test('anonymous screens cannot flood the server', async (t) => {
  await t.test('per-IP limit on new screens', async (t2) => {
    const srv = await startServer({ NEW_SCREENS_PER_HOUR: '5' });
    t2.after(() => srv.stop());
    const socks = [];
    let dropped = 0;
    for (let i = 0; i < 25; i++) {
      const c = await connectScreen(srv.base);
      if (!c) continue;
      c.socket.on('disconnect', () => dropped++);
      c.socket.emit('screen:register', { id: c.id, code: pairingCode(), name: 'spam' });
      socks.push(c.socket);
    }
    await sleep(1500);
    assert.ok(dropped >= 20, `expected >= 20 refused, got ${dropped}`);
    socks.forEach((s) => s.close());
  });

  await t.test('global cap on unpaired screens', async (t2) => {
    const srv = await startServer({ MAX_PENDING_SCREENS: '3', NEW_SCREENS_PER_HOUR: '1000' });
    t2.after(() => srv.stop());
    const socks = [];
    let dropped = 0;
    for (let i = 0; i < 10; i++) {
      const c = await connectScreen(srv.base);
      if (!c) continue;
      c.socket.on('disconnect', () => dropped++);
      c.socket.emit('screen:register', { id: c.id, code: pairingCode(), name: 'spam' });
      socks.push(c.socket);
      await sleep(80);
    }
    await sleep(800);
    assert.equal(dropped, 7, `3 screens accepted, 7 refused; refused ${dropped}`);
    socks.forEach((s) => s.close());
  });

  await t.test('per-IP connection rate limit', async (t2) => {
    const srv = await startServer({ SOCKET_CONNECTIONS_PER_MIN: '10' });
    t2.after(() => srv.stop());
    let refused = 0;
    for (let i = 0; i < 25; i++) {
      const c = await connectScreen(srv.base);
      if (!c) refused++; else c.socket.close();
    }
    assert.ok(refused >= 10, `refused ${refused}`);
  });

  await t.test('an event flood from one socket gets it disconnected', async (t2) => {
    const srv = await startServer();
    t2.after(() => srv.stop());
    const c = await connectScreen(srv.base);
    let dropped = false;
    c.socket.on('disconnect', () => (dropped = true));
    for (let i = 0; i < 3000; i++) c.socket.emit('screen:heartbeat', {});
    await sleep(1500);
    assert.equal(dropped, true);
    // the server is still healthy
    assert.equal((await api(srv.base, 'GET', '/health')).status, 200);
  });

  await t.test('oversized socket payloads close the connection', async (t2) => {
    const srv = await startServer();
    t2.after(() => srv.stop());
    const c = await connectScreen(srv.base);
    let closed = false;
    c.socket.on('disconnect', () => (closed = true));
    c.socket.emit('screen:register', { code: 'ABCD23', name: 'x'.repeat(200000) });
    await sleep(800);
    assert.equal(closed, true);
  });
});

test('first admin account can be protected by SETUP_TOKEN', async (t) => {
  const srv = await startServer({ SETUP_TOKEN: 'my-install-code-123' });
  t.after(() => srv.stop());
  const st = await api(srv.base, 'GET', '/auth/status');
  assert.equal(st.data.needsSetupToken, true);

  const body = { email: 'boss@shop.fr', password: PASSWORD };
  assert.equal((await api(srv.base, 'POST', '/auth/register', body)).status, 403);
  assert.equal((await api(srv.base, 'POST', '/auth/register', { ...body, setupToken: 'wrong' })).status, 403);
  const ok = await api(srv.base, 'POST', '/auth/register', { ...body, setupToken: 'my-install-code-123' });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.role, 'superadmin');
});

test('storage quota is enforced', async (t) => {
  const srv = await startServer({ MAX_STORAGE_MB: '0.5' }); // 512 KB per store
  t.after(() => srv.stop());
  const reg = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const store = await storeAdminToken(srv.base, reg.data.token);
  const upload = () => {
    const fd = new FormData();
    fd.append('files', new Blob([fakeVideo(400 * 1024)]), 'a.mp4');
    return api(srv.base, 'POST', '/media/upload', fd, store.token);
  };
  assert.equal((await upload()).status, 201);
  assert.equal((await upload()).status, 413);
});
