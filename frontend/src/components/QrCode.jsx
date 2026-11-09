import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code rendered locally (no third-party service: the pairing code never leaves the
 * device, and it also works offline).
 */
export default function QrCode({ value, alt = 'QR code', className = '', size = 240 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(String(value), { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(''); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!src) return <div className={className} aria-hidden="true" />;
  return <img src={src} alt={alt} className={`bg-white rounded-lg p-1 ${className}`} />;
}
