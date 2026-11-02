const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const helmet = require('helmet');
const { initDb } = require('./database/db');
const { UPLOADS_DIR } = require('./config/paths');
require('./config/secrets'); // fail fast / generate the JWT secret before serving requests
const { parseAllowedOrigins, originOption, trustProxySetting } = require('./config/network');
const socketService = require('./services/socketService');
const apiRouter = require('./routes/api');

const app = express();
const server = http.createServer(app);

// ─── Trust Proxy ────────────────────────────────────────────────────────────
// Only trust X-Forwarded-* headers when TRUST_PROXY is set (e.g. TRUST_PROXY=1 behind
// Caddy/Nginx/Cloudflare). Otherwise clients could spoof their IP address.
app.set('trust proxy', trustProxySetting());
app.disable('x-powered-by');

// ─── Security headers ───────────────────────────────────────────────────────
// CSP: the app is a same-origin SPA. Images come from the server itself or data/blob URLs;
// connections only go back to this server (HTTP + WebSocket). No third-party hosts.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:', 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  // Media must be loadable from the native apps (different origin than the server)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  // HSTS is only meaningful behind HTTPS; the reverse proxy (Caddy) can add it
  hsts: false,
}));

// ─── CORS Configuration ──────────────────────────────────────────────────────
// Authentication uses a Bearer token (no cookies), so a wildcard origin does not expose
// sessions to other sites. In production you can still restrict it with ALLOWED_ORIGINS
// (comma-separated); the native apps' origins are always allowed.
const allowedOrigins = parseAllowedOrigins();

app.use(cors({
  origin: originOption(allowedOrigins),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ─── Static Uploads ──────────────────────────────────────────────────────────
// Uploaded media is served as inert content: never sniffed, never allowed to run scripts.
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR, {
  index: false,
  dotfiles: 'deny',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// ─── REST API ────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Socket.IO ───────────────────────────────────────────────────────────────
socketService.init(server, allowedOrigins);

// ─── Frontend (Production Build) ─────────────────────────────────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  // Serve static assets (JS, CSS, images…)
  app.use(express.static(frontendDist, {
    // Cache assets for 1 week, but never cache the HTML entry point
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));

  // Catch-all: serve React's index.html for client-side routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  console.log('✅  Serving React frontend from production build (dist/).');
} else {
  app.get('/', (req, res) => {
    res.send('🔧  Backend running in development mode. Start the frontend separately with: npm run frontend');
  });
}

// ─── Startup ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  console.log('🔥  Connecting to SQLite Database...');
  await initDb();

  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         ImageScreen — Affichage Dynamique Pro             ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Administration  : http://localhost:${PORT}${''.padEnd(24 - String(PORT).length)}║`);
    console.log(`║  Lecteur TV      : http://localhost:${PORT}/tv${''.padEnd(21 - String(PORT).length)}║`);
    console.log('║  Réseau local    : http://[IP_MACHINE]:' + PORT + '               ║');
    if (process.env.SERVER_URL) {
      console.log(`║  Cloud / Public  : ${process.env.SERVER_URL}`.padEnd(61) + '║');
    }
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(err => {
  console.error('❌  Failed to start server:', err);
  process.exit(1);
});
