const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { fdb } = require('../database/db');
const { compressImageBuffer } = require('../services/compressionService');
const { logEvent } = require('../services/socketService');
const { UPLOADS_DIR } = require('../config/paths');
const { detectFileType, imageSizeIsSafe, sanitizeDisplayName } = require('../services/fileValidation');

const MB = 1024 * 1024;
// Videos are streamed to disk chunk by chunk, so they can be large (default 5 Go).
// Images are compressed in memory, so they keep a small limit (default 50 Mo).
const MAX_VIDEO_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 5120) * MB;
const MAX_IMAGE_BYTES = (Number(process.env.MAX_IMAGE_MB) || 50) * MB;
const MAX_FILES_PER_UPLOAD = 5;
const HEAD_BYTES = 64 * 1024; // enough to recognise every accepted type
const INCOMING = '.incoming'; // per-store folder for uploads in progress

const quotaBytes = () => (Number(process.env.MAX_STORAGE_MB) || 20480) * MB;

function formatSize(bytes) {
  return bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1).replace(/\.0$/, '')} Go` : `${Math.round(bytes / MB)} Mo`;
}

class UploadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ─── Multer : écriture directe sur le disque ────────────────────────────────
// The file is written to disk as it arrives, never held in memory: a 5 Go video uses the
// same memory as a 5 Mo one. The declared Content-Type is NOT trusted: the real type is
// detected from the content.
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(UPLOADS_DIR, req.user.storeId, INCOMING);
      fs.mkdir(dir, { recursive: true, mode: 0o700 }, (err) => cb(err, dir));
    },
    filename(req, file, cb) {
      cb(null, crypto.randomBytes(16).toString('hex') + '.part');
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: MAX_FILES_PER_UPLOAD, fields: 5, fieldSize: 1024 },
}).array('files', MAX_FILES_PER_UPLOAD);

async function removeTempFiles(files = []) {
  await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => {})));
}

/** Reads only the first bytes of a file, enough to recognise its real type. */
async function readHead(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Removes the leftovers of uploads interrupted by a crash or a closed connection (at startup). */
async function cleanIncoming() {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  for (const entry of fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    fs.rmSync(path.join(UPLOADS_DIR, entry.name, INCOMING), { recursive: true, force: true });
  }
}

// ─── Controller functions ─────────────────────────────────────────────────────

async function uploadMedia(req, res) {
  const storeId = req.user.storeId;

  // Refuse early when the announced size cannot fit in the store's quota
  const used = await fdb.sumMediaSize(storeId);
  const announced = Number(req.headers['content-length']) || 0;
  if (announced && used + announced > quotaBytes()) {
    return res.status(413).json({ error: "Espace de stockage plein. Supprimez des médias avant d'en ajouter." });
  }

  upload(req, res, async (err) => {
    if (err) {
      await removeTempFiles(req.files);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Fichier trop volumineux (maximum ${formatSize(MAX_VIDEO_BYTES)} par fichier).` });
      }
      return res.status(400).json({ error: 'Téléversement invalide.' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier sélectionné.' });
    }

    const uploadsDir = path.join(UPLOADS_DIR, storeId);
    try {
      // 1. Check every file before storing any of them
      const checked = [];
      for (const file of files) {
        const name = sanitizeDisplayName(file.originalname);
        const detected = detectFileType(await readHead(file.path));
        if (!detected) {
          throw new UploadError(400, `« ${name} » n'est pas un fichier JPG, PNG, WEBP ou MP4 valide.`);
        }
        if (detected.kind === 'image') {
          if (file.size > MAX_IMAGE_BYTES) {
            throw new UploadError(400, `L'image « ${name} » dépasse ${formatSize(MAX_IMAGE_BYTES)}.`);
          }
          const buffer = await fs.promises.readFile(file.path);
          if (!imageSizeIsSafe(buffer, detected.mime)) {
            throw new UploadError(400, `L'image « ${name} » est illisible ou trop grande en dimensions.`);
          }
          checked.push({ file, detected, name, buffer });
        } else {
          checked.push({ file, detected, name });
        }
      }

      const incoming = checked.reduce((n, c) => n + c.file.size, 0);
      if ((await fdb.sumMediaSize(storeId)) + incoming > quotaBytes()) {
        throw new UploadError(413, "Espace de stockage plein. Supprimez des médias avant d'en ajouter.");
      }

      // 2. Store them in the store's folder under server-generated names
      await fs.promises.mkdir(uploadsDir, { recursive: true, mode: 0o700 });
      const uploadedItems = [];
      for (const c of checked) {
        let mime = c.detected.mime;
        let ext = c.detected.ext;
        let size = c.file.size;
        const base = `file-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

        let compressed = null;
        if (c.detected.kind === 'image') {
          // Compression is done in memory (images are small by construction)
          compressed = await compressImageBuffer(c.buffer, mime);
        }
        if (compressed) {
          mime = 'image/jpeg'; // the compressor always outputs JPEG
          ext = '.jpg';
          size = compressed.length;
          await fs.promises.writeFile(path.join(uploadsDir, base + ext), compressed, { mode: 0o644 });
          await removeTempFiles([c.file]);
        } else {
          // Moved, not copied: a large video is never written twice
          await fs.promises.rename(c.file.path, path.join(uploadsDir, base + ext));
          await fs.promises.chmod(path.join(uploadsDir, base + ext), 0o644);
        }

        const filename = base + ext;
        const displayName = c.name;
        const mediaId = await fdb.add('media', {
          filename,
          original_name: displayName,
          mime_type: mime,
          size,
          filepath: `/uploads/${storeId}/${filename}`,
          store_id: storeId,
        });
        uploadedItems.push(await fdb.getById('media', mediaId));
        await logEvent(null, 'info', `Média ajouté : ${displayName}`, storeId);
      }

      res.status(201).json({
        message: `${uploadedItems.length} fichier(s) téléversé(s) avec succès.`,
        media: uploadedItems
      });
    } catch (error) {
      await removeTempFiles(files);
      if (error instanceof UploadError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Storage upload error:', error);
      res.status(500).json({ error: "Une erreur est survenue lors de l'enregistrement des fichiers." });
    }
  });
}

// Storage used vs. the configured quota (MAX_STORAGE_MB), for the usage gauge in the UI
async function mediaUsage(req, res) {
  try {
    const used = await fdb.sumMediaSize(req.user.storeId);
    const max = (Number(process.env.MAX_STORAGE_MB) || 20480) * 1024 * 1024;
    res.json({ used, max });
  } catch (error) {
    console.error('Media usage error:', error);
    res.status(500).json({ error: "Impossible de calculer l'espace utilisé." });
  }
}

async function listMedia(req, res) {
  const { search, sort } = req.query;

  try {
    let orderField = 'created_at';
    let orderDir = 'desc';

    if (sort === 'oldest') { orderField = 'created_at'; orderDir = 'asc'; }
    else if (sort === 'name_asc') { orderField = 'original_name'; orderDir = 'asc'; }
    else if (sort === 'name_desc') { orderField = 'original_name'; orderDir = 'desc'; }

    let mediaList = await fdb.getAll('media', [{ field: 'store_id', value: req.user.storeId }], { orderBy: orderField, orderDir });

    if (search) {
      const searchLower = search.toLowerCase();
      mediaList = mediaList.filter(m =>
        m.original_name && m.original_name.toLowerCase().includes(searchLower)
      );
    }

    res.json(mediaList);
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({ error: 'Impossible de récupérer la bibliothèque de médias.' });
  }
}

async function deleteMedia(req, res) {
  const { id } = req.params;

  try {
    const media = await fdb.getById('media', id);
    if (!media || media.store_id !== req.user.storeId) {
      return res.status(404).json({ error: 'Média introuvable.' });
    }

    // Supprimer du disque local
    // filepath is "/uploads/<storeId>/<file>" (or "/uploads/<file>" for files from before the split)
    const relative = String(media.filepath || '').replace(/^\/uploads\//, '');
    const filePath = path.resolve(UPLOADS_DIR, relative);
    if (!filePath.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
      return res.status(500).json({ error: 'Chemin de fichier invalide.' });
    }
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (fsErr) {
      console.warn(`[File System] Could not delete file ${media.filename}:`, fsErr.message);
    }

    // Supprimer de la base SQLite
    await fdb.delete('media', id);
    await logEvent(null, 'info', `Média supprimé : ${media.original_name}`, req.user.storeId);

    res.json({ message: 'Média supprimé avec succès.' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du média.' });
  }
}

async function renameMedia(req, res) {
  const { id } = req.params;
  const name = typeof req.body?.name === 'string' ? sanitizeDisplayName(req.body.name) : '';

  if (!name) {
    return res.status(400).json({ error: 'Le nom ne peut pas être vide.' });
  }

  try {
    const media = await fdb.getById('media', id);
    if (!media || media.store_id !== req.user.storeId) {
      return res.status(404).json({ error: 'Média introuvable.' });
    }

    const ext = path.extname(media.original_name);
    let newOriginalName = name;
    if (ext && !name.toLowerCase().endsWith(ext.toLowerCase())) {
      newOriginalName = name + ext;
    }

    await fdb.update('media', id, { original_name: newOriginalName });
    res.json({ message: 'Média renommé avec succès.', original_name: newOriginalName });
  } catch (error) {
    console.error('Rename media error:', error);
    res.status(500).json({ error: 'Erreur lors du renommage du média.' });
  }
}

module.exports = {
  mediaUsage,
  uploadMedia,
  listMedia,
  deleteMedia,
  renameMedia,
  cleanIncoming,
};
