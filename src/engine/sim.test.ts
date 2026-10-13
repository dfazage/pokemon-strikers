import { describe, expect, it } from 'vitest'
import { createMatch, step, NO_INPUT, DT, W, H, type GameState, type Input } from './sim'
import { dailyChallenge } from './daily'
import { effectiveness } from './types'

// Bot très simple qui joue l'équipe 0 : fonce au but, tire, passe parfois, utilise le hissatsu.
function botInput(s: GameState): Input {
  const f = s.fighters[s.controlled]
  const i: Input = { ...NO_INPUT }
  if (s.phase === 'duel') { i.press = s.duel!.t > 12 + ((s.tick * 7) % 55); return i }
  if (s.ball.owner === f.id) {
    i.mx = (50 - f.x) / 30
    i.my = -1
    if (f.y < 60) {
      if (s.tick % 7 === 0) i.special1 = true
      i.shootDown = f.y > 40
    }
  } else {
    i.mx = Math.sign(s.ball.x - f.x)
    i.my = Math.sign(s.ball.y - f.y)
    if (Math.hypot(s.ball.x - f.x, s.ball.y - f.y) < 14 && s.tick % 20 === 0) i.tackle = true
  }
  return i
}

function play(key: string, bot = true) {
  const d = dailyChallenge(key)
  const s = createMatch(d.options)
  let guard = 0
  while (s.phase !== 'end' && guard++ < 60 * 400) step(s, bot ? botInput(s) : NO_INPUT)
  return s
}

describe('type chart', () => {
  it('efficacité de base', () => {
    expect(effectiveness('feu', ['plante'])).toBe(2)
    expect(effectiveness('eau', ['plante', 'dragon'])).toBe(0.25)
    expect(effectiveness('normal', ['spectre'])).toBe(0)
  })
})

describe('daily', () => {
  it('est déterministe pour un jour donné', () => {
    const a = dailyChallenge('2026-10-14')
    const b = dailyChallenge('2026-10-14')
    expect(a.trainer.id).toBe(b.trainer.id)
    expect(a.ours).toEqual(b.ours)
    expect(a.ours).toHaveLength(5)
    expect(new Set(a.ours.map((o) => o.speciesId)).size).toBe(5)
  })
})

describe('match', () => {
  it('même seed + mêmes inputs => même résultat', () => {
    const a = play('2026-10-15')
    const b = play('2026-10-15')
    expect(a.teams[0].score).toBe(b.teams[0].score)
    expect(a.teams[1].score).toBe(b.teams[1].score)
    expect(a.tick).toBe(b.tick)
  })

  it('se termine toujours, balle et joueurs restent dans le terrain', () => {
    for (let d = 1; d <= 12; d++) {
      const key = `2026-11-${String(d).padStart(2, '0')}`
      const s = createMatch(dailyChallenge(key).options)
      let guard = 0
      while (s.phase !== 'end' && guard++ < 60 * 400) {
        step(s, botInput(s))
        expect(s.ball.x).toBeGreaterThanOrEqual(0)
        expect(s.ball.x).toBeLessThanOrEqual(W)
        expect(s.ball.y).toBeGreaterThanOrEqual(-2)
        expect(s.ball.y).toBeLessThanOrEqual(H + 2)
      }
      expect(s.phase).toBe('end')
      expect(s.elapsed).toBeLessThan(130)
    }
  })

  it('un humain passif encaisse plus qu’il ne marque (IA adverse active)', () => {
    let conceded = 0
    let scored = 0
    for (let d = 1; d <= 12; d++) {
      const s = play(`2026-12-${String(d).padStart(2, '0')}`, false)
      conceded += s.teams[1].score
      scored += s.teams[0].score
    }
    expect(conceded).toBeGreaterThan(scored)
  })

  it('statistiques du bot (info)', () => {
    let w = 0, l = 0, dr = 0, goals = 0, goalsAgainst = 0
    const N = 40
    for (let d = 0; d < N; d++) {
      const s = play(`2027-01-${String((d % 28) + 1).padStart(2, '0')}x${d}`)
      if (s.winner === 0) w++
      else if (s.winner === 1) l++
      else dr++
      goals += s.teams[0].score
      goalsAgainst += s.teams[1].score
    }
    console.log(`bot: ${w}V ${dr}N ${l}D sur ${N}, buts ${goals}-${goalsAgainst}`)
    expect(DT).toBeGreaterThan(0)
  })
})
