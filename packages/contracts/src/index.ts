/**
 * O contrato da API: o que o site (`apps/web`) e o servidor (`apps/api`) trocam. Um lugar só, para
 * os dois lados não divergirem. O servidor usa os schemas para validar; o site usa só os tipos
 * (`import type`) e os valores de `./constants`, que não importam o Zod.
 */
export * from './constants'
export * from './errors'
export * from './auth'
export * from './sync'
