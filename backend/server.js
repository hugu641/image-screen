const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { initDb } = require('./database/db');
const socketService = require('./services/socketService');
const apiRouter = require('./routes/api');

const app = express();
const server = http.createServer(app);

// ─── Trust Proxy ────────────────────────────────────────────────────────────
// Essential when deployed behind Nginx, Cloudflare, Render, Railway, etc.
// This lets Express read the real client IP from the X-Forwarded-For header.
app.set('trust proxy', true);

// ─── CORS Configuration ──────────────────────────────────────────────────────
// In production, set ALLOWED_ORIGINS in your .env file (comma-separated list).
// Example: ALLOWED_ORIGINS=https://mystore.onrender.com,https://mystore.com
// If not set, all origins are allowed (suitable for local / intranet deployments).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = wildcard

app.use(cors({
  origin: allowedOrigins
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS policy.`));
        }
      }
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Uploads ──────────────────────────────────────────────────────────
// Les fichiers médias sont désormais hébergés sur Firebase Storage.
// Ce bloc n'est conservé que pour la compatibilité avec d'anciens fichiers locaux.
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}

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
