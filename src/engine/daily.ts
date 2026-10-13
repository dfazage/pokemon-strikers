// Défi du jour : équipe imposée + dresseur canon, identiques pour tout le monde (seed = jour).
import { Rng, hashString } from './rng'
import { SPECIES, SPECIES_BY_ID, TRAINERS, type TrainerDef } from './data'
import type { FighterSetup, MatchOptions } from './sim'

/** Clé du jour : changement à 12:00 heure de Paris (comme Pokédle). */
export function dayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  let y = get('year'), m = get('month'), d = get('day')
  if (get('hour') < 12) {
    const prev = new Date(Date.UTC(y, m - 1, d) - 86400000)
    y = prev.getUTCFullYear(); m = prev.getUTCMonth() + 1; d = prev.getUTCDate()
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Numéro de défi (jour 1 = 2026-10-13). */
export function dayNumber(key: string): number {
  const base = Date.UTC(2026, 9, 13)
  const [y, m, d] = key.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - base) / 86400000) + 1
}

/** Attribue les rôles : GK = meilleure défense, FWD = meilleure puissance, puis DEF, MID, MID. Capitaine = meilleur total. */
export function assignRoles(ids: number[]): { starters: FighterSetup[]; reserve: number } {
  const pool = ids.map((id) => SPECIES_BY_ID.get(id)!)
  const total = (s: (typeof pool)[number]) => s.spd + s.pow + s.def
  // le 6e (le plus faible) devient remplaçant
  const sorted = pool.slice().sort((a, b) => total(b) - total(a))
  const reserve = sorted[sorted.length - 1]
  const five = sorted.slice(0, 5)
  const captain = five[0]
  const gk = five.slice().sort((a, b) => b.def - a.def)[0]
  let rest = five.filter((s) => s !== gk)
  const fwd = rest.slice().sort((a, b) => b.pow - a.pow)[0]
  rest = rest.filter((s) => s !== fwd)
  const def = rest.slice().sort((a, b) => b.def - a.def)[0]
  const mids = rest.filter((s) => s !== def)
  const mk = (sp: (typeof pool)[number], role: FighterSetup['role']): FighterSetup => ({ speciesId: sp.id, role, captain: sp === captain })
  return {
    starters: [mk(gk, 'GK'), mk(def, 'DEF'), mk(mids[0], 'MID'), mk(mids[1], 'MID'), mk(fwd, 'FWD')],
    reserve: reserve.id,
  }
}

export interface DailyChallenge {
  key: string
  number: number
  trainer: TrainerDef
  ours: FighterSetup[]
  oursReserve: number
  theirs: FighterSetup[]
  options: MatchOptions
}

export function dailyChallenge(key: string): DailyChallenge {
  const h = hashString('strikers:' + key)
  const rng = new Rng(h)
  const trainer = TRAINERS[h % TRAINERS.length]
  // équipe imposée : 6 espèces tirées au sort, hors équipe du dresseur pour limiter les miroirs
  const banned = new Set(trainer.team)
  const pool = SPECIES.filter((s) => !banned.has(s.id)).map((s) => s.id)
  const ids = rng.shuffle(pool).slice(0, 6)
  const mine = assignRoles(ids)
  const theirs = assignRoles(trainer.team)
  return {
    key, number: dayNumber(key), trainer,
    ours: mine.starters, oursReserve: mine.reserve, theirs: theirs.starters,
    options: { seed: h ^ 0x9e3779b9, ours: mine.starters, theirs: theirs.starters, difficulty: trainer.difficulty },
  }
}
