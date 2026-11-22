import { describe, it, expect, vi, afterEach } from 'vitest'
import { KEEPALIVE_MAX_BYTES } from '../engine'
import { characterKey, playKey } from '../syncStorage'
import { createFakeDevice, createFakeServer, pendingOf } from './fakes'

const K1 = characterKey('dnd5e', 'k1')
const P1 = playKey('k1')

/** Um servidor e dois aparelhos da mesma conta. */
function setup() {
  const server = createFakeServer()
  return { server, phone: createFakeDevice(server), computer: createFakeDevice(server) }
}

/** Os nomes das fichas do aparelho, em ordem. */
const names = (device: ReturnType<typeof createFakeDevice>) =>
  Object.entries(device.contents()).filter(([key]) => key.startsWith('character:')).map(([, draft]) => (draft as { name: string }).name).sort()

afterEach(() => vi.restoreAllMocks())

describe('enviar', () => {
  it('a ficha nova sobe e fica em dia com a revisão do servidor', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })

    expect(await phone.engine.sync()).toBe('synced')
    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk' } })
    expect(phone.meta.docs[K1]).toEqual({ revision: 1, dirty: false })
    expect(phone.engine.status()).toMatchObject({ phase: 'idle', pending: 0, lastSyncedAt: 1000 })
  })

  it('a alteração sobe partindo da revisão conhecida', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()
    phone.clock = 2000
    phone.save('k1', { name: 'Krusk', level: 2 })
    await phone.engine.sync()

    expect(server.characters()[0]).toMatchObject({ revision: 2, clientUpdatedAt: 2000, draft: { name: 'Krusk', level: 2 } })
    expect(phone.meta.docs[K1]).toEqual({ revision: 2, dirty: false })
  })

  it('o que muda enquanto o envio está no ar continua a enviar', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    server.duringNext = null
    // O primeiro pedido do ciclo é a leitura; o envio é o segundo.
    const sync = phone.engine.sync()
    await Promise.resolve()
    await Promise.resolve()
    server.duringNext = () => {
      phone.clock = 2000
      phone.save('k1', { name: 'Krusk', level: 2 })
    }
    await sync

    expect(server.characters()[0].draft).toEqual({ name: 'Krusk' })
    expect(phone.meta.docs[K1]).toEqual({ revision: 1, dirty: true })
    await phone.engine.sync()
    expect(server.characters()[0]).toMatchObject({ revision: 2, draft: { name: 'Krusk', level: 2 } })
  })

  it('a ficha vai antes do estado de jogo dela, e as exclusões por último', async () => {
    const { server, phone } = setup()
    phone.save('velha', { name: 'Velha' })
    await phone.engine.sync()
    server.log.length = 0

    phone.erase('velha')
    phone.play('k1', { damageTaken: 3 })
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()

    expect(server.log.filter(entry => !entry.startsWith('GET'))).toEqual(['PUT k1', 'PLAY k1', 'DELETE velha'])
    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk' }, [P1]: { damageTaken: 3 } })
  })

  it('grava antes o que a tela ainda não gravou, e isso sobe no mesmo ciclo', async () => {
    const { server, phone } = setup()
    phone.onFlush = () => {
      phone.onFlush = null
      phone.save('k1', { name: 'Digitado agora' })
    }
    await phone.engine.sync()
    expect(phone.flushes).toBe(1)
    expect(server.alive()).toEqual({ [K1]: { name: 'Digitado agora' } })
  })
})

describe('ler', () => {
  it('o que outro aparelho gravou chega, e as telas são avisadas', async () => {
    const { phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.play('k1', { damageTaken: 3 })
    await phone.engine.sync()

    await computer.engine.sync()
    expect(computer.contents()).toEqual({ [K1]: { name: 'Krusk' }, [P1]: { damageTaken: 3 } })
    expect(computer.meta.docs).toEqual({ [K1]: { revision: 1, dirty: false }, [P1]: { revision: 1, dirty: false } })
    expect(computer.reloads).toBe(1)
    // A ficha chega com a data de quem a gravou: a ordem de "recentes" é a mesma nos aparelhos.
    expect(computer.doc(K1)?.updatedAt).toBe(1000)
  })

  it('o eco da própria gravação não mexe em nada', async () => {
    const { phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()
    await phone.engine.sync()
    expect(phone.reloads).toBe(0)
    expect(phone.copiesReported).toEqual([])
    expect(phone.meta.cursor).toBe('1')
  })

  it('só lê com a galeria na tela; fora dela, só envia', async () => {
    const { server, phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()

    computer.atRest = false
    computer.save('k2', { name: 'Lia' })
    server.log.length = 0
    await computer.engine.sync()
    expect(server.log).toEqual(['PUT k2'])
    expect(names(computer)).toEqual(['Lia'])

    computer.atRest = true
    await computer.engine.sync()
    expect(names(computer)).toEqual(['Krusk', 'Lia'])
  })

  it('a resposta que chega depois de o jogador abrir uma ficha é descartada, sem andar o cursor', async () => {
    const { server, phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()

    server.duringNext = () => { computer.atRest = false }
    await computer.engine.sync()
    expect(computer.contents()).toEqual({})
    expect(computer.meta.cursor).toBeNull()

    computer.atRest = true
    await computer.engine.sync()
    expect(names(computer)).toEqual(['Krusk'])
  })

  it('lê página a página até acabar', async () => {
    const { server, phone, computer } = setup()
    for (const id of ['a', 'b', 'c', 'd', 'e']) phone.save(id, { name: id })
    await phone.engine.sync()

    server.pageSize = 2
    server.log.length = 0
    await computer.engine.sync()
    expect(names(computer)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(server.log.filter(entry => entry.startsWith('GET'))).toEqual(['GET tudo', 'GET 2', 'GET 4'])
    expect(computer.meta.cursor).toBe('5')
  })

  it('o estado de jogo de uma ficha que o aparelho não tem não é gravado', async () => {
    const { phone, computer } = setup()
    phone.save('k1', { name: 42 as unknown as string })
    phone.play('k1', { damageTaken: 3 })
    await phone.engine.sync()

    // A ficha não parece uma ficha (sem nome): o aparelho não a aplica, nem o estado de jogo dela.
    await computer.engine.sync()
    expect(computer.contents()).toEqual({})
    expect(computer.meta.docs).toEqual({})
  })
})

describe('conflito: os dois aparelhos mexeram na mesma ficha', () => {
  /** Os dois partem da mesma ficha em dia. */
  async function both() {
    const world = setup()
    world.phone.save('k1', { name: 'Krusk', level: 1 })
    await world.phone.engine.sync()
    await world.computer.engine.sync()
    return world
  }

  it('ganha a alteração mais recente, e a que perdeu vira cópia nos dois aparelhos', async () => {
    const { server, phone, computer } = await both()
    phone.clock = 2000
    phone.save('k1', { name: 'Krusk', level: 2 })
    computer.clock = 3000
    computer.save('k1', { name: 'Krusk', level: 9 })

    await phone.engine.sync()
    await computer.engine.sync()
    // O computador, mais recente, ficou com o id; a versão do celular virou cópia.
    expect(computer.contents()[K1]).toEqual({ name: 'Krusk', level: 9 })
    expect(names(computer)).toEqual(['Krusk', 'Krusk (conflito 3000)'])
    expect(computer.copiesReported).toEqual([1])
    expect(server.alive()[K1]).toEqual({ name: 'Krusk', level: 9 })

    await phone.engine.sync()
    expect(phone.contents()).toEqual(computer.contents())
    expect(phone.copiesReported).toEqual([])
    expect(Object.values(phone.contents())).toContainEqual({ name: 'Krusk (conflito 3000)', level: 2 })
  })

  it('quando quem chega depois é o mais antigo, a versão dele vira a cópia', async () => {
    const { server, phone, computer } = await both()
    phone.clock = 5000
    phone.save('k1', { name: 'Krusk', level: 2 })
    computer.clock = 3000
    computer.save('k1', { name: 'Krusk', level: 9 })

    await phone.engine.sync()
    await computer.engine.sync()
    expect(computer.contents()[K1]).toEqual({ name: 'Krusk', level: 2 })
    expect(Object.values(computer.contents())).toContainEqual({ name: 'Krusk (conflito 3000)', level: 9 })
    expect(computer.copiesReported).toEqual([1])
    expect(computer.reloads).toBeGreaterThan(0)

    await phone.engine.sync()
    await computer.engine.sync()
    expect(phone.contents()).toEqual(computer.contents())
    expect(server.alive()).toEqual(phone.contents())
  })

  it('os dois chegaram ao mesmo conteúdo: o aparelho adota a revisão, sem cópia', async () => {
    const { phone, computer } = await both()
    phone.clock = 2000
    phone.save('k1', { name: 'Krusk', level: 2 })
    computer.clock = 3000
    computer.save('k1', { level: 2, name: 'Krusk' })

    await phone.engine.sync()
    await computer.engine.sync()
    expect(names(computer)).toEqual(['Krusk'])
    expect(computer.copiesReported).toEqual([])
    expect(computer.meta.docs[K1]).toEqual({ revision: 2, dirty: false })
  })

  it('com a ficha aberta, a versão do servidor que ganharia espera a volta à galeria', async () => {
    const { phone, computer } = await both()
    phone.clock = 5000
    phone.save('k1', { name: 'Krusk', level: 2 })
    await phone.engine.sync()

    // O computador está com a ficha aberta no criador, e a alteração dele é mais antiga.
    const reloads = computer.reloads
    computer.atRest = false
    computer.clock = 3000
    computer.save('k1', { name: 'Krusk', level: 9 })
    await computer.engine.sync()
    expect(computer.contents()[K1]).toEqual({ name: 'Krusk', level: 9 })
    expect(computer.meta.docs[K1]).toEqual({ revision: 1, dirty: true, blocked: true })
    // Nada do que está na tela foi trocado, e as telas não foram mandadas reler.
    expect(computer.reloads).toBe(reloads)

    // Enquanto espera, o envio não insiste a cada ciclo.
    const before = computer.statuses.length
    await computer.engine.sync()
    expect(computer.meta.docs[K1].blocked).toBe(true)
    expect(computer.statuses.length).toBeGreaterThan(before)

    computer.atRest = true
    await computer.engine.sync()
    expect(computer.contents()[K1]).toEqual({ name: 'Krusk', level: 2 })
    expect(Object.values(computer.contents())).toContainEqual({ name: 'Krusk (conflito 3000)', level: 9 })
    expect(computer.meta.docs[K1]).toEqual({ revision: 2, dirty: false })
  })

  it('com a ficha aberta e a versão do aparelho mais recente, resolve na hora: nada na tela muda', async () => {
    const { server, phone, computer } = await both()
    phone.clock = 2000
    phone.save('k1', { name: 'Krusk', level: 2 })
    await phone.engine.sync()

    computer.atRest = false
    computer.clock = 9000
    computer.save('k1', { name: 'Krusk', level: 9 })
    await computer.engine.sync()
    expect(computer.contents()[K1]).toEqual({ name: 'Krusk', level: 9 })
    expect(server.alive()[K1]).toEqual({ name: 'Krusk', level: 9 })
    expect(Object.values(computer.contents())).toContainEqual({ name: 'Krusk (conflito 9000)', level: 2 })
    expect(computer.meta.docs[K1]).toEqual({ revision: 3, dirty: false })
  })

  it('no estado de jogo, o que perdeu vira uma cópia da ficha com ele dentro', async () => {
    const { phone, computer } = await both()
    phone.clock = 2000
    phone.play('k1', { damageTaken: 3 })
    await phone.engine.sync()
    await computer.engine.sync()

    phone.clock = 3000
    phone.play('k1', { damageTaken: 8 })
    computer.clock = 4000
    computer.play('k1', { damageTaken: 1 })
    await phone.engine.sync()
    await computer.engine.sync()

    expect(computer.contents()[P1]).toEqual({ damageTaken: 1 })
    const copy = Object.entries(computer.contents()).find(([key, value]) => key.startsWith('play:') && key !== P1 && (value as { damageTaken: number }).damageTaken === 8)
    expect(copy).toBeDefined()
    expect(names(computer)).toContain('jogo em conflito 4000')
  })
})

describe('apagar', () => {
  it('a exclusão chega aos outros aparelhos, com o estado de jogo junto', async () => {
    const { server, phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.play('k1', { damageTaken: 3 })
    await phone.engine.sync()
    await computer.engine.sync()

    phone.erase('k1')
    expect(phone.meta.docs[K1]).toEqual({ revision: 1, dirty: true, deleted: true })
    await phone.engine.sync()
    expect(phone.meta.docs).toEqual({})
    expect(server.alive()).toEqual({})

    await computer.engine.sync()
    expect(computer.contents()).toEqual({})
    expect(computer.meta.docs).toEqual({})
    expect(computer.reloads).toBe(2)
  })

  it('apagar o que nunca subiu não chama a rede', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.erase('k1')
    await phone.engine.sync()
    expect(server.log).toEqual(['GET tudo'])
  })

  it('a edição ganha da exclusão: quem editou sem saber da exclusão ressuscita a ficha', async () => {
    const { server, phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.play('k1', { damageTaken: 3 })
    await phone.engine.sync()
    await computer.engine.sync()

    phone.erase('k1')
    await phone.engine.sync()
    computer.clock = 2000
    computer.save('k1', { name: 'Krusk', level: 5 })
    await computer.engine.sync()

    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk', level: 5 }, [P1]: { damageTaken: 3 } })
    await phone.engine.sync()
    expect(phone.contents()).toEqual({ [K1]: { name: 'Krusk', level: 5 }, [P1]: { damageTaken: 3 } })
    expect(phone.copiesReported).toEqual([])
  })

  it('a edição ganha da exclusão: quem apagou sem saber da edição recebe a ficha de volta', async () => {
    const { server, phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()
    await computer.engine.sync()

    computer.clock = 2000
    computer.save('k1', { name: 'Krusk', level: 5 })
    await computer.engine.sync()
    phone.erase('k1')
    await phone.engine.sync()

    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk', level: 5 } })
    expect(phone.contents()).toEqual({ [K1]: { name: 'Krusk', level: 5 } })
    expect(phone.meta.docs[K1]).toEqual({ revision: 2, dirty: false })
  })

  it('apagada nos dois aparelhos: o diário só esquece', async () => {
    const { phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()
    await computer.engine.sync()
    phone.erase('k1')
    computer.erase('k1')
    await phone.engine.sync()
    await computer.engine.sync()
    expect(computer.meta.docs).toEqual({})
    expect(pendingOf(computer)).toEqual([])
  })

  it('apagar a ficha que ainda estava subindo: a lápide nasce quando a resposta chega', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    const sync = phone.engine.sync()
    await Promise.resolve()
    await Promise.resolve()
    server.duringNext = () => phone.erase('k1')
    await sync

    // O servidor ficou com a ficha (o envio chegou); o aparelho, sem ela, guarda a lápide.
    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk' } })
    expect(phone.meta.docs[K1]).toEqual({ revision: 1, dirty: true, deleted: true })
    await phone.engine.sync()
    expect(server.alive()).toEqual({})
    expect(phone.meta.docs).toEqual({})
  })

  it('a biblioteca que some por defeito nunca vira exclusão: a leitura completa a devolve', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.play('k1', { damageTaken: 3 })
    phone.save('k2', { name: 'Lia' })
    await phone.engine.sync()
    server.log.length = 0

    phone.loseLibrary()
    await phone.engine.sync()

    expect(server.log).toEqual(['GET tudo'])
    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk' }, [P1]: { damageTaken: 3 }, [characterKey('dnd5e', 'k2')]: { name: 'Lia' } })
    expect(phone.contents()).toEqual(server.alive())
    expect(pendingOf(phone)).toEqual([])
  })
})

describe('quando o servidor não atende', () => {
  it('sem rede: nada se perde, o ciclo pede nova tentativa e o próximo resolve', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    server.offline = true
    expect(await phone.engine.sync()).toBe('retry')
    expect(phone.engine.status()).toMatchObject({ phase: 'offline', pending: 1, lastSyncedAt: null })
    expect(phone.contents()).toEqual({ [K1]: { name: 'Krusk' } })

    server.offline = false
    expect(await phone.engine.sync()).toBe('synced')
    expect(phone.engine.status()).toMatchObject({ phase: 'idle', pending: 0 })
  })

  it('sessão expirada: para, guarda o que mudou e retoma depois de entrar de novo', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    server.expired = true
    expect(await phone.engine.sync()).toBe('stopped')
    expect(phone.engine.status()).toMatchObject({ phase: 'expired', pending: 1 })
    // Parou no primeiro pedido: não insiste com cada documento.
    expect(server.log).toEqual(['GET tudo'])

    server.expired = false
    expect(await phone.engine.sync()).toBe('synced')
    expect(server.alive()).toEqual({ [K1]: { name: 'Krusk' } })
  })

  it('a ficha que o servidor recusa fica marcada e não é repetida até mudar de novo', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.save('k2', { name: 'Lia' })
    server.tooLarge.add('k1')

    expect(await phone.engine.sync()).toBe('synced')
    expect(phone.meta.docs[K1]).toEqual({ revision: 0, dirty: true, refused: true })
    expect(phone.engine.status()).toMatchObject({ pending: 0, refused: 1 })
    // A outra ficha subiu: uma recusada não trava as demais.
    expect(Object.keys(server.alive())).toEqual([characterKey('dnd5e', 'k2')])

    server.log.length = 0
    await phone.engine.sync()
    expect(server.log.filter(entry => entry.startsWith('PUT'))).toEqual([])

    server.tooLarge.clear()
    phone.clock = 2000
    phone.save('k1', { name: 'Krusk, mais curto' })
    await phone.engine.sync()
    expect(phone.meta.docs[K1]).toEqual({ revision: 1, dirty: false })
  })

  it('o estado de jogo de uma ficha que o servidor recusou espera, sem travar o ciclo', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.play('k1', { damageTaken: 3 })
    server.tooLarge.add('k1')
    expect(await phone.engine.sync()).toBe('synced')
    expect(phone.meta.docs[P1]).toEqual({ revision: 0, dirty: true })
  })

  it('um defeito no meio do ciclo não derruba a sincronização', async () => {
    const { phone } = setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    phone.onFlush = () => { throw new Error('aparelho sem espaço') }
    expect(await phone.engine.sync()).toBe('retry')
    expect(phone.engine.status().phase).toBe('offline')

    phone.onFlush = null
    phone.save('k1', { name: 'Krusk' })
    expect(await phone.engine.sync()).toBe('synced')
  })

  it('dois pedidos de ciclo ao mesmo tempo são um ciclo só', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    const [a, b] = await Promise.all([phone.engine.sync(), phone.engine.sync()])
    expect([a, b]).toEqual(['synced', 'synced'])
    expect(server.log).toEqual(['GET tudo', 'PUT k1'])
  })
})

describe('de quem são os dados do aparelho', () => {
  it('sem ninguém conectado, o motor não faz nada', async () => {
    const server = createFakeServer()
    const device = createFakeDevice(server, { account: null })
    device.save('k1', { name: 'Krusk' })
    expect(await device.engine.sync()).toBe('stopped')
    expect(server.log).toEqual([])
  })

  it('dados de outra conta (ou de ninguém) nunca sobem para a conta conectada', async () => {
    const server = createFakeServer()
    for (const owner of [null, { id: 'conta-da-bia', email: 'bia@ficha.dev' }]) {
      const device = createFakeDevice(server, { owner })
      device.save('k1', { name: 'Da Bia' })
      expect(await device.engine.sync()).toBe('stopped')
      expect(device.engine.status().phase).toBe('mismatch')
      expect(device.flushes).toBe(0)
    }
    expect(server.log).toEqual([])
  })

  it('o servidor diz que a conta do cookie é outra: para, sem mexer em nada', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    server.mismatch = true
    expect(await phone.engine.sync()).toBe('stopped')
    expect(phone.engine.status()).toMatchObject({ phase: 'mismatch', pending: 1 })
  })
})

describe('primeiro login num aparelho que já tinha fichas', () => {
  it('as fichas de antes sobem, e as da conta descem', async () => {
    const { server, phone, computer } = setup()
    computer.save('da-conta', { name: 'Já estava na conta' })
    await computer.engine.sync()

    // O celular tem fichas de antes da conta: o diário nunca ouviu falar delas.
    phone.save('k1', { name: 'De antes' })
    phone.play('k1', { damageTaken: 2 })
    phone.meta.docs = {}
    await phone.engine.sync()

    expect(names(phone)).toEqual(['De antes', 'Já estava na conta'])
    expect(server.alive()).toEqual(phone.contents())
    expect(pendingOf(phone)).toEqual([])
    expect(phone.copiesReported).toEqual([])
  })

  it('o mesmo id com o mesmo conteúdo nos dois lados é adotado', async () => {
    const { phone, computer } = setup()
    computer.save('k1', { name: 'Krusk' })
    await computer.engine.sync()
    phone.save('k1', { name: 'Krusk' })
    phone.meta.docs = {}
    await phone.engine.sync()
    expect(names(phone)).toEqual(['Krusk'])
    expect(phone.meta.docs[K1]).toEqual({ revision: 1, dirty: false })
  })

  it('o mesmo id com conteúdo diferente: fica a mais recente, e a outra vira cópia', async () => {
    const { server, phone, computer } = setup()
    computer.clock = 5000
    computer.save('k1', { name: 'Do computador' })
    await computer.engine.sync()

    phone.clock = 2000
    phone.save('k1', { name: 'Do celular' })
    phone.meta.docs = {}
    await phone.engine.sync()
    expect(names(phone)).toEqual(['Do celular (conflito 2000)', 'Do computador'])
    expect(server.alive()).toEqual(phone.contents())
  })
})

describe('aparelhos em versões diferentes do app', () => {
  it('a forma mais nova não é aplicada nem regravada pelo app mais velho', async () => {
    const { server, phone, computer } = setup()
    computer.save('k1', { name: 'Krusk' })
    await computer.engine.sync()
    await phone.engine.sync()

    // O computador foi atualizado e grava a ficha numa forma nova.
    computer.schema = 2
    computer.clock = 2000
    computer.save('k1', { name: 'Krusk', campoNovo: true })
    await computer.engine.sync()

    phone.clock = 3000
    phone.save('k1', { name: 'Krusk', level: 2 })
    await phone.engine.sync()
    // O celular não aplicou nem cobriu a forma nova.
    expect(phone.contents()[K1]).toEqual({ name: 'Krusk', level: 2 })
    expect(server.alive()[K1]).toEqual({ name: 'Krusk', campoNovo: true })
    expect(phone.engine.status()).toMatchObject({ outdated: 1, pending: 0 })
    expect(phone.copiesReported).toEqual([])

    // E não insiste: os ciclos seguintes não tocam no documento.
    server.log.length = 0
    await phone.engine.sync()
    expect(server.log.filter(entry => entry.startsWith('PUT'))).toEqual([])
  })

  it('atualizado o app, o que ele não entendia é tentado de novo', async () => {
    const { server, phone, computer } = setup()
    computer.schema = 2
    computer.save('k1', { name: 'Krusk', campoNovo: true })
    await computer.engine.sync()
    await phone.engine.sync()
    expect(phone.contents()).toEqual({})
    expect(phone.engine.status().outdated).toBe(1)

    phone.schema = 2
    phone.engine.retryOutdated()
    await phone.engine.sync()
    expect(phone.contents()).toEqual(server.alive())
    expect(phone.engine.status().outdated).toBe(0)
  })
})

describe('o envio de saída (a página escondida ou fechando)', () => {
  it('manda tudo o que mudou de uma vez, com keepalive, sem esperar resposta', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk' })
    phone.save('k2', { name: 'Lia' })
    await phone.engine.sync()
    phone.clock = 2000
    phone.save('k1', { name: 'Krusk', level: 2 })
    phone.save('k2', { name: 'Lia', level: 2 })
    server.log.length = 0

    phone.engine.flushOnHide()
    expect(phone.flushes).toBe(2)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(server.keepalive.sort()).toEqual(['PUT k1', 'PUT k2'])
    // A página sobreviveu: as respostas chegaram, e os documentos ficaram em dia.
    expect(pendingOf(phone)).toEqual([])
  })

  it('documento grande demais para o keepalive espera o próximo ciclo', async () => {
    const { server, phone } = setup()
    phone.save('k1', { name: 'Krusk', texto: 'x'.repeat(KEEPALIVE_MAX_BYTES) })
    phone.engine.flushOnHide()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(server.log).toEqual([])
    expect(pendingOf(phone)).toEqual([K1])
  })

  it('não resolve conflito na saída: fica para o próximo ciclo', async () => {
    const { phone, computer } = setup()
    phone.save('k1', { name: 'Krusk' })
    await phone.engine.sync()
    await computer.engine.sync()
    phone.clock = 5000
    phone.save('k1', { name: 'Krusk', level: 2 })
    await phone.engine.sync()

    computer.clock = 3000
    computer.save('k1', { name: 'Krusk', level: 9 })
    computer.engine.flushOnHide()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(names(computer)).toEqual(['Krusk'])
    expect(computer.meta.docs[K1]).toEqual({ revision: 1, dirty: true })
    expect(computer.copiesReported).toEqual([])
  })
})

describe('convergência', () => {
  /** Um gerador de números com semente: o mesmo roteiro a cada execução. */
  function seeded(seed: number) {
    let state = seed
    return (max: number) => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
      return state % max
    }
  }

  async function settle(server: ReturnType<typeof createFakeServer>, devices: ReturnType<typeof createFakeDevice>[]) {
    server.offline = false
    for (const device of devices) device.atRest = true
    for (let round = 0; round < 4; round++) {
      for (const device of devices) expect(await device.engine.sync()).toBe('synced')
    }
  }

  it('edições intercaladas em dois aparelhos: no fim os dois são iguais ao servidor, e nenhuma versão se perde', async () => {
    for (const seed of [1, 7, 42, 2026]) {
      const next = seeded(seed)
      const { server, phone, computer } = setup()
      const devices = [phone, computer]
      const ids = ['a', 'b', 'c']
      /** A última versão que cada aparelho gravou de cada ficha. */
      const last = new Map<string, string>()
      let tick = 1

      for (let step = 0; step < 120; step++) {
        const device = devices[next(2)]
        device.clock = 1000 + step * 10
        const action = next(10)
        if (action < 5) {
          const id = ids[next(ids.length)]
          const version = `v${tick++}`
          device.save(id, { name: id, version })
          last.set(`${devices.indexOf(device)}:${id}`, version)
        } else if (action < 7) {
          device.atRest = next(2) === 0
        } else if (action < 8) {
          server.offline = next(3) === 0
        } else {
          await device.engine.sync()
        }
      }
      await settle(server, devices)

      expect(phone.contents(), `semente ${seed}`).toEqual(server.alive())
      expect(computer.contents(), `semente ${seed}`).toEqual(server.alive())
      expect(pendingOf(phone)).toEqual([])
      expect(pendingOf(computer)).toEqual([])

      // Toda última versão gravada por um aparelho existe no fim, na ficha ou numa cópia de conflito.
      const versions = new Set(Object.values(server.alive()).map(draft => (draft as { version?: string }).version))
      for (const [where, version] of last) expect(versions.has(version), `semente ${seed}, ${where} ${version}`).toBe(true)
    }
  })

  it('com exclusões e jogo no meio, os dois aparelhos ainda terminam iguais ao servidor', async () => {
    for (const seed of [3, 11, 99]) {
      const next = seeded(seed)
      const { server, phone, computer } = setup()
      const devices = [phone, computer]
      const ids = ['a', 'b', 'c']
      let tick = 1

      for (let step = 0; step < 150; step++) {
        const device = devices[next(2)]
        device.clock = 1000 + step * 10
        const id = ids[next(ids.length)]
        const action = next(12)
        if (action < 4) device.save(id, { name: id, version: `v${tick++}` })
        else if (action < 6) {
          if (device.doc(characterKey('dnd5e', id))) device.play(id, { damageTaken: tick++ })
        } else if (action < 7) device.erase(id)
        else if (action < 8) device.atRest = next(2) === 0
        else if (action < 9) server.offline = next(3) === 0
        else await device.engine.sync()
      }
      await settle(server, devices)

      expect(phone.contents(), `semente ${seed}`).toEqual(server.alive())
      expect(computer.contents(), `semente ${seed}`).toEqual(server.alive())
      expect(pendingOf(phone), `semente ${seed}`).toEqual([])
      expect(pendingOf(computer), `semente ${seed}`).toEqual([])
    }
  })
})
