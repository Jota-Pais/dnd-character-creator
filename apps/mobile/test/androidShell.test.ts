import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import config, { MIN_WEBVIEW_VERSION, PRODUCTION_URL } from '../capacitor.config'

// A casca do APK (docs/app-android.md): o que, se escorregar, quebra o app da turma sem nenhum
// teste do site perceber.
const mobile = path.resolve(__dirname, '..')
const web = path.resolve(mobile, '../web')
const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf8')
const androidMain = path.join(mobile, 'android/app/src/main')

describe('o APK abre o site publicado', () => {
  it('a origem é a de sempre: as fichas moram nela', () => {
    expect(PRODUCTION_URL).toBe('https://dnd-character-creator-gamma.vercel.app')
    expect(config.server?.url).toBe(PRODUCTION_URL)
    expect(config.server?.androidScheme).toBe('https')
  })

  it('só o site navega dentro do app, e nada sem criptografia', () => {
    expect(config.server?.allowNavigation).toEqual(['dnd-character-creator-gamma.vercel.app'])
    expect(config.server?.cleartext).toBe(false)
    expect(read(androidMain, 'AndroidManifest.xml')).toContain('android:usesCleartextTraffic="false"')
  })

  it('a página de erro existe no webDir e pede o mesmo WebView mínimo da configuração', () => {
    const page = read(mobile, config.webDir!, config.server!.errorPath!)
    expect(page).toContain(`var MIN_WEBVIEW_VERSION = ${MIN_WEBVIEW_VERSION}`)
    expect(config.android?.minWebViewVersion).toBe(MIN_WEBVIEW_VERSION)
    // O "Tentar de novo" navega para o caminho que a casca nativa entende.
    const shell = read(androidMain, 'java/io/github/jotapais/forja/NativeShellPlugin.java')
    const retryPath = /RETRY_PATH = "([^"]+)"/.exec(shell)?.[1]
    expect(retryPath).toBeDefined()
    expect(page).toContain(`window.location.href = '${retryPath}'`)
  })
})

describe('o APK tem a cara do app instalável', () => {
  const manifest = JSON.parse(read(web, 'public/manifest.webmanifest'))
  const strings = read(androidMain, 'res/values/strings.xml')

  it('o nome e o nome curto são os do PWA', () => {
    expect(config.appName).toBe(manifest.name)
    expect(strings).toContain(`<string name="app_name">${manifest.name}</string>`)
    expect(strings).toContain(`<string name="title_activity_main">${manifest.short_name}</string>`)
  })

  it('o fundo da abertura, da janela e do WebView é o do tema', () => {
    const background = manifest.background_color.toLowerCase()
    expect(config.backgroundColor?.toLowerCase()).toBe(background)
    const styles = read(androidMain, 'res/values/styles.xml')
    expect(/<color name="forja_background">([^<]+)<\/color>/.exec(styles)?.[1].toLowerCase()).toBe(background)
  })
})

describe('versão do APK', () => {
  it('o mínimo publicado pelo site nunca passa do APK de agora (senão o mais novo se acharia velho)', () => {
    const min = JSON.parse(read(web, 'public/app-version.json')).android.minVersionCode
    const gradle = read(mobile, 'android/app/build.gradle')
    const versionCode = Number(/def forjaVersionCode = (\d+)/.exec(gradle)?.[1])
    expect(Number.isInteger(versionCode)).toBe(true)
    expect(versionCode).toBeGreaterThanOrEqual(min)
  })
})
