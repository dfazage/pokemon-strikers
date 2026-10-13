import type { PType } from './types'

export type Role = 'GK' | 'DEF' | 'MID' | 'FWD'
export type MoveFamily = 'TIR' | 'DRIBBLE' | 'TACLE' | 'ARRET'

export interface Species {
  id: number // numéro Pokédex = nom du sprite
  name: string
  types: PType[]
  spd: number // 1-10
  pow: number // 1-10
  def: number // 1-10
}

export interface Move {
  name: string
  family: MoveFamily
  type: PType
  power: number
  cost: number // PP
}

export const SPECIES: Species[] = [
  { id: 3, name: 'Florizarre', types: ['plante', 'poison'], spd: 5, pow: 7, def: 7 },
  { id: 6, name: 'Dracaufeu', types: ['feu', 'vol'], spd: 8, pow: 8, def: 6 },
  { id: 9, name: 'Tortank', types: ['eau'], spd: 5, pow: 7, def: 8 },
  { id: 25, name: 'Pikachu', types: ['electrik'], spd: 9, pow: 6, def: 4 },
  { id: 59, name: 'Arcanin', types: ['feu'], spd: 9, pow: 8, def: 6 },
  { id: 65, name: 'Alakazam', types: ['psy'], spd: 9, pow: 8, def: 3 },
  { id: 68, name: 'Mackogneur', types: ['combat'], spd: 4, pow: 9, def: 7 },
  { id: 94, name: 'Ectoplasma', types: ['spectre', 'poison'], spd: 8, pow: 8, def: 4 },
  { id: 130, name: 'Léviator', types: ['eau', 'vol'], spd: 7, pow: 9, def: 5 },
  { id: 131, name: 'Lokhlass', types: ['eau', 'glace'], spd: 5, pow: 7, def: 8 },
  { id: 143, name: 'Ronflex', types: ['normal'], spd: 2, pow: 8, def: 10 },
  { id: 149, name: 'Dracolosse', types: ['dragon', 'vol'], spd: 6, pow: 9, def: 7 },
  { id: 248, name: 'Tyranocif', types: ['roche', 'tenebres'], spd: 5, pow: 9, def: 8 },
  { id: 282, name: 'Gardevoir', types: ['psy'], spd: 7, pow: 8, def: 5 },
  { id: 306, name: 'Galeking', types: ['acier', 'roche'], spd: 3, pow: 8, def: 10 },
  { id: 350, name: 'Milobellus', types: ['eau'], spd: 6, pow: 6, def: 6 },
  { id: 373, name: 'Drattak', types: ['dragon', 'vol'], spd: 7, pow: 9, def: 6 },
  { id: 376, name: 'Métalosse', types: ['acier', 'psy'], spd: 5, pow: 9, def: 10 },
  { id: 392, name: 'Simiabraz', types: ['feu', 'combat'], spd: 8, pow: 7, def: 5 },
  { id: 395, name: 'Pingoléon', types: ['eau', 'acier'], spd: 5, pow: 8, def: 8 },
  { id: 407, name: 'Roserade', types: ['plante', 'poison'], spd: 7, pow: 8, def: 4 },
  { id: 423, name: 'Tritosor', types: ['eau', 'sol'], spd: 4, pow: 6, def: 7 },
  { id: 442, name: 'Spiritomb', types: ['spectre', 'tenebres'], spd: 5, pow: 7, def: 8 },
  { id: 445, name: 'Carchacrok', types: ['dragon', 'sol'], spd: 8, pow: 9, def: 7 },
  { id: 448, name: 'Lucario', types: ['combat', 'acier'], spd: 8, pow: 8, def: 6 },
  { id: 460, name: 'Blizzaroi', types: ['plante', 'glace'], spd: 4, pow: 8, def: 7 },
  { id: 466, name: 'Élekable', types: ['electrik'], spd: 6, pow: 9, def: 5 },
]

export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]))

// Hissatsu de tir, un par type (nom, puissance, coût PP)
const SHOTS: Record<PType, [string, number, number]> = {
  normal: ['Giga Impact', 115, 30],
  feu: ['Lance-Flammes', 120, 30],
  eau: ['Hydrocanon', 120, 30],
  plante: ['Éco-Sphère', 115, 25],
  electrik: ['Tonnerre', 120, 30],
  glace: ['Laser Glace', 115, 30],
  combat: ['Exploforce', 120, 30],
  poison: ['Bomb-Beurk', 110, 25],
  sol: ['Telluriforce', 120, 30],
  vol: ['Lame d’Air', 110, 25],
  psy: ['Psyko', 120, 30],
  insecte: ['Bourdon', 110, 25],
  roche: ['Lame de Roc', 115, 30],
  spectre: ['Ball’Ombre', 115, 25],
  dragon: ['Dracochoc', 125, 35],
  tenebres: ['Vibrobscur', 115, 25],
  acier: ['Luminocanon', 120, 30],
}

// Hissatsu secondaire (dribble / tacle), selon le type principal
const SECOND: Partial<Record<PType, [MoveFamily, string, number]>> = {
  vol: ['TACLE', 'Cru-Aile', 15],
  combat: ['TACLE', 'Close Combat', 25],
  sol: ['TACLE', 'Séisme', 25],
  roche: ['TACLE', 'Éboulement', 20],
  acier: ['TACLE', 'Griffe Acier', 15],
  tenebres: ['TACLE', 'Mâchouille', 15],
  dragon: ['TACLE', 'Draco-Griffe', 20],
  insecte: ['TACLE', 'Mégacorne', 20],
  electrik: ['DRIBBLE', 'Vive-Attaque', 10],
  normal: ['DRIBBLE', 'Vive-Attaque', 10],
  psy: ['DRIBBLE', 'Téléport', 15],
  spectre: ['DRIBBLE', 'Hypnose', 15],
  feu: ['DRIBBLE', 'Danse Flamme', 15],
  eau: ['DRIBBLE', 'Aqua-Jet', 10],
  plante: ['DRIBBLE', 'Poudre Dodo', 15],
  poison: ['DRIBBLE', 'Toxik', 15],
  glace: ['DRIBBLE', 'Patinage', 10],
}

/** Les 2 hissatsu d'un Pokémon : [tir, secondaire]. Le gardien troque le secondaire contre Abri. */
export function movesFor(sp: Species, role: Role): [Move, Move] {
  const main = sp.types[0]
  const [sn, sp_, sc] = SHOTS[main]
  const shot: Move = { name: sn, family: 'TIR', type: main, power: sp_, cost: sc }
  if (role === 'GK') {
    return [shot, { name: 'Abri', family: 'ARRET', type: 'normal', power: 95, cost: 25 }]
  }
  const sec = SECOND[main] ?? (['DRIBBLE', 'Vive-Attaque', 10] as [MoveFamily, string, number])
  return [shot, { name: sec[1], family: sec[0], type: main, power: 0, cost: sec[2] }]
}

export interface TrainerDef {
  id: string // clé du sprite Showdown
  name: string
  title: string
  difficulty: 1 | 2 | 3
  team: number[] // 6 ids d'espèces
}

// Dresseurs canon (gens 1-5) -> équipes composées avec le roster disponible
export const TRAINERS: TrainerDef[] = [
  { id: 'cynthia', name: 'Cynthia', title: 'Ligue Sinnoh · Championne', difficulty: 3, team: [445, 282, 442, 448, 407, 350] },
  { id: 'red', name: 'Red', title: 'Mont Argenté · Maître', difficulty: 3, team: [25, 3, 6, 9, 143, 65] },
  { id: 'blue', name: 'Blue', title: 'Kanto · Rival', difficulty: 2, team: [65, 59, 9, 130, 94, 68] },
  { id: 'lance', name: 'Lance', title: 'Ligue Kanto · Maître Dragon', difficulty: 3, team: [149, 130, 6, 373, 445, 248] },
  { id: 'steven', name: 'Pierre Rochard', title: 'Hoenn · Champion', difficulty: 2, team: [376, 306, 248, 423, 448, 395] },
  { id: 'brock', name: 'Pierre', title: 'Argenta · Champion d’Arène', difficulty: 1, team: [248, 306, 423, 68, 143, 442] },
  { id: 'misty', name: 'Ondine', title: 'Azuria · Championne d’Arène', difficulty: 1, team: [131, 9, 130, 350, 395, 423] },
  { id: 'erika', name: 'Érika', title: 'Céladopole · Championne d’Arène', difficulty: 1, team: [3, 407, 460, 282, 94, 143] },
  { id: 'sabrina', name: 'Morgane', title: 'Safrania · Championne d’Arène', difficulty: 2, team: [65, 282, 94, 442, 376, 466] },
  { id: 'giovanni', name: 'Giovanni', title: 'Team Rocket · Boss', difficulty: 2, team: [143, 248, 68, 306, 423, 392] },
  { id: 'alder', name: 'Goyah', title: 'Unys · Maître', difficulty: 3, team: [392, 59, 466, 448, 460, 445] },
  { id: 'iris', name: 'Iris', title: 'Unys · Championne', difficulty: 3, team: [149, 373, 445, 131, 466, 6] },
]

export const TRAINER_BY_ID = new Map(TRAINERS.map((t) => [t.id, t]))
