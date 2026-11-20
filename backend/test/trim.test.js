const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, storeAdminToken } = require('./helpers');

const PASSWORD = 'correct-horse-battery';
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
function fakeVideo(size) {
  const header = Buffer.from('00000018' + '66747970' + '69736f6d', 'hex');
  return Buffer.concat([header, Buffer.alloc(size - header.length)]);
}
function upload(base, token, buffer, name, type) {
  const fd = new FormData();
  fd.append('files', new Blob([buffer], { type }), name);
  return api(base, 'POST', '/media/upload', fd, token);
}

test('a video can be cut to an excerpt without touching the file', async (t) => {
  const srv = await startServer();
  t.after(() => srv.stop());
  const sup = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const store = await storeAdminToken(srv.base, sup.data.token);

  const up = await upload(srv.base, store.token, fakeVideo(300 * 1024), 'film.mp4', 'video/mp4');
  const item = up.data.media[0];
  const before = item.size;

  const cut = await api(srv.base, 'PUT', `/media/${item.id}/trim`, { start: 2.5, end: 12.25, duration: 60 }, store.token);
  assert.equal(cut.status, 200, JSON.stringify(cut.data));
  assert.equal(cut.data.trim_start, 2.5);
  assert.equal(cut.data.trim_end, 12.25);
  assert.equal(cut.data.duration, 60);
  assert.equal(cut.data.size, before, 'the file is untouched');

  // The excerpt reaches the playlists, so the TV receives it
  const pl = await api(srv.base, 'POST', '/playlists', { name: 'Montage', mediaIds: [item.id] }, store.token);
  assert.equal(pl.data.media[0].trim_start, 2.5);
  assert.equal(pl.data.media[0].trim_end, 12.25);

  // Resetting to the full length brings the whole video back
  const reset = await api(srv.base, 'PUT', `/media/${item.id}/trim`, { start: 0, end: 60, duration: 60 }, store.token);
  assert.equal(reset.data.trim_start, 0);
  assert.equal(reset.data.trim_end, 60);
});

test('invalid excerpts, images and other stores are refused', async (t) => {
  const srv = await startServer();
  t.after(() => srv.stop());
  const sup = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const a = await storeAdminToken(srv.base, sup.data.token, 'a@shop.fr', 'A');
  const b = await storeAdminToken(srv.base, sup.data.token, 'b@shop.fr', 'B');
  const video = (await upload(srv.base, a.token, fakeVideo(300 * 1024), 'film.mp4', 'video/mp4')).data.media[0];
  const image = (await upload(srv.base, a.token, PNG_1x1, 'photo.png', 'image/png')).data.media[0];
  const url = (id) => `/media/${id}/trim`;

  assert.equal((await api(srv.base, 'PUT', url(video.id), { start: 10, end: 5, duration: 60 }, a.token)).status, 400, 'end before start');
  assert.equal((await api(srv.base, 'PUT', url(video.id), { start: 0, end: 90, duration: 60 }, a.token)).status, 400, 'beyond the video');
  assert.equal((await api(srv.base, 'PUT', url(video.id), { start: 1, end: 1.2, duration: 60 }, a.token)).status, 400, 'shorter than 0.5 s');
  assert.equal((await api(srv.base, 'PUT', url(video.id), { start: 0, end: 5 }, a.token)).status, 400, 'missing duration');
  assert.equal((await api(srv.base, 'PUT', url(image.id), { start: 0, end: 5, duration: 60 }, a.token)).status, 400, 'images cannot be cut');
  assert.equal((await api(srv.base, 'PUT', url(video.id), { start: 0, end: 5, duration: 60 }, b.token)).status, 404, 'other store');
  assert.equal((await api(srv.base, 'PUT', url(video.id), { start: 0, end: 5, duration: 60 })).status, 401);
});
