/**
 * Password reset and account invitations, both by a one-time link sent by email.
 * The link carries a random token; only its SHA-256 hash is stored, and it expires.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { fdb } = require('../database/db');
const { normalizeEmail, validatePassword, EMAIL_RE, BCRYPT_COST } = require('./authController');
const { sendMail, mailEnabled, appUrl } = require('../services/mailService');

const RESET_TTL_MS = 60 * 60 * 1000;            // 1 hour
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

const path = require('path');
const GUIDE_PATH = path.join(__dirname, '..', 'assets', 'Guide-ImageScreen.pdf');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Stores a fresh one-time token on the user and returns the raw token. */
async function issueToken(user, ttlMs, purpose) {
  const token = crypto.randomBytes(32).toString('base64url');
  await fdb.update('users', user.id, {
    reset_token_hash: hashToken(token),
    reset_expires_at: new Date(Date.now() + ttlMs).toISOString(),
    reset_purpose: purpose,
  });
  return token;
}

/** Sends the user guide (PDF attached) to a user who has just set their password. */
async function sendGuide(user) {
  return sendMail({
    to: user.email,
    subject: 'ImageScreen : votre guide d\'utilisation',
    text: `Bonjour${user.name ? ' ' + user.name : ''},\n\n` +
      `Votre mot de passe est défini, votre compte ImageScreen est prêt.\n` +
      `Vous trouverez en pièce jointe le guide d'utilisation : rôles, connexion des TV, médiathèque et playlists.\n\n` +
      `Vous pouvez aussi le télécharger depuis le menu de l'application.`,
    attachments: [{ filename: 'Guide-ImageScreen.pdf', path: GUIDE_PATH }],
  });
}

/** Sends the "set your password" email for a new account. Returns true when it was sent. */
async function sendInvitation(user) {
  if (!mailEnabled()) return false;
  const token = await issueToken(user, INVITE_TTL_MS, 'invite');
  const link = appUrl(`/reset?token=${token}`);
  return sendMail({
    to: user.email,
    subject: 'Bienvenue sur ImageScreen : créez votre mot de passe',
    text: `Bonjour${user.name ? ' ' + user.name : ''},\n\n` +
      `Un compte ImageScreen a été créé pour vous.\n` +
      `Choisissez votre mot de passe en ouvrant ce lien (valable 7 jours) :\n${link}\n\n` +
      `Si vous n'attendiez pas ce message, ignorez-le.`,
  });
}

// Always the same answer, so the endpoint does not reveal which emails have an account
const GENERIC_ANSWER = { message: 'Si un compte existe pour cet email, un lien de réinitialisation vient d\'être envoyé.' };

async function forgotPassword(req, res) {
  const email = normalizeEmail(req.body?.email);
  try {
    if (email && EMAIL_RE.test(email) && mailEnabled()) {
      const user = await fdb.getWhere('users', [{ field: 'email', value: email }]);
      if (user && !user.disabled) {
        const token = await issueToken(user, RESET_TTL_MS, 'reset');
        await sendMail({
          to: user.email,
          subject: 'ImageScreen : réinitialisation du mot de passe',
          text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n` +
            `${appUrl(`/reset?token=${token}`)}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe ne change pas.`,
        });
      }
    }
    res.json(GENERIC_ANSWER);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json(GENERIC_ANSWER);
  }
}

async function resetPassword(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const newPassword = req.body?.newPassword;
  if (!token || token.length > 200) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
  const pwdError = validatePassword(newPassword);
  if (pwdError) return res.status(400).json({ error: pwdError });

  try {
    const user = await fdb.getWhere('users', [{ field: 'reset_token_hash', value: hashToken(token) }]);
    const expired = !user || !user.reset_expires_at || Date.parse(user.reset_expires_at) < Date.now();
    if (expired || user.disabled) {
      return res.status(400).json({ error: 'Lien invalide ou expiré. Demandez un nouveau lien.' });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_COST);
    // Revokes every token issued before this change; the link is single use
    await fdb.update('users', user.id, {
      password: hashed,
      token_version: (user.token_version || 0) + 1,
      must_change_password: 0,
      reset_token_hash: null,
      reset_expires_at: null,
      reset_purpose: null,
    });
    // First password of a new account: the user receives the guide
    if (user.reset_purpose === 'invite') {
      try { await sendGuide(user); } catch (err) { console.error('Guide email error:', err.message); }
    }
    res.json({ message: 'Mot de passe enregistré. Vous pouvez vous connecter.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe.' });
  }
}

/** GET /api/guide — the guide for signed-in users (download from the menu). */
function downloadGuide(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.download(GUIDE_PATH, 'Guide-ImageScreen.pdf', (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Guide indisponible.' });
  });
}

module.exports = { forgotPassword, resetPassword, sendInvitation, downloadGuide };
