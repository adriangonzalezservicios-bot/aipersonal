import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the service worker only in production. This keeps local Vite development
// predictable while enabling installation/offline app-shell behavior on ili.com.ar.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('[PWA] No se pudo registrar el service worker:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
