import { describe, it, expect } from 'vitest'
import classesData from '../../data/classes.json'
import racesData from '../../data/races.json'
import { CLASS_PRESENTATION, ROLES } from '../classUtils'
import { RACE_PRESENTATION } from '../raceUtils'
import { GLOSSARY, GLOSSARY_TERMS } from '../glossary'

const classIds = (classesData as { id: string }[]).map(c => c.id)
const raceIds = (racesData as { id: string }[]).map(r => r.id)

describe('CLASS_PRESENTATION', () => {
  it('tem entrada para toda classe de classes.json', () => {
    for (const id of classIds) expect(CLASS_PRESENTATION[id]).toBeDefined()
  })

  it('toda classe tem ao menos um papel (role) válido', () => {
    for (const id of classIds) {
      const roles = CLASS_PRESENTATION[id].roles
      expect(roles.length).toBeGreaterThan(0)
      for (const r of roles) expect(ROLES[r]).toBeDefined()
    }
  })

  it('classes marcadas como iniciantes têm nota explicativa', () => {
    for (const id of classIds) {
      const p = CLASS_PRESENTATION[id]
      if (p.beginnerFriendly) expect((p.beginnerNote ?? '').length).toBeGreaterThan(0)
    }
  })
})

describe('RACE_PRESENTATION', () => {
  it('tem entrada para toda raça de races.json', () => {
    for (const id of raceIds) expect(RACE_PRESENTATION[id]).toBeDefined()
  })

  it('raças marcadas como iniciantes têm nota explicativa', () => {
    for (const id of raceIds) {
      const p = RACE_PRESENTATION[id]
      if (p?.beginnerFriendly) expect((p.beginnerNote ?? '').length).toBeGreaterThan(0)
    }
  })
})

describe('GLOSSARY', () => {
  it('todo termo tem rótulo e definição não vazios', () => {
    for (const id of GLOSSARY_TERMS) {
      expect(GLOSSARY[id].term.length).toBeGreaterThan(0)
      expect(GLOSSARY[id].definition.length).toBeGreaterThan(0)
    }
  })
})
