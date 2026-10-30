import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { startServiceWorker } from './core/pwa/serviceWorker'
import { refuseAutomaticInstallOffer } from './core/pwa/platform'
import { isNativeApp, startNativeApp } from './core/native/nativeApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// O app instalável e sem rede (docs/app-instalavel.md): só no build de produção. No APK, a versão
// nova também entra sozinha na volta à galeria (docs/app-android.md).
void startServiceWorker({
  isProd: import.meta.env.PROD,
  container: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  whenLoaded: document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(resolve => window.addEventListener('load', resolve, { once: true })),
  doc: document,
  native: isNativeApp(),
})

// No Android, o app é o APK: o Chrome não oferece sozinho instalar o site como um segundo app.
refuseAutomaticInstallOffer(window, isNativeApp())

// O APK do Android (docs/app-android.md): o voltar do aparelho e o aviso de APK velho. No navegador, nada.
void startNativeApp()
