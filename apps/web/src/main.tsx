import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './lib/AppProvider';
import { ToastProvider } from './components/Toast';
import { BASE_URL } from './lib/env';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Registered after paint so a service-worker failure can never block the app
// from starting — the offline draft path matters more than the cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE_URL}sw.js`.replace(/\/{2,}/g, '/')).catch(() => {
      // Offline caching is an enhancement; the app works without it.
    });
  });
}
