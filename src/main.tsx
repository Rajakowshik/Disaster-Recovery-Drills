import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign HMR/Websocket connection errors in sandboxed preview environments
if (typeof window !== 'undefined') {
  const isWsError = (msg: string) => {
    const lowercase = (msg || '').toLowerCase();
    return lowercase.includes('websocket') || lowercase.includes('ws://') || lowercase.includes('wss://') || lowercase.includes('hmr');
  };

  // 1. Intercept console.error to prevent noisy connection logs from Vite
  const originalConsoleError = window.console.error;
  window.console.error = function (...args: any[]) {
    const msg = args.map(arg => String(arg || '')).join(' ');
    if (isWsError(msg)) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // 2. Suppress unhandled promise rejections related to WebSocket failures
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (isWsError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // 3. Suppress general runtime window errors related to WebSockets
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (isWsError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // 4. Monkey-patch the browser's native WebSocket to short-circuit HMR connections safely
  const OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) {
    const ProxyWebSocket = function (this: any, url: string | URL, protocols?: string | string[]) {
      const isViteHmr = (
        protocols === 'vite-hmr' ||
        (Array.isArray(protocols) && protocols.includes('vite-hmr')) ||
        (typeof url === 'string' && (url.includes('vite-hmr') || url.includes('/vite')))
      );

      if (isViteHmr) {
        // Return a mock WebSocket object that silently stays in a closed state
        const self: any = {
          url: String(url),
          readyState: OriginalWebSocket.CLOSED,
          bufferedAmount: 0,
          extensions: '',
          protocol: '',
          binaryType: 'blob',
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          send: () => {},
          close: () => {},
          addEventListener: (type: string, listener: any) => {
            if (type === 'close') {
              setTimeout(() => {
                const event = { type: 'close', wasClean: true, code: 1005, reason: 'HMR silent override' };
                if (self.onclose) {
                  try { self.onclose(event); } catch (e) {}
                }
                if (listener) {
                  try { listener(event); } catch (e) {}
                }
              }, 50);
            }
          },
          removeEventListener: () => {},
          dispatchEvent: () => true,
        };
        return self;
      }

      return Reflect.construct(OriginalWebSocket, [url, protocols]);
    };

    ProxyWebSocket.prototype = OriginalWebSocket.prototype;
    Object.setPrototypeOf(ProxyWebSocket, OriginalWebSocket);
    window.WebSocket = ProxyWebSocket as any;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
