// Sauvegarde locale : cœurs du jour, série, record. Aucune donnée ne quitte l'appareil dans le MVP.
export interface Attempt {
  gf: number
  ga: number
  result: 'win' | 'draw' | 'loss'
  hissatsu: number
  score: number
}

export interface DayRecord {
  heartsLeft: number
  done: boolean
  won: boolean
  attempts: Attempt[]
  events?: string // grille de partage
}

export interface Save {
  v: 1
  streak: number
  best: number
  wins: number
  played: number
  score: number // score cumulé
  lastWinKey: string | null
  days: Record<string, DayRecord>
}

const KEY = 'pokemon-strikers.v1'
export const HEARTS = 3

export function emptySave(): Save {
  return { v: 1, streak: 0, best: 0, wins: 0, played: 0, score: 0, lastWinKey: null, days: {} }
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptySave()
    const p = JSON.parse(raw) as Save
    return p && p.v === 1 ? p : emptySave()
  } catch {
    return emptySave()
  }
}

export function persist(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* stockage indisponible : on joue quand même */
  }
}

export function prevKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

export function dayRecord(s: Save, key: string): DayRecord {
  return s.days[key] ?? { heartsLeft: HEARTS, done: false, won: false, attempts: [] }
}

/** Série affichée : remise à zéro si la dernière victoire est plus vieille qu'hier. */
export function currentStreak(s: Save, key: string): number {
  if (!s.lastWinKey) return 0
  return s.lastWinKey === key || s.lastWinKey === prevKey(key) ? s.streak : 0
}

export function recordAttempt(s: Save, key: string, a: Attempt, events: string): Save {
  const rec = { ...dayRecord(s, key) }
  rec.attempts = [...rec.attempts, a]
  rec.events = events
  const next: Save = { ...s, days: { ...s.days }, played: s.played + 1 }
  if (a.result === 'win') {
    rec.done = true
    rec.won = true
    const base = currentStreak(s, key)
    next.streak = s.lastWinKey === key ? s.streak : base + 1
    next.best = Math.max(s.best, next.streak)
    next.lastWinKey = key
    next.wins = s.wins + 1
    next.score = s.score + a.score
  } else {
    rec.heartsLeft = Math.max(0, rec.heartsLeft - 1)
    if (rec.heartsLeft === 0) {
      rec.done = true
      next.streak = 0
    }
  }
  next.days[key] = rec
  persist(next)
  return next
}
