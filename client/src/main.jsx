import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { InstallPrompt } from './components/pwa/InstallPrompt.jsx';
import App from './App.jsx';
import { MaintenanceBanner } from './components/MaintenanceBanner.jsx';
import { SignOutHost } from './components/ui/SignOutOverlay.jsx';
import './index.css';
import { API_URL } from './config/env.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { installGlobalErrorHandlers } from './utils/errorReporter.js';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fullPage>
    <ThemeProvider>
      <BrowserRouter>
        <MaintenanceBanner />
        <App />
        {/* Inside the router: its spinner reads the current path to pick a logo. */}
        <SignOutHost />
      </BrowserRouter>
      <InstallPrompt />
    </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Wake the server (and its database) while the page is still loading, so
// the first real request does not have to wait for a cold start.
fetch(`${API_URL}/health`, { cache: 'no-store' }).catch(() => {});

// Service worker only in production builds, so dev hot-reload is never cached.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* app works without it */ });
  });
}
