import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { MAX_DOCUMENT_BYTES } from '@rpg/contracts'
import { createTestApp } from '../testing/test-app'

const SITE = 'https://forja.example'

describe('a fundação da API', () => {
  it('o /health responde sem banco, com o ambiente e a versão', async () => {
    const { app } = createTestApp({ version: '1.2.3' })
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', environment: 'test', version: '1.2.3' })
  })

  it('rota que não existe devolve o envelope de erro, não o HTML do Express', async () => {
    const response = await request(createTestApp().app).get('/api/nao-existe')
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'A rota GET /api/nao-existe não existe.' } })
    expect(response.headers['x-powered-by']).toBeUndefined()
  })

  it('nada de /api fica em cache', async () => {
    const response = await request(createTestApp().app).get('/api/qualquer')
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('JSON malformado é erro de validação, e corpo grande demais é 413', async () => {
    const { app } = createTestApp()
    const broken = await request(app).post('/api/x').set('Content-Type', 'application/json').send('{"a":')
    expect(broken.status).toBe(400)
    expect(broken.body.error.code).toBe('VALIDATION')

    const huge = await request(app).post('/api/x').send({ draft: 'x'.repeat(MAX_DOCUMENT_BYTES + 10_000) })
    expect(huge.status).toBe(413)
    expect(huge.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  describe('pedido que grava só vale vindo do site', () => {
    it('com a lista de origens, recusa a página de fora e aceita a do site', async () => {
      const { app } = createTestApp({ appOrigins: [SITE] })
      const foreign = await request(app).post('/api/x').set('Origin', 'https://outro.example').send({})
      expect(foreign.status).toBe(403)
      expect(foreign.body.error.code).toBe('FORBIDDEN_ORIGIN')

      // Passou da conferência de origem: o 404 é da rota, que não existe.
      const own = await request(app).post('/api/x').set('Origin', SITE).send({})
      expect(own.status).toBe(404)
    })

    it('sem a lista (desenvolvimento), vale a origem que bate com o Host do pedido', async () => {
      const { app } = createTestApp()
      const same = await request(app).post('/api/x').set('Host', '192.168.0.7:5173').set('Origin', 'http://192.168.0.7:5173').send({})
      expect(same.status).toBe(404)
      const other = await request(app).post('/api/x').set('Host', '192.168.0.7:5173').set('Origin', 'http://evil.example').send({})
      expect(other.status).toBe(403)
    })

    it('leitura e pedido sem Origin (um script, o curl) passam', async () => {
      const { app } = createTestApp({ appOrigins: [SITE] })
      expect((await request(app).get('/api/x').set('Origin', 'https://outro.example')).status).toBe(404)
      expect((await request(app).post('/api/x').send({})).status).toBe(404)
    })
  })
})
