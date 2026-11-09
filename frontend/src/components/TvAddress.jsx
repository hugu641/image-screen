import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { getServerUrl } from '../services/serverConfig';
import { useToast } from './ui/Toast';

/** Shows the address to open on a TV, with a copy button when the browser allows it. */
export default function TvAddress({ className }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const url = `${getServerUrl()}/tv`;
  const isLoopback = /\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copie impossible : sélectionnez l’adresse manuellement.');
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 py-1.5 pl-3.5 pr-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-brand select-all">{url}</code>
        {navigator.clipboard && (
          <button
            type="button"
            onClick={copy}
            aria-label="Copier l’adresse"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-fg"
          >
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </button>
        )}
      </div>
      {isLoopback && (
        <p className="mt-2 text-xs text-warning">
          Sur la TV, remplacez <b>localhost</b> par l’adresse IP de ce serveur sur le réseau (ex. 192.168.1.50).
        </p>
      )}
    </div>
  );
}
