import { create } from 'zustand'

/**
 * A versão mínima do APK (docs/app-android.md, "Subir a versão"). O APK abre o site publicado,
 * então o site novo chega sozinho; o que só um APK novo traz é a parte nativa (plugin, ícone,
 * Capacitor). Quando o site passa a depender dela, sobe o mínimo em `public/app-version.json`, e
 * o APK mais velho mostra na galeria um aviso discreto para pedir o novo.
 */
export const APP_VERSION_URL = '/app-version.json'

/** O APK aberto é mais velho que o mínimo publicado pelo site. */
export const useNativeVersionStore = create<{ outdated: boolean }>(() => ({ outdated: false }))

/** O `versionCode` mínimo do APK no arquivo publicado (`{ "android": { "minVersionCode": 1 } }`). */
export function readMinAndroidVersionCode(manifest: unknown): number | null {
  if (typeof manifest !== 'object' || manifest === null) return null
  const android = (manifest as { android?: unknown }).android
  if (typeof android !== 'object' || android === null) return null
  const min = (android as { minVersionCode?: unknown }).minVersionCode
  return typeof min === 'number' && Number.isInteger(min) && min > 0 ? min : null
}

/**
 * O `versionCode` do APK aberto, do `App.getInfo().build` (texto, no Android). Ilegível vale
 * null: sem saber a versão, o app não avisa.
 */
export function parseVersionCode(build: string | undefined): number | null {
  if (!build || !/^\d+$/.test(build)) return null
  return Number(build)
}

/** Lê o arquivo publicado sempre da rede: guardado, ele esconderia o mínimo novo. Sem rede, null. */
async function fetchManifest(): Promise<unknown> {
  try {
    const response = await fetch(APP_VERSION_URL, { cache: 'no-store' })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

/**
 * Confere a versão do APK aberto contra o mínimo publicado e liga o aviso da galeria. Sem rede, sem
 * o arquivo ou sem a versão do APK, fica quieto: o aviso só aparece com certeza.
 */
export async function checkNativeVersion(
  getInfo: () => Promise<{ build: string }>,
  readManifest: () => Promise<unknown> = fetchManifest,
): Promise<boolean> {
  const [info, manifest] = await Promise.all([getInfo().catch(() => null), readManifest()])
  const versionCode = parseVersionCode(info?.build)
  const min = readMinAndroidVersionCode(manifest)
  const outdated = versionCode !== null && min !== null && versionCode < min
  useNativeVersionStore.setState({ outdated })
  return outdated
}
