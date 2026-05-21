import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

declare global {
  interface Window {
    __fanteticNavRoot?: Root;
  }
}

const renderBootError = (message: string) => {
  const fallback = document.createElement('pre');
  fallback.style.whiteSpace = 'pre-wrap';
  fallback.style.padding = '16px';
  fallback.style.margin = '16px';
  fallback.style.color = '#ff4d4f';
  fallback.style.background = '#1f1f1f';
  fallback.textContent = `应用启动失败：\n${message}`;

  const host = document.body || document.documentElement;
  if (host) {
    host.appendChild(fallback);
  }
};

const ensureRootContainer = () => {
  const existing = document.getElementById('root');
  if (existing instanceof HTMLElement) {
    return existing;
  }

  const host = document.body || document.documentElement;
  if (!host) {
    throw new Error('页面容器尚未就绪');
  }

  const container = document.createElement('div');
  container.id = 'root';
  host.appendChild(container);
  return container;
};

const mountApp = () => {
  try {
    const container = ensureRootContainer();
    if (!window.__fanteticNavRoot) {
      window.__fanteticNavRoot = createRoot(container);
    }

    if (container.dataset.appMounted === '1') {
      return;
    }

    container.dataset.appMounted = '1';
    window.__fanteticNavRoot.render(<App />);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('App bootstrap failed:', error);
    renderBootError(message);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp, { once: true });
} else {
  mountApp();
}

serviceWorker.unregister();
