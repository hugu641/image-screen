const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const mediaController = require('../controllers/mediaController');
const playlistController = require('../controllers/playlistController');
const screenController = require('../controllers/screenController');
const settingsController = require('../controllers/settingsController');
const eventController = require('../controllers/eventController');
const licenseController = require('../controllers/licenseController');

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

// Admin Middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
}

// Health check (used by the native apps to validate a server URL)
router.get('/health', (req, res) => res.json({ ok: true, app: 'imagescreen' }));

// Authentication Routes
router.get('/auth/status', authController.status);
router.post('/auth/register', registerLimiter, authController.register);
router.post('/auth/login', loginLimiter, authController.login);
router.get('/auth/me', authController.authMiddleware, authController.me);
router.put('/auth/update-password', loginLimiter, authController.authMiddleware, authController.updatePassword);

// Media Library Routes
// Upload route uses its own Multer multipart parser inside the controller
router.post('/media/upload', uploadLimiter, authController.authMiddleware, mediaController.uploadMedia);
router.get('/media', authController.authMiddleware, mediaController.listMedia);
router.put('/media/:id/rename', authController.authMiddleware, mediaController.renameMedia);
router.delete('/media/:id', authController.authMiddleware, mediaController.deleteMedia);

// Playlists Routes
router.get('/playlists', authController.authMiddleware, playlistController.listPlaylists);
router.post('/playlists', authController.authMiddleware, playlistController.createPlaylist);
router.get('/playlists/:id', authController.authMiddleware, playlistController.getPlaylist);
router.put('/playlists/:id', authController.authMiddleware, playlistController.updatePlaylist);
router.delete('/playlists/:id', authController.authMiddleware, playlistController.deletePlaylist);
router.post('/playlists/:id/duplicate', authController.authMiddleware, playlistController.duplicatePlaylist);

// Screen Management Routes
router.get('/screens', authController.authMiddleware, screenController.listScreens);
router.post('/screens/associate', authController.authMiddleware, screenController.associateScreen);
router.put('/screens/:id/rename', authController.authMiddleware, screenController.renameScreen);
router.delete('/screens/:id', authController.authMiddleware, screenController.deleteScreen);
router.put('/screens/:id/assign-playlist', authController.authMiddleware, screenController.assignPlaylist);
router.post('/screens/:id/sync', authController.authMiddleware, screenController.triggerSync);

// Settings Routes
router.get('/settings', settingsController.getSettings); // Accessible by screens for global config
router.put('/settings', authController.authMiddleware, requireAdmin, settingsController.updateSettings);

// Event Logs Routes
router.get('/events', authController.authMiddleware, eventController.listEvents);

// ── License Key Routes ───────────────────────────────────────────────────────
// Admin: gérer les clés
router.post('/admin/keys', authController.authMiddleware, requireAdmin, licenseController.createKey);
router.get('/admin/keys', authController.authMiddleware, requireAdmin, licenseController.listKeys);
router.patch('/admin/keys/:id/revoke', authController.authMiddleware, requireAdmin, licenseController.revokeKey);
router.delete('/admin/keys/:id', authController.authMiddleware, requireAdmin, licenseController.deleteKey);
router.get('/admin/stats', authController.authMiddleware, requireAdmin, licenseController.getStats);

// User: activer une clé
router.post('/license/redeem', licenseLimiter, authController.authMiddleware, licenseController.redeemKey);

module.exports = router;
