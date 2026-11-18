import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './shared/styles.css';
import { initializeNativeAuth } from './features/auth/nativeAuthRuntime.js';
import { Capacitor } from '@capacitor/core';

// Let Android reserve system bars and keyboard space around the WebView.
// Web browsers keep viewport-fit=cover and their existing safe-area CSS.
if (Capacitor.getPlatform() === 'android') {
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1.0');
}

// Cold-start code exchange finishes before AuthProvider reads the stored session.
const startupMessage = document.createElement('p');
startupMessage.textContent = 'CrewFit을 준비하고 있어요…';
startupMessage.setAttribute('role', 'status');
startupMessage.style.cssText = 'padding:32px;text-align:center;color:#425c52';
document.getElementById('root').appendChild(startupMessage);
initializeNativeAuth().catch(() => {}).finally(() => {
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
});
