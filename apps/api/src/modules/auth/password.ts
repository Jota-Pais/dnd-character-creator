import bcrypt from 'bcryptjs'

/**
 * O custo do bcrypt. Hash com custo real é lento por desenho (é o que protege de força bruta), e o
 * 12 vale em todo lugar onde a senha é de verdade: a API e os comandos do dono, em qualquer
 * ambiente. Só os testes passam um custo baixo, porque não testam resistência à força bruta: testam
 * que o par hash/verificação concorda.
 */
export const PASSWORD_COST = 12

export async function hashPassword(password: string, cost = PASSWORD_COST): Promise<string> {
  return bcrypt.hash(password, cost)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
