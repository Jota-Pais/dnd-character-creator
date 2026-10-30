// Gera o APK do Android (docs/app-android.md), da raiz do repositório:
//   npm run apk:release -w @rpg/mobile   (o da turma: assinado, copiado com o nome da versão)
//   npm run apk:debug -w @rpg/mobile     (o de teste; com FORJA_DEV_URL, abre o servidor local)
//
// 1. `cap sync android`: a página de erro (www) e o capacitor.config.json vão para o projeto.
// 2. O Gradle, com um JDK 21 ou mais novo (o Capacitor 8 pede): FORJA_JAVA_HOME, o JAVA_HOME, ou
//    o JDK que vem com o Android Studio.
// 3. O release vai para FORJA_APK_DIR (padrão: a pasta dnd-character-creator-apk ao lado do
//    repositório) como forja-de-herois-<versionName>.apk.
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.resolve(mobileDir, '../..')
const androidDir = path.join(mobileDir, 'android')

const variant = process.argv[2]
if (variant !== 'debug' && variant !== 'release') {
  console.error('Uso: node scripts/apk.mjs debug|release')
  process.exit(1)
}

/** O major do JDK numa pasta (o arquivo `release` dela), ou 0. */
function jdkMajor(home) {
  try {
    const release = fs.readFileSync(path.join(home, 'release'), 'utf8')
    const version = /JAVA_VERSION="(\d+)/.exec(release)
    return version ? Number(version[1]) : 0
  } catch {
    return 0
  }
}

function findJavaHome() {
  const studio = {
    win32: ['C:/Program Files/Android/Android Studio/jbr'],
    darwin: ['/Applications/Android Studio.app/Contents/jbr/Contents/Home'],
    linux: ['/opt/android-studio/jbr', path.join(os.homedir(), 'android-studio/jbr')],
  }[process.platform] ?? []
  const candidates = [process.env.FORJA_JAVA_HOME, process.env.JAVA_HOME, ...studio].filter(Boolean)
  const home = candidates.find(dir => jdkMajor(dir) >= 21)
  if (!home) {
    console.error(`Nenhum JDK 21 ou mais novo em: ${candidates.join(', ')}. Defina FORJA_JAVA_HOME.`)
    process.exit(1)
  }
  return home
}

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(process.execPath, [path.join(repoDir, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android'], { cwd: mobileDir })

const javaHome = findJavaHome()
console.log(`JDK: ${javaHome}`)
// Pelo caminho inteiro: o cmd do Windows pode não procurar na pasta atual.
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const task = variant === 'release' ? 'assembleRelease' : 'assembleDebug'
// O .bat só roda pelo shell no Windows: lá, a linha inteira vai pronta (o caminho entre aspas, por
// causa de pasta com espaço), com os argumentos fixos, sem nada de fora.
const [command, args] = process.platform === 'win32'
  ? [`"${gradlew}" ${task} --console=plain`, []]
  : [gradlew, [task, '--console=plain']]
run(command, args, {
  cwd: androidDir,
  shell: process.platform === 'win32',
  env: { ...process.env, JAVA_HOME: javaHome },
})

const outputDir = path.join(androidDir, 'app/build/outputs/apk', variant)
const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, 'output-metadata.json'), 'utf8'))
const { versionName, versionCode, outputFile } = metadata.elements[0]
const built = path.join(outputDir, outputFile)

if (variant === 'debug') {
  console.log(`\nAPK de teste ${versionName} (${versionCode}): ${built}`)
  console.log(`Abre: ${process.env.FORJA_DEV_URL || 'o site publicado'}`)
  process.exit(0)
}

const apkDir = process.env.FORJA_APK_DIR || path.resolve(repoDir, '..', 'dnd-character-creator-apk')
fs.mkdirSync(apkDir, { recursive: true })
const target = path.join(apkDir, `forja-de-herois-${versionName}.apk`)
fs.copyFileSync(built, target)
console.log(`\nAPK ${versionName} (versionCode ${versionCode}), assinado: ${target}`)
