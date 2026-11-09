const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Start a real server on a temporary data dir. */
async function startServer(extraEnv = {}, dataDir) {
  const port = await freePort();
  const dir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'imagescreen-test-'));
  const child = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, JWT_SECRET: '', ALLOWED_ORIGINS: '', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));

  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error('server did not start:\n' + logs);
  }
  return {
    base, port, dir,
    logs: () => logs,
    stop: () => new Promise((resolve) => { child.once('exit', resolve); child.kill(); }),
  };
}

async function api(base, method, url, body, token, extraHeaders = {}) {
  const res = await fetch(base + '/api' + url, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

const INITIAL_PASSWORD = 'temporary-pass-1234';
const STORE_PASSWORD = 'store-admin-passphrase';

/**
 * Creates a store admin with the super-admin token, then completes its first mandatory
 * password change. Returns the store admin's token, account id and store id.
 */
async function storeAdminToken(base, superToken, email = 'magasin@shop.fr', storeName = 'Boutique test') {
  const created = await api(base, 'POST', '/admin/stores',
    { storeName, email, name: 'Gérant', password: INITIAL_PASSWORD }, superToken);
  if (created.status !== 201) throw new Error('store admin not created: ' + JSON.stringify(created.data));
  const login = await api(base, 'POST', '/auth/login', { email, password: INITIAL_PASSWORD });
  const change = await api(base, 'PUT', '/auth/update-password',
    { currentPassword: INITIAL_PASSWORD, newPassword: STORE_PASSWORD }, login.data.token);
  if (change.status !== 200) throw new Error('password change failed: ' + JSON.stringify(change.data));
  return {
    token: change.data.token,
    accountId: created.data.account.id,
    storeId: created.data.store.id,
    email,
  };
}

module.exports = { startServer, api, storeAdminToken, INITIAL_PASSWORD, STORE_PASSWORD };
