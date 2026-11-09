import { Component } from 'react';
import { TriangleAlert, RefreshCw } from 'lucide-react';
import Button from './Button';

/** Catches render errors so a bug in one page never leaves the user on a blank screen. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-danger/10 text-danger">
            <TriangleAlert className="size-7" />
          </div>
          <h1 className="font-display text-xl font-extrabold">Une erreur est survenue</h1>
          <p className="mt-2 text-sm text-muted">
            L'affichage a rencontré un problème inattendu. Vos données ne sont pas affectées.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <Button variant="primary" icon={RefreshCw} onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
