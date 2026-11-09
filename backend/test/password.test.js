const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, api, storeAdminToken } = require('./helpers');

const PASSWORD = 'correct-horse-battery';
const MAIL_ENV = { MAIL_TRANSPORT: 'file', APP_URL: 'https://app.example.test' };

/** Emails written by the "file" transport, newest last. */
function outbox(dir) {
  const file = path.join(dir, 'outbox.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
/** Token of the latest email sent to `to`. */
function tokenFor(dir, to) {
  const mails = outbox(dir).filter((m) => m.to === to);
  const m = mails[mails.length - 1];
  assert.ok(m, `no email for ${to}`);
  const match = m.text.match(/\/reset\?token=([A-Za-z0-9_-]+)/);
  assert.ok(match, 'email contains a reset link');
  assert.ok(m.text.includes('https://app.example.test/reset?token='), 'link points to the web app');
  return match[1];
}

test('password reset by email', async (t) => {
  const srv = await startServer(MAIL_ENV);
  t.after(() => srv.stop());
  const { base, dir } = srv;

  const st = await api(base, 'GET', '/auth/status');
  assert.equal(st.data.mailEnabled, true);

  const sup = await api(base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  const superToken = sup.data.token;

  await t.test('unknown email gets the same answer and no email', async () => {
    const r = await api(base, 'POST', '/auth/forgot', { email: 'nobody@shop.fr' });
    assert.equal(r.status, 200);
    assert.match(r.data.message, /Si un compte existe/);
    assert.equal(outbox(dir).filter((m) => m.to === 'nobody@shop.fr').length, 0);
  });

  await t.test('known email receives a one-time link that sets the new password', async () => {
    const r = await api(base, 'POST', '/auth/forgot', { email: 'BOSS@shop.fr' });
    assert.equal(r.status, 200);
    const token = tokenFor(dir, 'boss@shop.fr');

    assert.equal((await api(base, 'POST', '/auth/reset', { token, newPassword: 'abc' })).status, 400, 'weak password refused');
    const ok = await api(base, 'POST', '/auth/reset', { token, newPassword: 'a-brand-new-passphrase' });
    assert.equal(ok.status, 200);

    assert.equal((await api(base, 'POST', '/auth/login', { email: 'boss@shop.fr', password: PASSWORD })).status, 401, 'old password refused');
    assert.equal((await api(base, 'POST', '/auth/login', { email: 'boss@shop.fr', password: 'a-brand-new-passphrase' })).status, 200);
    assert.equal((await api(base, 'GET', '/auth/me', null, superToken)).status, 401, 'old sessions revoked');

    assert.equal((await api(base, 'POST', '/auth/reset', { token, newPassword: 'another-passphrase-1' })).status, 400, 'link is single use');
  });

  await t.test('invalid and tampered tokens are refused', async () => {
    assert.equal((await api(base, 'POST', '/auth/reset', { token: 'nope', newPassword: 'a-brand-new-passphrase' })).status, 400);
    assert.equal((await api(base, 'POST', '/auth/reset', { newPassword: 'a-brand-new-passphrase' })).status, 400);
  });

  await t.test('a disabled account gets no reset email', async () => {
    const newToken = (await api(base, 'POST', '/auth/login', { email: 'boss@shop.fr', password: 'a-brand-new-passphrase' })).data.token;
    const store = await storeAdminToken(base, newToken, 'gerant@shop.fr', 'Boutique X');
    assert.ok(store.token);
    const before = outbox(dir).length;
    await api(base, 'PATCH', `/admin/accounts/${store.accountId}`, { disabled: true }, newToken);
    await api(base, 'POST', '/auth/forgot', { email: 'gerant@shop.fr' });
    assert.equal(outbox(dir).length, before, 'no email for a disabled account');
  });
});

test('new accounts receive an invitation instead of a shared password', async (t) => {
  const srv = await startServer(MAIL_ENV);
  t.after(() => srv.stop());
  const { base, dir } = srv;
  const sup = await api(base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });

  const created = await api(base, 'POST', '/admin/stores', { storeName: 'Boulangerie', email: 'pain@shop.fr', name: 'Paul' }, sup.data.token);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.invitationSent, true);

  const token = tokenFor(dir, 'pain@shop.fr');
  assert.equal((await api(base, 'POST', '/auth/login', { email: 'pain@shop.fr', password: 'anything-1234' })).status, 401);
  assert.equal((await api(base, 'POST', '/auth/reset', { token, newPassword: 'pain-et-chocolat-1' })).status, 200);

  const login = await api(base, 'POST', '/auth/login', { email: 'pain@shop.fr', password: 'pain-et-chocolat-1' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.mustChangePassword, false);
  assert.equal((await api(base, 'GET', '/screens', null, login.data.token)).status, 200);

  // A store admin invites its users the same way
  const user = await api(base, 'POST', '/store/users', { email: 'vendeuse@shop.fr', name: 'Léa' }, login.data.token);
  assert.equal(user.status, 201);
  assert.equal(user.data.invitationSent, true);
  assert.ok(tokenFor(dir, 'vendeuse@shop.fr'));
});

test('without email configured, accounts need an explicit password', async (t) => {
  const srv = await startServer({ MAIL_TRANSPORT: '' });
  t.after(() => srv.stop());
  const sup = await api(srv.base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });
  assert.equal((await api(srv.base, 'GET', '/auth/status')).data.mailEnabled, false);
  const noPwd = await api(srv.base, 'POST', '/admin/stores', { storeName: 'X', email: 'x@shop.fr' }, sup.data.token);
  assert.equal(noPwd.status, 400);
  const withPwd = await api(srv.base, 'POST', '/admin/stores', { storeName: 'X', email: 'x@shop.fr', password: 'temporary-1234' }, sup.data.token);
  assert.equal(withPwd.status, 201);
  assert.equal(withPwd.data.invitationSent, false);
  // Reset is simply unavailable, and says nothing about accounts
  const forgot = await api(srv.base, 'POST', '/auth/forgot', { email: 'x@shop.fr' });
  assert.equal(forgot.status, 200);
});

test('the user guide is emailed after the first password, and downloadable by signed-in users', async (t) => {
  const srv = await startServer(MAIL_ENV);
  t.after(() => srv.stop());
  const { base, dir } = srv;
  const sup = await api(base, 'POST', '/auth/register', { email: 'boss@shop.fr', password: PASSWORD });

  // Download: signed-in only, returns the PDF
  assert.equal((await fetch(base + '/api/guide')).status, 401);
  const pdf = await fetch(base + '/api/guide', { headers: { Authorization: 'Bearer ' + sup.data.token } });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal((await pdf.arrayBuffer()).byteLength > 10000, true);

  // Invitation: the guide follows the first password
  await api(base, 'POST', '/admin/stores', { storeName: 'Pain', email: 'paul@shop.fr', name: 'Paul' }, sup.data.token);
  const inviteToken = tokenFor(dir, 'paul@shop.fr');
  await api(base, 'POST', '/auth/reset', { token: inviteToken, newPassword: 'paul-passphrase-1' });
  const guide = outbox(dir).find((m) => m.to === 'paul@shop.fr' && m.attachments && m.attachments.includes('Guide-ImageScreen.pdf'));
  assert.ok(guide, 'guide sent with the PDF attached');

  // A plain password reset does not send the guide again
  await api(base, 'POST', '/auth/forgot', { email: 'paul@shop.fr' });
  const resetToken = tokenFor(dir, 'paul@shop.fr');
  const before = outbox(dir).filter((m) => m.to === 'paul@shop.fr' && m.attachments).length;
  await api(base, 'POST', '/auth/reset', { token: resetToken, newPassword: 'paul-passphrase-2' });
  assert.equal(outbox(dir).filter((m) => m.to === 'paul@shop.fr' && m.attachments).length, before);
});
