import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { startServiceWorker } from './core/pwa/serviceWorker'
import { refuseAutomaticInstallOffer } from './core/pwa/platform'
import { isNativeApp, startNativeApp } from './core/native/nativeApp'
import { preloadAfterOpening } from './core/utils/lazyScreen'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const whenLoaded = document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise(resolve => window.addEventListener('load', resolve, { once: true }))
const swContainer = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined

// O app instalável e sem rede (docs/app-instalavel.md): só no build de produção. No APK, a versão
// nova também entra sozinha na volta à galeria (docs/app-android.md).
void startServiceWorker({
  isProd: import.meta.env.PROD,
  container: swContainer,
  whenLoaded,
  doc: document,
  native: isNativeApp(),
})

// As telas sob demanda (o Ordem, a ficha imprimível) descem antes de qualquer troca de versão
// (core/utils/lazyScreen.ts): na primeira visita, quando a abertura termina, sem disputar a rede com
// a primeira tela e as fontes dela; com a página vinda do SW, na hora, do cache dele.
void preloadAfterOpening({ fromServiceWorker: !!swContainer?.controller, whenLoaded, root, fonts: document.fonts })

// No Android, o app é o APK: o Chrome não oferece sozinho instalar o site como um segundo app.
refuseAutomaticInstallOffer(window, isNativeApp())

// O APK do Android (docs/app-android.md): o voltar do aparelho e o aviso de APK velho. No navegador, nada.
void startNativeApp()
