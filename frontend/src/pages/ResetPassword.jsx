import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { api } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, PasswordInput, PasswordMeter } from '../components/ui/Field';

/** Opened from the link in the email: chooses a new password with the one-time token. */
export default function ResetPassword() {
  useDocumentTitle('Nouveau mot de passe');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    try {
      const res = await api.post('/auth/reset', { token, newPassword: password });
      setDone(res.message);
    } catch (err) {
      setError(err.message || 'Lien invalide ou expiré.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-extrabold">Choisissez votre mot de passe</h1>
        {!token ? (
          <p role="alert" className="mt-6 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">Ce lien est incomplet. Ouvrez le lien reçu par email.</p>
        ) : done ? (
          <>
            <p role="status" className="mt-6 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-medium text-success">{done}</p>
            <Link to="/login" className="mt-6 inline-flex w-full justify-center rounded-xl bg-primary px-4 py-3 font-bold text-white hover:opacity-90">Se connecter</Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Nouveau mot de passe" required hint="8 caractères minimum.">
              {(p) => (
                <>
                  <PasswordInput {...p} icon={Lock} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <PasswordMeter value={password} />
                </>
              )}
            </Field>
            <Field label="Confirmer le mot de passe" required>
              {(p) => <PasswordInput {...p} icon={Lock} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}
            </Field>
            {error && <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>Enregistrer</Button>
          </form>
        )}
        <p className="mt-6 text-center text-[13px]">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"><ArrowLeft className="size-4" />Retour à la connexion</Link>
        </p>
      </Card>
    </main>
  );
}
