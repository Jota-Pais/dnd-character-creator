import { describe, it, expect } from 'vitest'
import { withVerifiedTls } from '../prisma'

describe('a URL do banco', () => {
  it('o sslmode=require da Neon vira verify-full, por extenso', () => {
    expect(withVerifiedTls('postgresql://u:p@host-pooler.neon.tech/neondb?channel_binding=require&sslmode=require'))
      .toBe('postgresql://u:p@host-pooler.neon.tech/neondb?channel_binding=require&sslmode=verify-full')
    expect(withVerifiedTls('postgresql://u:p@host/db?sslmode=require&channel_binding=require'))
      .toBe('postgresql://u:p@host/db?sslmode=verify-full&channel_binding=require')
  })

  it('o resto fica como veio: outro modo, sem modo, e o channel_binding', () => {
    for (const url of [
      'postgresql://u:p@host/db',
      'postgresql://u:p@127.0.0.1:5432/postgres?sslmode=disable',
      'postgresql://u:p@host/db?sslmode=verify-full',
      'postgresql://u:p@host/db?channel_binding=require',
    ]) {
      expect(withVerifiedTls(url)).toBe(url)
    }
  })
})
