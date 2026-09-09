import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { AppProviders } from './app/providers';
import { SplashGate } from './app/SplashGate';
import { router } from './app/router';

// Auto-recover from stale lazy chunks after a redeploy: when a dynamic import
// fails because an old hashed chunk (e.g. FinancePage-<hash>.js) is no longer on
// the server, reload once to pull the fresh index + chunk map instead of showing
// "Failed to fetch dynamically imported module". Guarded to avoid reload loops.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'vite-preload-reloaded-at';
  const last = Number(sessionStorage.getItem(KEY) ?? '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <SplashGate>
        <RouterProvider router={router} />
      </SplashGate>
    </AppProviders>
  </StrictMode>,
);
