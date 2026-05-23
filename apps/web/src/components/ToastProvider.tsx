import { Alert, Snackbar } from '@mui/material';
import { createContext, useContext, useState } from 'react';

type Severity = 'success' | 'error';

type ToastFn = (message: string, severity?: Severity) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({ message: '', severity: 'success' as Severity, open: false });

  const show: ToastFn = (message, severity = 'success') => {
    setState({ message, severity, open: true });
  };

  const close = () => setState((s) => ({ ...s, open: false }));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar open={state.open} autoHideDuration={4000} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={state.severity} onClose={close} sx={{ width: '100%' }}>
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
