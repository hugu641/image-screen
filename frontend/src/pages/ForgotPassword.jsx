import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { api } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';

export default function ForgotPassword() {
  useDocumentTitle('Mot de passe oublié');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot', { email });
      setMessage(res.message);
    } catch (err) {
      setError(err.message || 'Demande impossible. Réessayez plus tard.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-extrabold">Mot de passe oublié</h1>
        <p className="mt-2 text-sm text-muted">Saisissez votre email : si un compte existe, nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
        {message ? (
          <p role="status" className="mt-6 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-medium text-success">{message}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email" required>
              {(p) => <Input {...p} icon={Mail} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            {error && <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>Envoyer le lien</Button>
          </form>
        )}
        <p className="mt-6 text-center text-[13px]">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"><ArrowLeft className="size-4" />Retour à la connexion</Link>
        </p>
      </Card>
    </main>
  );
}
