/**
 * Upload validation based on file CONTENT (magic bytes), never on the client-provided
 * Content-Type or file name. The stored extension/MIME always come from the detected type.
 */

const MAX_IMAGE_PIXELS = 40 * 1000 * 1000; // 40 megapixels: bigger images are rejected before decoding

/** @returns {{mime: string, ext: string, kind: 'image'|'video'} | null} */
function detectFileType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg', kind: 'image' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: '.png', kind: 'image' };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp', kind: 'image' };
  }
  // MP4 (ISO base media): "ftyp" at offset 4 with a known video brand
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    const OK = ['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'msnv', 'MSNV'];
    if (OK.includes(brand)) return { mime: 'video/mp4', ext: '.mp4', kind: 'video' };
  }
  return null;
}

/** Image width/height read from the header only (no decoding). Returns null if unreadable. */
function imageDimensions(buf, mime) {
  try {
    if (mime === 'image/png') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
      return null;
    }
    if (mime === 'image/webp') {
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8X') {
        return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      }
      if (chunk === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** True when the image is readable and not absurdly large. */
function imageSizeIsSafe(buf, mime) {
  const dims = imageDimensions(buf, mime);
  if (!dims || !dims.width || !dims.height) return false;
  return dims.width * dims.height <= MAX_IMAGE_PIXELS;
}

/** Strip path separators, control characters and over-long names from a display name. */
function sanitizeDisplayName(name) {
  const base = String(name || 'fichier').split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>"'`]/g, '').trim().slice(0, 200);
  return cleaned || 'fichier';
}

module.exports = { detectFileType, imageDimensions, imageSizeIsSafe, sanitizeDisplayName, MAX_IMAGE_PIXELS };
