/**
 * Account management.
 *
 *  - super-admin  : creates / enables / disables store admins ("admin magasin"), and sees the
 *                   list of stores. It never reads a store's content.
 *  - store admin  : creates / enables / disables / deletes the "user" accounts of its own store.
 *
 * Accounts created here must change their password at their first login.
 */
const bcrypt = require('bcryptjs');
const { fdb } = require('../database/db');
const { normalizeEmail, validatePassword, EMAIL_RE, BCRYPT_COST } = require('./authController');
const { logEvent, disconnectUser } = require('../services/socketService');

const ROLE_STORE_ADMIN = 'storeadmin';
const ROLE_USER = 'user';

function publicAccount(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    storeId: u.store_id || null,
    disabled: !!u.disabled,
    created_at: u.created_at,
  };
}

function parseDisabled(value) {
  return typeof value === 'boolean' ? value : null;
}

/** Validates the email / name / password triple shared by every account creation. */
function checkNewAccount(body) {
  const email = normalizeEmail(body?.email);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const password = body?.password;
  if (!email || !password) return { error: 'Veuillez saisir un email et un mot de passe.' };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: 'Adresse email invalide.' };
  const pwdError = validatePassword(password);
  if (pwdError) return { error: pwdError };
  return { email, name: name || email.split('@')[0], password };
}

async function createAccount({ email, name, password, role, storeId }) {
  const hashed = await bcrypt.hash(password, BCRYPT_COST);
  const id = await fdb.add('users', {
    email,
    password: hashed,
    name,
    role,
    store_id: storeId,
    disabled: 0,
    token_version: 0,
    must_change_password: 1,
  });
  return fdb.getById('users', id);
}

// ─── Super-admin ─────────────────────────────────────────────────────────────

/** GET /admin/stores — every store with its admin accounts and number of users. */
async function listStores(req, res) {
  try {
    const stores = await fdb.getAll('stores', [], { orderBy: 'created_at', orderDir: 'asc' });
    const result = [];
    for (const store of stores) {
      const admins = await fdb.getAll('users', [
        { field: 'store_id', value: store.id },
        { field: 'role', value: ROLE_STORE_ADMIN },
      ]);
      const userCount = (await fdb.getAll('users', [
        { field: 'store_id', value: store.id },
        { field: 'role', value: ROLE_USER },
      ])).length;
      result.push({ id: store.id, name: store.name, created_at: store.created_at, admins: admins.map(publicAccount), userCount });
    }
    res.json(result);
  } catch (error) {
    console.error('List stores error:', error);
    res.status(500).json({ error: 'Impossible de charger la liste des magasins.' });
  }
}

/**
 * POST /admin/stores — creates a store admin.
 * Either { storeName } to create a new store, or { storeId } to add another admin to an existing store.
 */
async function createStoreAdmin(req, res) {
  const checked = checkNewAccount(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });

  const storeName = typeof req.body?.storeName === 'string' ? req.body.storeName.trim().slice(0, 100) : '';
  const storeId = req.body?.storeId ? String(req.body.storeId) : null;
  if (!storeId && !storeName) return res.status(400).json({ error: 'Nom du magasin requis.' });

  try {
    if (await fdb.getWhere('users', [{ field: 'email', value: checked.email }])) {
      return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    }

    let store;
    if (storeId) {
      store = await fdb.getById('stores', storeId);
      if (!store) return res.status(404).json({ error: 'Magasin introuvable.' });
    } else {
      const newStoreId = await fdb.add('stores', { name: storeName });
      store = await fdb.getById('stores', newStoreId);
    }

    const account = await createAccount({ ...checked, role: ROLE_STORE_ADMIN, storeId: store.id });
    await logEvent(null, 'info', `Admin magasin créé : ${checked.email} (${store.name})`, null);
    res.status(201).json({ account: publicAccount(account), store: { id: store.id, name: store.name } });
  } catch (error) {
    console.error('Create store admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
}

/** PATCH /admin/accounts/:id  { disabled } — enable or disable a store admin. */
async function setStoreAdminDisabled(req, res) {
  const disabled = parseDisabled(req.body?.disabled);
  if (disabled === null) return res.status(400).json({ error: 'Champ « disabled » (booléen) requis.' });

  try {
    const target = await fdb.getById('users', req.params.id);
    if (!target || target.role !== ROLE_STORE_ADMIN) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    await fdb.update('users', target.id, { disabled: disabled ? 1 : 0 });
    if (disabled) disconnectUser(target.id);
    res.json({ message: disabled ? 'Compte désactivé.' : 'Compte réactivé.' });
  } catch (error) {
    console.error('Set store admin disabled error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du compte.' });
  }
}

// ─── Store admin ─────────────────────────────────────────────────────────────

/** Loads a user account that belongs to the caller's store, or null. */
async function ownUserAccount(req, id) {
  if (!req.user.storeId) return null;
  const target = await fdb.getById('users', id);
  if (!target || target.role !== ROLE_USER || target.store_id !== req.user.storeId) return null;
  return target;
}

/** GET /store/users — the user accounts of the caller's store. */
async function listStoreUsers(req, res) {
  if (!req.user.storeId) return res.status(403).json({ error: 'Aucun magasin associé à ce compte.' });
  try {
    const users = await fdb.getAll('users', [
      { field: 'store_id', value: req.user.storeId },
      { field: 'role', value: ROLE_USER },
    ], { orderBy: 'created_at', orderDir: 'asc' });
    res.json(users.map(publicAccount));
  } catch (error) {
    console.error('List store users error:', error);
    res.status(500).json({ error: 'Impossible de charger les comptes.' });
  }
}

/** POST /store/users — creates a user account in the caller's store. */
async function createStoreUser(req, res) {
  if (!req.user.storeId) return res.status(403).json({ error: 'Aucun magasin associé à ce compte.' });
  const checked = checkNewAccount(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });

  try {
    if (await fdb.getWhere('users', [{ field: 'email', value: checked.email }])) {
      return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    }
    const account = await createAccount({ ...checked, role: ROLE_USER, storeId: req.user.storeId });
    res.status(201).json({ account: publicAccount(account) });
  } catch (error) {
    console.error('Create store user error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
}

/** PATCH /store/users/:id  { disabled } */
async function setStoreUserDisabled(req, res) {
  const disabled = parseDisabled(req.body?.disabled);
  if (disabled === null) return res.status(400).json({ error: 'Champ « disabled » (booléen) requis.' });

  try {
    const target = await ownUserAccount(req, req.params.id);
    if (!target) return res.status(404).json({ error: 'Compte introuvable.' });
    await fdb.update('users', target.id, { disabled: disabled ? 1 : 0 });
    if (disabled) disconnectUser(target.id);
    res.json({ message: disabled ? 'Compte désactivé.' : 'Compte réactivé.' });
  } catch (error) {
    console.error('Set store user disabled error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du compte.' });
  }
}

/** DELETE /store/users/:id */
async function deleteStoreUser(req, res) {
  try {
    const target = await ownUserAccount(req, req.params.id);
    if (!target) return res.status(404).json({ error: 'Compte introuvable.' });
    await fdb.delete('users', target.id);
    disconnectUser(target.id);
    res.json({ message: 'Compte supprimé.' });
  } catch (error) {
    console.error('Delete store user error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte.' });
  }
}

module.exports = {
  listStores,
  createStoreAdmin,
  setStoreAdminDisabled,
  listStoreUsers,
  createStoreUser,
  setStoreUserDisabled,
  deleteStoreUser,
};
