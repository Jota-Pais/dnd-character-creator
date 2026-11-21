import { describe, it, expect } from 'vitest'

/**
 * As camadas de storage têm duas portas. A do jogador (`saveCharacterEntry`, `deleteCharacterEntry`,
 * `savePlayState`, `deletePlayState`) marca no diário o que mudou, para subir ao servidor. A da
 * sincronização (`putSynced*`, `removeSynced*`, `readSynced*`, `clear*`) grava e apaga sem marcar:
 * é o que veio do servidor. Tela, store ou outra camada que usasse a segunda porta mudaria o
 * aparelho sem o servidor saber, e a próxima sincronização desfaria a mudança (ou, pior, a
 * confirmaria como "em dia").
 *
 * Por isso só o adaptador da sincronização (`features/sync/syncLocal.ts`) pode citá-las.
 */
const sources = import.meta.glob<string>(
  ['../../../**/*.{ts,tsx}', '!../../../**/__tests__/**', '!../../../**/*.test.{ts,tsx}', '!../../../test/**'],
  { query: '?raw', import: 'default', eager: true },
)

const SYNC_ONLY = /\b(putSynced\w+|removeSynced\w+|readSynced\w+|clearLibrary|clearPlayStorage|clearSyncMeta)\b/

/** Onde cada porta é definida, e o único lugar que a usa. */
const ALLOWED = [
  '../../../systems/dnd5e/storage/storage.ts',
  '../../../systems/dnd5e/storage/playStorage.ts',
  '../../../systems/ordem/storage/storage.ts',
  '../../../core/sync/syncStorage.ts',
  '../syncLocal.ts',
]

describe('a porta da sincronização nas camadas de storage', () => {
  it('o código lido cobre o site inteiro, sem os testes', () => {
    const files = Object.keys(sources)
    for (const file of [...ALLOWED, '../../../systems/dnd5e/stores/characterStore.ts', '../../gallery/GlobalGallery.tsx']) {
      expect(files, file).toContain(file)
    }
    expect(files.some(file => file.includes('__tests__'))).toBe(false)
  })

  it('só as camadas de storage e o adaptador da sincronização a citam', () => {
    const users = Object.entries(sources).filter(([, text]) => SYNC_ONLY.test(text)).map(([file]) => file).sort()
    expect(users).toEqual([...ALLOWED].sort())
  })
})
