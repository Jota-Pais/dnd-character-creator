import { describe, it, expect } from 'vitest'
import { decideRemote, type ReconcileInput } from '../reconcile'

/** O caso de base: documento em dia na revisão 2, e o servidor com a 3, viva e diferente. */
const input = (over: Partial<ReconcileInput> = {}): ReconcileInput => ({
  meta: { revision: 2, dirty: false },
  local: { updatedAt: 1000 },
  remote: { revision: 3, deleted: false, clientUpdatedAt: 2000 },
  sameContent: false,
  atRest: true,
  supported: true,
  ...over,
})

const dirty = { revision: 2, dirty: true }
const alive = (clientUpdatedAt: number) => ({ revision: 3, deleted: false, clientUpdatedAt })
const tombstone = { revision: 3, deleted: true, clientUpdatedAt: 2000 }

describe('o que o aparelho já conhece', () => {
  it('a revisão que ele já tem (o eco da própria gravação) é ignorada, mesmo com alteração local', () => {
    expect(decideRemote(input({ remote: { revision: 2, deleted: false, clientUpdatedAt: 9999 } }))).toBe('ignore')
    expect(decideRemote(input({ meta: dirty, remote: { revision: 1, deleted: true, clientUpdatedAt: 9999 } }))).toBe('ignore')
  })

  it('forma mais nova que a deste app não é aplicada nem enviada', () => {
    expect(decideRemote(input({ supported: false }))).toBe('outdated')
    expect(decideRemote(input({ supported: false, meta: dirty }))).toBe('outdated')
  })
})

describe('o servidor tem uma versão viva', () => {
  it('documento que o aparelho não tem é gravado', () => {
    expect(decideRemote(input({ meta: undefined, local: null }))).toBe('apply')
    // O diário lembrava dele, mas a biblioteca se perdeu: volta do servidor.
    expect(decideRemote(input({ local: null }))).toBe('apply')
  })

  it('documento em dia recebe a versão do servidor, aberto ou não na conta do relógio', () => {
    expect(decideRemote(input())).toBe('apply')
    expect(decideRemote(input({ local: { updatedAt: 9999 } }))).toBe('apply')
  })

  it('alterado dos dois lados para o mesmo conteúdo: adota a revisão', () => {
    expect(decideRemote(input({ meta: dirty, sameContent: true }))).toBe('adopt')
  })

  it('alterado dos dois lados, o do aparelho mais recente: fica o do aparelho', () => {
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 3000 }, remote: alive(2000) }))).toBe('keepLocal')
    // Não depende de a galeria estar na tela: nada do aparelho é trocado.
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 3000 }, remote: alive(2000), atRest: false }))).toBe('keepLocal')
  })

  it('alterado dos dois lados, o do servidor mais recente: troca na galeria, espera fora dela', () => {
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 1000 }, remote: alive(2000) }))).toBe('takeRemote')
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 1000 }, remote: alive(2000), atRest: false }))).toBe('wait')
  })

  it('no empate do relógio ganha o servidor', () => {
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 2000 }, remote: alive(2000) }))).toBe('takeRemote')
  })

  it('a exclusão daqui perde para a edição de lá: a ficha volta', () => {
    const pendingDelete = { revision: 2, dirty: true, deleted: true as const }
    expect(decideRemote(input({ meta: pendingDelete, local: null }))).toBe('apply')
  })
})

describe('o servidor tem a lápide', () => {
  it('documento em dia é apagado do aparelho', () => {
    expect(decideRemote(input({ remote: tombstone }))).toBe('remove')
  })

  it('a edição daqui ganha da exclusão de lá, qualquer que seja o relógio', () => {
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 1 }, remote: tombstone }))).toBe('keepLocal')
    expect(decideRemote(input({ meta: dirty, local: { updatedAt: 1 }, remote: tombstone, atRest: false }))).toBe('keepLocal')
  })

  it('apagado dos dois lados, ou que o aparelho nem tem: o diário só esquece', () => {
    expect(decideRemote(input({ meta: { revision: 2, dirty: true, deleted: true }, local: null, remote: tombstone }))).toBe('forget')
    expect(decideRemote(input({ meta: undefined, local: null, remote: tombstone }))).toBe('forget')
    expect(decideRemote(input({ local: null, remote: tombstone }))).toBe('forget')
  })
})

describe('documento que o diário não conhece (ficha de antes da conta, diário perdido)', () => {
  const unknown = { meta: undefined, local: { updatedAt: 1000 }, remote: { revision: 1, deleted: false, clientUpdatedAt: 2000 } }

  it('conta como alterado: nunca é trocado pela versão do servidor sem conferir', () => {
    expect(decideRemote(input({ ...unknown, sameContent: true }))).toBe('adopt')
    expect(decideRemote(input(unknown))).toBe('takeRemote')
    expect(decideRemote(input({ ...unknown, atRest: false }))).toBe('wait')
    expect(decideRemote(input({ ...unknown, local: { updatedAt: 5000 } }))).toBe('keepLocal')
    expect(decideRemote(input({ ...unknown, remote: { revision: 1, deleted: true, clientUpdatedAt: 2000 } }))).toBe('keepLocal')
  })
})
