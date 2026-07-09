export type Origin = {
  id: string
  name: string
  description: string
  skillProficiencies: string[]
  power: {
    name: string
    description: string
  }
  rollRange: [number, number]
}
