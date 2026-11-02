import React, { useEffect, useState } from 'react';
import { getServerUrl } from '../services/serverConfig';
import QrCode from './QrCode';

/**
 * OnboardingTutorial
 * Displays a friendly tutorial for the first time a TV screen connects to the local network.
 * Shows the store name, logo, and a QR code that encodes the pairing code.
 * The QR code links to the admin association page (or just contains the code).
 * The parent component should hide the tutorial after a short delay or when the user dismisses it.
 */
export default function OnboardingTutorial({ storeName, logoUrl, pairingCode, onClose }) {
  const [show, setShow] = useState(true);

  // Auto‑hide after 15 seconds (optional). Users can also click to dismiss.
  useEffect(() => {
    const timer = setTimeout(() => { setShow(false); if (onClose) onClose(); }, 15000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;


  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-8 shadow-xl max-w-md w-full glass-card border border-slate-600">
        <h2 className="text-2xl font-bold text-center text-white mb-4">
          Bienvenue chez {storeName || 'Mon Magasin'}
        </h2>
        {logoUrl && (
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo du magasin" className="h-16 object-contain" />
          </div>
        )}
        <p className="text-center text-slate-300 mb-2">
          Scannez ce QR‑code avec votre appareil mobile pour associer l’écran.
        </p>
        <div className="flex justify-center mb-6">
          <QrCode value={`code=${pairingCode}`} alt="QR code de couplage" className="w-48 h-48" />
        </div>
        <p className="text-center text-slate-300 mb-2">Vous pouvez également vous connecter via le lien suivant :</p>
        <div className="flex justify-center mb-4">
          <a href={`${getServerUrl()}/`} target="_blank" rel="noreferrer" className="text-brand-500 underline">{getServerUrl()}</a>
        </div>
        <div className="text-center">
          <button
            onClick={() => { setShow(false); if (onClose) onClose(); } }
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-sm"
          >
            Commencer
          </button>
        </div>
      </div>
    </div>
  );
}
