const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const { startServer, api } = require('./helpers');

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const PASSWORD = 'correct-horse-battery';

function connect(base, query, auth) {
  return new Promise((resolve) => {
    const s = io(base, { query, auth, reconnection: false, transports: ['websocket'], timeout: 3000 });
    s.on('connect', () => resolve({ ok: true, socket: s }));
    s.on('connect_error', (e) => { s.close(); resolve({ ok: false, error: e.message }); });
  });
}

test('security', async (t) => {
  const srv = await startServer();
  t.after(() => srv.stop());
  const { base } = srv;
  let adminToken;

  await t.test('sends hardened HTTP headers', async () => {
    const r = await fetch(`${base}/api/health`);
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  });

  await t.test('has no default accounts', async () => {
    for (const [email, password] of [['admin@magasin.local', 'admin123'], ['hugu@imagescreen.local', '1234']]) {
      const r = await api(base, 'POST', '/auth/login', { email, password });
      assert.equal(r.status, 401);
    }
    const st = await api(base, 'GET', '/auth/status');
    assert.equal(st.data.needsSetup, true);
  });

  await t.test('rejects weak passwords', async () => {
    const r = await api(base, 'POST', '/auth/register', { email: 'a@b.fr', password: 'short' });
    assert.equal(r.status, 400);
  });

  await t.test('first account becomes admin, then registration is closed', async () => {
    const r = await api(base, 'POST', '/auth/register', { email: 'Boss@Shop.fr', password: PASSWORD });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.role, 'admin');
    assert.equal(r.data.user.email, 'boss@shop.fr'); // normalised
    adminToken = r.data.token;

    const second = await api(base, 'POST', '/auth/register', { email: 'evil@x.fr', password: PASSWORD });
    assert.equal(second.status, 403);
    const st = await api(base, 'GET', '/auth/status');
    assert.deepEqual([st.data.needsSetup, st.data.registrationOpen], [false, false]);
  });

  await t.test('rejects forged tokens (old public secret, alg=none, garbage)', async () => {
    const forged = jwt.sign({ userId: 'x', role: 'admin', tv: 0 }, 'signage_super_secret_key_12345');
    assert.equal((await api(base, 'GET', '/admin/stats', null, forged)).status, 401);
    const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' +
      Buffer.from('{"userId":"x","role":"admin"}').toString('base64url') + '.';
    assert.equal((await api(base, 'GET', '/screens', null, none)).status, 401);
    assert.equal((await api(base, 'GET', '/screens', null, 'garbage')).status, 401);
    assert.equal((await api(base, 'GET', '/screens')).status, 401);
  });

  await t.test('socket: admin room requires a valid token', async () => {
    assert.equal((await connect(base, { type: 'admin' })).ok, false);
    assert.equal((await connect(base, { type: 'admin' }, { token: 'nope' })).ok, false);
    const good = await connect(base, { type: 'admin' }, { token: adminToken });
    assert.equal(good.ok, true);
    good.socket.close();
  });

  await t.test('socket: screens are bound to a device secret and never leak it', async () => {
    const id = 'scr-' + crypto.randomBytes(8).toString('hex');
    const secret = crypto.randomBytes(24).toString('hex');

    assert.equal((await connect(base, { type: 'screen', screenId: id })).ok, false);
    assert.equal((await connect(base, { type: 'screen', screenId: 'x' }, { screenToken: secret })).ok, false);

    const admin = await connect(base, { type: 'admin' }, { token: adminToken });
    const lists = [];
    admin.socket.on('screens:list', (l) => lists.push(l));

    const tv = await connect(base, { type: 'screen', screenId: id }, { screenToken: secret });
    assert.equal(tv.ok, true);
    tv.socket.emit('screen:register', { id, code: 'ABCD23', name: 'TV test' });
    await new Promise((r) => setTimeout(r, 600));

    // An impostor who knows the id but not the secret is refused
    const impostor = await connect(base, { type: 'screen', screenId: id }, { screenToken: crypto.randomBytes(24).toString('hex') });
    assert.equal(impostor.ok, false);

    // Admin sees the screen without the secret hash; REST list too
    const last = lists[lists.length - 1] || [];
    assert.ok(last.find((s) => s.id === id), 'admin received the screen');
    assert.ok(last.every((s) => !('token_hash' in s)));
    const rest = await api(base, 'GET', '/screens', null, adminToken);
    assert.ok(rest.data.every((s) => !('token_hash' in s)));

    // A screen cannot register another screen's identity
    tv.socket.emit('screen:register', { id: 'scr-someoneelse1', code: 'ZZZZ22', name: 'x' });
    await new Promise((r) => setTimeout(r, 300));
    const after = await api(base, 'GET', '/screens', null, adminToken);
    assert.equal(after.data.find((s) => s.id === 'scr-someoneelse1'), undefined);

    tv.socket.close();
    admin.socket.close();
  });

  await t.test('a rebooted screen is told it is still associated (and gets its playlist)', async () => {
    const id = 'scr-' + crypto.randomBytes(8).toString('hex');
    const secret = crypto.randomBytes(24).toString('hex');
    const pl = await api(base, 'POST', '/playlists', { name: 'Boot playlist', mediaIds: [] }, adminToken);

    const first = await connect(base, { type: 'screen', screenId: id }, { screenToken: secret });
    first.socket.emit('screen:register', { code: 'BOOT22', name: 'TV' });
    await new Promise((r) => setTimeout(r, 400));
    const assoc = await api(base, 'POST', '/screens/associate', { code: 'BOOT22', name: 'TV Hall', playlistId: pl.data.id }, adminToken);
    assert.equal(assoc.status, 200);
    first.socket.close();
    await new Promise((r) => setTimeout(r, 300));

    // reboot: same id + secret
    const again = await connect(base, { type: 'screen', screenId: id }, { screenToken: secret });
    const got = new Promise((resolve) => again.socket.once('screen:associated', resolve));
    again.socket.emit('screen:register', { code: 'BOOT22', name: 'Écran Kiosque' });
    const payload = await Promise.race([got, new Promise((r) => setTimeout(() => r(null), 2000))]);
    assert.ok(payload, 'screen:associated must be sent after register');
    assert.equal(payload.name, 'TV Hall');
    assert.equal(String(payload.playlistId), String(pl.data.id));
    assert.ok(payload.playlistDetails, 'playlist details included');

    // dissociated while offline: the screen is told to go back to pairing
    const list = await api(base, 'GET', '/screens', null, adminToken);
    await api(base, 'DELETE', `/screens/${list.data.find((s) => s.id === id).id}`, null, adminToken);
    const gotReset = new Promise((resolve) => again.socket.once('screen:associated', resolve));
    again.socket.emit('screen:register', { code: 'BOOT22', name: 'Écran Kiosque' });
    const reset = await Promise.race([gotReset, new Promise((r) => setTimeout(() => r(null), 2000))]);
    assert.ok(reset && reset.name === null, 'dissociated screen receives name=null');
    again.socket.close();
  });

  await t.test('upload: content is checked, disguised HTML is refused', async () => {
    const fd = new FormData();
    fd.append('files', new Blob(['<script>alert(1)</script>'.padEnd(64, ' ')], { type: 'image/png' }), 'evil.html');
    const bad = await api(base, 'POST', '/media/upload', fd, adminToken);
    assert.equal(bad.status, 400);

    const fd2 = new FormData();
    fd2.append('files', new Blob(['<svg onload=alert(1)>'.padEnd(64, ' ')], { type: 'image/png' }), 'x.png');
    assert.equal((await api(base, 'POST', '/media/upload', fd2, adminToken)).status, 400);
  });

  await t.test('upload: a real image is accepted, renamed server-side and served as inert content', async () => {
    const fd = new FormData();
    fd.append('files', new Blob([PNG_1x1], { type: 'application/octet-stream' }), '../../weird name<>.php');
    const ok = await api(base, 'POST', '/media/upload', fd, adminToken);
    assert.equal(ok.status, 201, JSON.stringify(ok.data));
    const m = ok.data.media[0];
    assert.match(m.filename, /^file-\d+-[0-9a-f]{16}\.(jpg|png)$/);
    assert.ok(['image/jpeg', 'image/png'].includes(m.mime_type));
    assert.ok(!/[<>/\\]/.test(m.original_name));

    const file = await fetch(base + m.filepath);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    assert.match(file.headers.get('content-security-policy'), /sandbox/);
    assert.match(file.headers.get('content-type'), /^image\//);

    assert.equal((await fetch(base + '/uploads/..%2f..%2fjwt.secret')).status === 200, false);
  });

  await t.test('settings: admin only, validated', async () => {
    assert.equal((await api(base, 'PUT', '/settings', { store_name: 'Ok' }, adminToken)).status, 200);
    assert.equal((await api(base, 'PUT', '/settings', { logo: 'javascript:alert(1)' }, adminToken)).status, 400);
    assert.equal((await api(base, 'PUT', '/settings', { default_duration: -5 }, adminToken)).status, 400);
    assert.equal((await api(base, 'PUT', '/settings', { store_name: 'x' })).status, 401);
  });

  await t.test('SQL injection attempts in inputs are inert', async () => {
    const r = await api(base, 'POST', '/auth/login', { email: "' OR 1=1 --", password: 'x' });
    assert.equal(r.status, 401);
    const p = await api(base, 'POST', '/playlists', { name: "x'); DROP TABLE users;--", mediaIds: ["1' OR '1'='1"] }, adminToken);
    assert.ok([200, 201].includes(p.status));
    assert.equal((await api(base, 'GET', '/auth/me', null, adminToken)).status, 200);
  });

  await t.test('changing the password revokes old tokens', async () => {
    const weak = await api(base, 'PUT', '/auth/update-password', { currentPassword: PASSWORD, newPassword: 'abc' }, adminToken);
    assert.equal(weak.status, 400);
    const r = await api(base, 'PUT', '/auth/update-password', { currentPassword: PASSWORD, newPassword: 'a-brand-new-passphrase' }, adminToken);
    assert.equal(r.status, 200);
    assert.equal((await api(base, 'GET', '/auth/me', null, adminToken)).status, 401, 'old token revoked');
    assert.equal((await api(base, 'GET', '/auth/me', null, r.data.token)).status, 200, 'new token works');
    assert.equal((await connect(base, { type: 'admin' }, { token: adminToken })).ok, false, 'old token refused by sockets');
    adminToken = r.data.token;
  });

  await t.test('brute force on login is rate limited', async () => {
    let last;
    for (let i = 0; i < 12; i++) {
      last = await api(base, 'POST', '/auth/login', { email: 'boss@shop.fr', password: 'wrong-' + i });
    }
    assert.equal(last.status, 429);
  });
});

test('legacy default accounts are forced to change their password', async (t) => {
  // Create a database the way older versions did, then start the new server on it
  const first = await startServer();
  const dir = first.dir;
  await first.stop();

  const bcrypt = require('bcryptjs');
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database(require('path').join(dir, 'signage.db'));
  await new Promise((res, rej) => db.run(
    'INSERT INTO users (id, email, password, name, role, created_at) VALUES (?,?,?,?,?,?)',
    ['legacy1', 'admin@magasin.local', bcrypt.hashSync('admin123', 4), 'Admin', 'user', new Date().toISOString()],
    (e) => (e ? rej(e) : res())
  ));
  await new Promise((res) => db.close(res));

  const srv = await startServer({}, dir);
  t.after(() => srv.stop());

  const login = await api(srv.base, 'POST', '/auth/login', { email: 'admin@magasin.local', password: 'admin123' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.mustChangePassword, true);

  const blocked = await api(srv.base, 'GET', '/screens', null, login.data.token);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await connect(srv.base, { type: 'admin' }, { token: login.data.token })).ok, false);

  const change = await api(srv.base, 'PUT', '/auth/update-password',
    { currentPassword: 'admin123', newPassword: 'a-much-better-passphrase' }, login.data.token);
  assert.equal(change.status, 200);
  assert.equal((await api(srv.base, 'GET', '/screens', null, change.data.token)).status, 200);
});

test('registration can be opened explicitly and users get the user role', async (t) => {
  const srv = await startServer({ ALLOW_REGISTRATION: 'true' });
  t.after(() => srv.stop());
  const a = await api(srv.base, 'POST', '/auth/register', { email: 'a@shop.fr', password: PASSWORD });
  const b = await api(srv.base, 'POST', '/auth/register', { email: 'b@shop.fr', password: PASSWORD });
  assert.equal(a.data.user.role, 'admin');
  assert.equal(b.data.user.role, 'user');
  assert.equal((await api(srv.base, 'PUT', '/settings', { store_name: 'Hacked' }, b.data.token)).status, 403);
  assert.equal((await api(srv.base, 'GET', '/admin/keys', null, b.data.token)).status, 403);
});

test('JWT secret is generated, persisted and never the public default', async (t) => {
  const fs = require('fs');
  const srv = await startServer();
  const secretFile = require('path').join(srv.dir, 'jwt.secret');
  const secret = fs.readFileSync(secretFile, 'utf8').trim();
  assert.ok(secret.length >= 64);
  assert.notEqual(secret, 'signage_super_secret_key_12345');
  assert.equal((fs.statSync(secretFile).mode & 0o077), 0, 'secret file is private');
  await srv.stop();
  // A placeholder in the environment is ignored
  const srv2 = await startServer({ JWT_SECRET: 'change_this_to_a_long_random_string_in_production' }, srv.dir);
  t.after(() => srv2.stop());
  assert.equal(fs.readFileSync(secretFile, 'utf8').trim(), secret);
});
