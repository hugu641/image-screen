const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { fdb } = require('../database/db');
const { compressImageBuffer } = require('../services/compressionService');
const { logEvent } = require('../services/socketService');
const { UPLOADS_DIR } = require('../config/paths');
const { detectFileType, imageSizeIsSafe, sanitizeDisplayName } = require('../services/fileValidation');

// ─── Multer : stockage en mémoire ───────────────────────────────────────────
// The declared Content-Type is NOT trusted (clients often send application/octet-stream and
// attackers can send anything): the real type is detected from the file content below.
// Files are held in memory (needed for image compression): keep the worst case small.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 5, fields: 5, fieldSize: 1024 } // 100 MB per file, 5 files max
}).array('files', 5);

// ─── Controller functions ─────────────────────────────────────────────────────

async function uploadMedia(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier sélectionné.' });
    }

    const uploadedItems = [];

    try {
      const uploadsDir = UPLOADS_DIR;
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Storage quota (disk-filling protection)
      const maxBytes = (Number(process.env.MAX_STORAGE_MB) || 20480) * 1024 * 1024;
      const incoming = req.files.reduce((n, f) => n + f.size, 0);
      if ((await fdb.sumMediaSize()) + incoming > maxBytes) {
        return res.status(413).json({ error: "Espace de stockage plein. Supprimez des médias avant d'en ajouter." });
      }

      for (const file of req.files) {
        // The type is decided by the file CONTENT, not by what the client declared
        const detected = detectFileType(file.buffer);
        if (!detected) {
          return res.status(400).json({
            error: `« ${sanitizeDisplayName(file.originalname)} » n'est pas un fichier JPG, PNG, WEBP ou MP4 valide.`
          });
        }
        if (detected.kind === 'image' && !imageSizeIsSafe(file.buffer, detected.mime)) {
          return res.status(400).json({
            error: `L'image « ${sanitizeDisplayName(file.originalname)} » est illisible ou trop grande en dimensions.`
          });
        }
      }

      for (const file of req.files) {
        const detected = detectFileType(file.buffer);
        let mime = detected.mime;
        let ext = detected.ext;
        let buffer = file.buffer;
        let size = file.size;

        // Compression en mémoire pour les images
        if (detected.kind === 'image') {
          const compressed = await compressImageBuffer(buffer, mime);
          if (compressed) {
            buffer = compressed;
            size = compressed.length;
            mime = 'image/jpeg'; // the compressor always outputs JPEG
            ext = '.jpg';
          }
        }

        // Server-generated name: random, extension from the detected type only
        const filename = `file-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        const uploadPath = path.join(uploadsDir, filename);
        await fs.promises.writeFile(uploadPath, buffer, { mode: 0o644 });

        // Enregistrer en SQLite (filepath = chemin relatif /uploads/...)
        const publicUrl = `/uploads/${filename}`;
        const displayName = sanitizeDisplayName(file.originalname);
        const mediaId = await fdb.add('media', {
          filename,
          original_name: displayName,
          mime_type: mime,
          size,
          filepath: publicUrl
        });

        const newMedia = await fdb.getById('media', mediaId);
        uploadedItems.push(newMedia);

        await logEvent(null, 'info', `Média ajouté : ${displayName}`);
      }

      res.status(201).json({
        message: `${uploadedItems.length} fichier(s) téléversé(s) avec succès.`,
        media: uploadedItems
      });
    } catch (storageError) {
      console.error('Storage upload error:', storageError);
      res.status(500).json({ error: "Une erreur est survenue lors de l'enregistrement des fichiers." });
    }
  });
}

async function listMedia(req, res) {
  const { search, sort } = req.query;

  try {
    let orderField = 'created_at';
    let orderDir = 'desc';

    if (sort === 'oldest') { orderField = 'created_at'; orderDir = 'asc'; }
    else if (sort === 'name_asc') { orderField = 'original_name'; orderDir = 'asc'; }
    else if (sort === 'name_desc') { orderField = 'original_name'; orderDir = 'desc'; }

    let mediaList = await fdb.getAll('media', [], { orderBy: orderField, orderDir });

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
    if (!media) {
      return res.status(404).json({ error: 'Média introuvable.' });
    }

    // Supprimer du disque local
    const filePath = path.join(UPLOADS_DIR, path.basename(String(media.filename)));
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (fsErr) {
      console.warn(`[File System] Could not delete file ${media.filename}:`, fsErr.message);
    }

    // Supprimer de la base SQLite
    await fdb.delete('media', id);
    await logEvent(null, 'info', `Média supprimé : ${media.original_name}`);

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
    if (!media) {
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
  uploadMedia,
  listMedia,
  deleteMedia,
  renameMedia
};
