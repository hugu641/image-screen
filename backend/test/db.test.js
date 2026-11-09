const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'imagescreen-dbtest-'));
const { fdb, initDb } = require('../database/db');

test('database layer', async (t) => {
  await initDb();

  await t.test('rejects unsafe table / column / operator names', async () => {
    await assert.rejects(() => fdb.getAll('users; DROP TABLE users'), /Invalid table/);
    await assert.rejects(() => fdb.getWhere('users', [{ field: 'email; --', value: 'x' }]), /Invalid column/);
    await assert.rejects(() => fdb.getWhere('users', [{ field: 'email', op: 'OR 1=1 --', value: 'x' }]), /Invalid operator/);
    await assert.rejects(() => fdb.getAll('users', [], { orderBy: 'id; DROP TABLE users' }), /Invalid column/);
    await assert.rejects(() => fdb.add('users', { 'email) VALUES (1); --': 'x' }), /Invalid column/);
    await assert.rejects(() => fdb.update('users', '1', { 'role = 1, id': 'x' }), /Invalid column/);
  });

  await t.test('generated ids are unpredictable and unique', async () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) ids.add(await fdb.add('events', { event_type: 'info', message: 'm' }));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.ok(id.length >= 12, id);
  });

  await t.test('license key use is claimed atomically', async () => {
    const id = await fdb.add('licenseKeys', { key: 'IS-TEST-1', plan: 'pro', max_uses: 1, uses_count: 0, is_active: true });
    const results = await Promise.all(Array.from({ length: 20 }, () => fdb.claimLicenseUse(id)));
    assert.equal(results.filter(Boolean).length, 1);
    const key = await fdb.getById('licenseKeys', id);
    assert.equal(key.uses_count, 1);
  });
});
