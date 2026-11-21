import { defineConfig } from 'tsup'

// O build da API: um arquivo só, dist/server.js, para o `node` da Render. Os pacotes do
// repositório (@rpg/contracts, @rpg/rules) entram no arquivo, porque são TS-fonte e o Node puro não
// os carrega; as dependências de verdade (express, @prisma/client…) ficam de fora e vêm do
// node_modules. Os testes e os repositórios em memória não entram: nada do server.ts os importa.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@rpg\//],
})
