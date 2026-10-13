import type { GameState } from './engine/sim'
import type { DailyChallenge } from './engine/daily'
import type { Attempt, DayRecord } from './storage'

/** Ligne d'événements en emojis : ⚽ but, 🔥 hissatsu, 🧤 arrêt, ✨ passe parfaite. */
export function eventLine(s: GameState): string {
  const parts: string[] = []
  for (const e of s.log) {
    const mine = e.team === 0
    if (e.kind === 'goal') parts.push(mine ? '⚽' : '🟥')
    else if (e.kind === 'hissatsu' && mine) parts.push('🔥')
    else if (e.kind === 'perfect' && mine) parts.push('✨')
    else if (e.kind === 'save' && mine) parts.push('🧤')
  }
  return parts.slice(0, 24).join('') || '—'
}

export function shareText(d: DailyChallenge, rec: DayRecord, a: Attempt): string {
  const hearts = '❤️'.repeat(rec.heartsLeft) + '🖤'.repeat(3 - rec.heartsLeft)
  const res = a.result === 'win' ? '🏆' : a.result === 'draw' ? '🤝' : '💥'
  return [
    `Pokémon Strikers #${d.number} ${res} ${a.gf}-${a.ga} vs ${d.trainer.name}`,
    hearts,
    rec.events ?? '',
  ].join('\n')
}
