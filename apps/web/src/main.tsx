import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { App } from './App';
import { posthog } from './lib/posthog';

window.addEventListener('unhandledrejection', (event) => {
  posthog.captureException(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
