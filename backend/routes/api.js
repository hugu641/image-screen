const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const accountController = require('../controllers/accountController');
const mediaController = require('../controllers/mediaController');
const playlistController = require('../controllers/playlistController');
const screenController = require('../controllers/screenController');
const settingsController = require('../controllers/settingsController');
const eventController = require('../controllers/eventController');
const licenseController = require('../controllers/licenseController');
const passwordController = require('../controllers/passwordController');

// ─── Rate limiting ───────────────────────────────────────────────────────────
const limiter = (windowMs, limit, error, extra = {}) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error },
  ...extra,
});

// Brute-force protection: failed logins are limited per IP, successes are not counted
const loginLimiter = limiter(15 * 60 * 1000, 10, 'Trop de tentatives de connexion. Réessayez dans 15 minutes.', {
  skipSuccessfulRequests: true,
});
const registerLimiter = limiter(60 * 60 * 1000, 10, "Trop de créations de compte. Réessayez plus tard.");
const uploadLimiter = limiter(10 * 60 * 1000, 30, 'Trop de téléversements. Patientez quelques minutes.');
const licenseLimiter = limiter(15 * 60 * 1000, 10, 'Trop de tentatives. Réessayez plus tard.');
const apiLimiter = limiter(60 * 1000, 600, 'Trop de requêtes. Ralentissez un instant.');

router.use(apiLimiter);

// ─── Role guards (run after authMiddleware, which sets req.user) ─────────────
// super-admin: manages store admins, never reads store content
function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.role === 'superadmin') return next();
  res.status(403).json({ error: 'Accès réservé au super-administrateur.' });
}
// store admin: manages the user accounts and settings of its own store
function requireStoreAdmin(req, res, next) {
  if (req.user && req.user.role === 'storeadmin' && req.user.storeId) return next();
  res.status(403).json({ error: "Accès réservé à l'administrateur du magasin." });
}
// any account bound to a store (store admins and users): access to the store's content
function requireStore(req, res, next) {
  if (req.user && req.user.storeId) return next();
  res.status(403).json({ error: 'Cet espace est réservé aux comptes rattachés à un magasin.' });
}

// Health check (used by the native apps to validate a server URL)
router.get('/health', (req, res) => res.json({ ok: true, app: 'imagescreen' }));

// Authentication Routes
router.get('/auth/status', authController.status);
// Public registration exists only for the very first account (becomes super-admin)
router.post('/auth/register', registerLimiter, authController.register);
router.post('/auth/login', loginLimiter, authController.login);
// Reset link by email (rate limited per IP: one email per address and per IP is enough)
const forgotLimiter = limiter(60 * 60 * 1000, 5, 'Trop de demandes. Réessayez plus tard.');
router.post('/auth/forgot', forgotLimiter, passwordController.forgotPassword);
router.post('/auth/reset', loginLimiter, passwordController.resetPassword);
router.get('/auth/me', authController.authMiddleware, authController.me);
router.put('/auth/update-password', loginLimiter, authController.authMiddleware, authController.updatePassword);

// Account management
router.get('/admin/stores', authController.authMiddleware, requireSuperAdmin, accountController.listStores);
router.post('/admin/stores', authController.authMiddleware, requireSuperAdmin, accountController.createStoreAdmin);
router.patch('/admin/accounts/:id', authController.authMiddleware, requireSuperAdmin, accountController.setStoreAdminDisabled);

router.get('/store/users', authController.authMiddleware, requireStoreAdmin, accountController.listStoreUsers);
router.post('/store/users', authController.authMiddleware, requireStoreAdmin, accountController.createStoreUser);
router.patch('/store/users/:id', authController.authMiddleware, requireStoreAdmin, accountController.setStoreUserDisabled);
router.delete('/store/users/:id', authController.authMiddleware, requireStoreAdmin, accountController.deleteStoreUser);

// Media Library Routes
// Upload route uses its own Multer multipart parser inside the controller
router.post('/media/upload', uploadLimiter, authController.authMiddleware, requireStore, mediaController.uploadMedia);
router.get('/media/usage', authController.authMiddleware, requireStore, mediaController.mediaUsage);
router.get('/media', authController.authMiddleware, requireStore, mediaController.listMedia);
router.put('/media/:id/rename', authController.authMiddleware, requireStore, mediaController.renameMedia);
router.delete('/media/:id', authController.authMiddleware, requireStore, mediaController.deleteMedia);

// Playlists Routes
router.get('/playlists', authController.authMiddleware, requireStore, playlistController.listPlaylists);
router.post('/playlists', authController.authMiddleware, requireStore, playlistController.createPlaylist);
router.get('/playlists/:id', authController.authMiddleware, requireStore, playlistController.getPlaylist);
router.put('/playlists/:id', authController.authMiddleware, requireStore, playlistController.updatePlaylist);
router.delete('/playlists/:id', authController.authMiddleware, requireStore, playlistController.deletePlaylist);
router.post('/playlists/:id/duplicate', authController.authMiddleware, requireStore, playlistController.duplicatePlaylist);

// Screen Management Routes
router.get('/screens', authController.authMiddleware, requireStore, screenController.listScreens);
router.post('/screens/associate', authController.authMiddleware, requireStore, screenController.associateScreen);
router.put('/screens/:id/rename', authController.authMiddleware, requireStore, screenController.renameScreen);
router.delete('/screens/:id', authController.authMiddleware, requireStore, screenController.deleteScreen);
router.put('/screens/:id/assign-playlist', authController.authMiddleware, requireStore, screenController.assignPlaylist);
router.post('/screens/:id/sync', authController.authMiddleware, requireStore, screenController.triggerSync);

// Settings Routes
// Read: public (TV players pass ?screenId=, logged-in users get their store's settings)
router.get('/settings', settingsController.getSettings);
router.put('/settings', authController.authMiddleware, requireStoreAdmin, settingsController.updateSettings);

// Event Logs Routes
router.get('/events', authController.authMiddleware, requireStore, eventController.listEvents);

// ── License Key Routes ───────────────────────────────────────────────────────
// Super-admin: gérer les clés
router.post('/admin/keys', authController.authMiddleware, requireSuperAdmin, licenseController.createKey);
router.get('/admin/keys', authController.authMiddleware, requireSuperAdmin, licenseController.listKeys);
router.patch('/admin/keys/:id/revoke', authController.authMiddleware, requireSuperAdmin, licenseController.revokeKey);
router.delete('/admin/keys/:id', authController.authMiddleware, requireSuperAdmin, licenseController.deleteKey);
router.get('/admin/stats', authController.authMiddleware, requireSuperAdmin, licenseController.getStats);

// User: activer une clé
router.post('/license/redeem', licenseLimiter, authController.authMiddleware, licenseController.redeemKey);

module.exports = router;
