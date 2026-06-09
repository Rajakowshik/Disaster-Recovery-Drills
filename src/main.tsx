import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign HMR/Websocket connection errors in sandboxed preview environments
if (typeof window !== 'undefined') {
  const isWsError = (msg: string) => {
    const lowercase = (msg || '').toLowerCase();
    return lowercase.includes('websocket') || lowercase.includes('ws://') || lowercase.includes('wss://');
  };

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (isWsError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (isWsError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
