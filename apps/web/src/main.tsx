import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { startServiceWorker } from './core/pwa/serviceWorker'
import { startNativeApp } from './core/native/nativeApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// O app instalável e sem rede (docs/app-instalavel.md): só no build de produção.
void startServiceWorker({
  isProd: import.meta.env.PROD,
  container: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  whenLoaded: document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(resolve => window.addEventListener('load', resolve, { once: true })),
  doc: document,
})

// O APK do Android (docs/app-android.md): o voltar do aparelho. No navegador, nada.
void startNativeApp()
