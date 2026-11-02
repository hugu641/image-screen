const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { fdb } = require('../database/db');
const { JWT_SECRET } = require('../config/secrets');

const BCRYPT_COST = 12;
const TOKEN_TTL = '7d';
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^[^\s@]+@[^\s@.]+$/; // allows "x@magasin.local"

// Used to burn the same CPU time when an email is unknown (prevents user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

// Routes a user may call while a password change is still pending
const ALLOWED_WHILE_PASSWORD_CHANGE = new Set(['/auth/me', '/auth/update-password']);

let firstUserLock = false;

function registrationAllowedByConfig() {
  return String(process.env.ALLOW_REGISTRATION || '').toLowerCase() === 'true';
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Le mot de passe est trop long (${MAX_PASSWORD_BYTES} octets maximum).`;
  }
  return null;
}

function signToken(user) {
  return jwt.sign({ userId: user.id, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    mustChangePassword: !!user.must_change_password,
  };
}

// Tells the login page whether to offer account creation
async function status(req, res) {
  try {
    const total = await fdb.count('users');
    res.json({ needsSetup: total === 0, registrationOpen: total === 0 || registrationAllowedByConfig() });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Register a new user. First account on a fresh install = administrator; afterwards only
// when ALLOW_REGISTRATION=true.
async function register(req, res) {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Veuillez saisir un email et un mot de passe.' });
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  const pwdError = validatePassword(password);
  if (pwdError) return res.status(400).json({ error: pwdError });

  // Serialise the "is this the first user?" decision
  if (firstUserLock) {
    return res.status(503).json({ error: 'Initialisation en cours, réessayez dans un instant.' });
  }
  firstUserLock = true;

  try {
    const isFirstUser = (await fdb.count('users')) === 0;
    if (!isFirstUser && !registrationAllowedByConfig()) {
      return res.status(403).json({
        error: "Les inscriptions sont fermées. Demandez un accès à l'administrateur.",
      });
    }

    const existing = await fdb.getWhere('users', [{ field: 'email', value: email }]);
    if (existing) {
      return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);
    const role = isFirstUser ? 'admin' : 'user';
    const newId = await fdb.add('users', {
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      role,
      token_version: 0,
      must_change_password: 0,
    });

    const user = await fdb.getById('users', newId);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la création du compte.' });
  } finally {
    firstUserLock = false;
  }
}

// Authenticate
async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Veuillez saisir un email et un mot de passe.' });
  }

  try {
    const user = await fdb.getWhere('users', [{ field: 'email', value: email }]);
    // Always run one bcrypt comparison so response time does not reveal whether the account exists
    const isMatch = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la connexion.' });
  }
}

// Current user (via middleware)
async function me(req, res) {
  try {
    const user = await fdb.getById('users', req.user.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
}

// Change password: invalidates every previously issued token and returns a fresh one
async function updatePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  const userId = req.user.userId;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  const pwdError = validatePassword(newPassword);
  if (pwdError) return res.status(400).json({ error: pwdError });
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel." });
  }

  try {
    const user = await fdb.getById('users', userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);
    const token_version = (user.token_version || 0) + 1;
    await fdb.update('users', userId, { password: hashedPassword, token_version, must_change_password: 0 });

    const updated = await fdb.getById('users', userId);
    res.json({
      message: 'Mot de passe mis à jour avec succès.',
      token: signToken(updated),
      user: publicUser(updated),
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe.' });
  }
}

/**
 * Verify a raw JWT and return the up-to-date user row (role and revocation come from the
 * database, never from the token). Returns null if the token is invalid or revoked.
 */
async function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const user = await fdb.getById('users', decoded.userId);
    if (!user || (user.token_version || 0) !== (decoded.tv || 0)) return null;
    return user;
  } catch {
    return null;
  }
}

// Express auth middleware
async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Accès refusé. Aucun jeton fourni.' });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Jeton invalide ou expiré. Veuillez vous reconnecter.' });
  }

  if (user.must_change_password && !ALLOWED_WHILE_PASSWORD_CHANGE.has(req.path)) {
    return res.status(403).json({
      error: 'Vous devez changer votre mot de passe avant de continuer.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }

  req.user = { userId: user.id, email: user.email, role: user.role || 'user' };
  next();
}

module.exports = {
  status,
  register,
  login,
  me,
  updatePassword,
  authMiddleware,
  verifyToken,
};
