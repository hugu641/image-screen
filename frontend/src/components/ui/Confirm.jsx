import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { TriangleAlert, Trash2, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation dialog replacing window.confirm():
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Supprimer ?', message: '…', tone: 'danger', confirmLabel: 'Supprimer' })) …
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(options);
  }), []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const danger = state?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        icon={danger ? Trash2 : state?.tone === 'warning' ? TriangleAlert : HelpCircle}
        tone={danger ? 'danger' : state?.tone === 'warning' ? 'warning' : 'primary'}
        title={state?.title}
        description={state?.message}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {state?.cancelLabel || 'Annuler'}
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel || 'Confirmer'}
            </Button>
          </>
        }
      >
        {state?.children || <span className="sr-only">Confirmation requise</span>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
