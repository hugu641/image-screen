const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, api, storeAdminToken } = require('./helpers');

const PASSWORD = 'correct-horse-battery';
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
/** An MP4-looking buffer of the given size: valid header, then padding. */
function fakeVideo(size) {
  const header = Buffer.from('00000018' + '66747970' + '69736f6d', 'hex');
  return Buffer.concat([header, Buffer.alloc(size - header.length)]);
}
function upload(base, token, buffer, name) {
  const fd = new FormData();
  fd.append('files', new Blob([buffer]), name);
  return api(base, 'POST', '/media/upload', fd, token);
}
function storeFolder(dir, storeId) {
  return path.join(dir, 'uploads', storeId);
}

test('large videos are accepted up to the limit, stored in the store folder, and streamed', async (t) => {
  const srv = await startServer({ MAX_UPLOAD_MB: '2' });
  t.after(() => srv.stop());
  const sup = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const store = await storeAdminToken(srv.base, sup.data.token);

  const ok = await upload(srv.base, store.token, fakeVideo(1.5 * 1024 * 1024), 'film.mp4');
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  const item = ok.data.media[0];
  assert.equal(item.size, 1.5 * 1024 * 1024);
  assert.ok(item.filepath.startsWith(`/uploads/${store.storeId}/`));
  assert.ok(fs.existsSync(path.join(srv.dir, item.filepath)), 'file is on disk');

  // Range requests work, so a TV can play a video without loading it all at once
  const range = await fetch(srv.base + item.filepath, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 100);
});

test('a file over the limit is refused, and nothing is left behind', async (t) => {
  const srv = await startServer({ MAX_UPLOAD_MB: '1' });
  t.after(() => srv.stop());
  const sup = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const store = await storeAdminToken(srv.base, sup.data.token);

  const big = await upload(srv.base, store.token, fakeVideo(1.5 * 1024 * 1024), 'trop-gros.mp4');
  assert.equal(big.status, 413);
  assert.match(big.data.error, /trop volumineux/);

  const folder = storeFolder(srv.dir, store.storeId);
  const leftovers = fs.existsSync(folder) ? fs.readdirSync(folder).filter((f) => f !== '.incoming') : [];
  assert.deepEqual(leftovers, []);
  const incoming = path.join(folder, '.incoming');
  assert.ok(!fs.existsSync(incoming) || fs.readdirSync(incoming).length === 0, 'temporary chunks removed');
  assert.equal((await api(srv.base, 'GET', '/media', null, store.token)).data.length, 0);
});

test('images keep their own, smaller limit and are still checked by content', async (t) => {
  const srv = await startServer({ MAX_IMAGE_MB: '0.001' }); // about 1 KB
  t.after(() => srv.stop());
  const sup = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const store = await storeAdminToken(srv.base, sup.data.token);

  const bigImage = Buffer.concat([PNG_1x1, Buffer.alloc(2048)]);
  assert.equal((await upload(srv.base, store.token, bigImage, 'grande.png')).status, 400);
  assert.equal((await upload(srv.base, store.token, Buffer.from('<script>alert(1)</script>'.padEnd(64)), 'x.png')).status, 400);
  assert.equal((await upload(srv.base, store.token, PNG_1x1, 'petite.png')).status, 201);
});

test('uploads interrupted by a restart are cleaned up at startup', async (t) => {
  const first = await startServer();
  const sup = await api(first.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const store = await storeAdminToken(first.base, sup.data.token);
  const dir = first.dir;
  await first.stop();

  const leftover = path.join(storeFolder(dir, store.storeId), '.incoming');
  fs.mkdirSync(leftover, { recursive: true });
  fs.writeFileSync(path.join(leftover, 'interrupted.part'), Buffer.alloc(1024));

  const second = await startServer({}, dir);
  t.after(() => second.stop());
  assert.equal(fs.existsSync(path.join(leftover, 'interrupted.part')), false);
});
