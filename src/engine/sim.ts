// Moteur de match déterministe : aucune dépendance à React/DOM/Date/Math.random.
// Pas de temps fixe (60 Hz). Terrain vertical 100 x 150 unités ; l'équipe 0 (nous) attaque vers y = 0.
import { Rng } from './rng'
import { duelEffect, type PType } from './types'
import { movesFor, SPECIES_BY_ID, type Move, type Role, type Species } from './data'

export const W = 100
export const H = 150
export const GOAL_L = 36
export const GOAL_R = 64
export const DT = 1 / 60
export const MATCH_SECONDS = 90
export const OVERTIME_SECONDS = 30
export const PP_MAX = 100
export const PERFECT_ZONE: [number, number] = [0.58, 0.8]

export type TeamId = 0 | 1

export interface Status {
  slow: number
  para: number
  freeze: number
  burn: number
}

export interface Fighter {
  id: number
  team: TeamId
  role: Role
  sp: Species
  moves: [Move, Move]
  captain: boolean
  x: number
  y: number
  vx: number
  vy: number
  fx: number // direction regardée
  fy: number
  stun: number
  tackleCd: number
  invuln: number
  boost: number
  lunge: number
  lungeSpecial: boolean
  lungeX: number
  lungeY: number
  charge: number
  shotBoost: boolean
  aiShootT: number
  aiShootCharge: number
  aiAimX: number
  holdT: number
  status: Status
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  owner: number | null
  lastTeam: TeamId
  noPickupId: number
  noPickupT: number
  passTarget: number | null
  shotBy: TeamId | null
  shotSpeed: number
  gkErr: number
}

export interface TeamState {
  score: number
  pp: number
  hissatsu: number
  tackles: number
  perfects: number
}

export interface DuelState {
  shooterId: number
  keeperId: number
  move: Move
  t: number // ticks écoulés
  marker: number // 0..1
  autoPressAt: number // tick où l'IA appuie (équipe 1) ou délai max (équipe 0)
  aiQuality: number // 0..1 qualité du timing IA
  result: DuelResult | null
}

export interface DuelResult {
  goal: boolean
  atk: number
  shield: number
  eff: number
  timing: number
  perfect: boolean
  shield_move: string
}

export type Phase = 'kickoff' | 'play' | 'duel' | 'duelResult' | 'goal' | 'end'

export interface GameEvent {
  kind: 'goal' | 'hissatsu' | 'save' | 'perfect' | 'tackle'
  team: TeamId
  sec: number // secondes écoulées
  fighter: number
  label?: string
}

export interface Input {
  mx: number
  my: number
  shootDown: boolean
  pass: boolean // front montant
  tackle: boolean // front montant
  special1: boolean // front montant (hissatsu de tir)
  special2: boolean // front montant (hissatsu secondaire)
  press: boolean // front montant (timing du duel)
}

export const NO_INPUT: Input = {
  mx: 0, my: 0, shootDown: false, pass: false, tackle: false, special1: false, special2: false, press: false,
}

export interface GameState {
  tick: number
  elapsed: number
  time: number // secondes restantes
  overtime: boolean
  phase: Phase
  phaseT: number
  fighters: Fighter[]
  ball: Ball
  teams: [TeamState, TeamState]
  controlled: number
  duel: DuelState | null
  lastDuel: DuelResult | null
  log: GameEvent[]
  difficulty: 1 | 2 | 3
  rng: Rng
  lastPassPress: number
  pickupTick: number
  pickupId: number
  winner: TeamId | null
  banner: { text: string; t: number } | null
}

export interface FighterSetup {
  speciesId: number
  role: Role
  captain: boolean
}

export interface MatchOptions {
  seed: number
  ours: FighterSetup[] // 5 joueurs, ordre GK, DEF, MID, MID, FWD
  theirs: FighterSetup[]
  difficulty: 1 | 2 | 3
}

// positions de base équipe 0 (nous, en bas) : GK, DEF, MID, MID, FWD
const BASE: [number, number][] = [[50, 141], [50, 114], [27, 88], [73, 88], [50, 62]]
const ROLE_SHIFT: Record<Role, number> = { GK: 0, DEF: 12, MID: 22, FWD: 30 }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const len = (x: number, y: number) => Math.hypot(x, y)

function mkFighter(id: number, team: TeamId, setup: FighterSetup, idx: number): Fighter {
  const sp = SPECIES_BY_ID.get(setup.speciesId)
  if (!sp) throw new Error(`Espèce inconnue ${setup.speciesId}`)
  const [hx, hy] = BASE[idx]
  const y = team === 0 ? hy : H - hy
  return {
    id, team, role: setup.role, sp, moves: movesFor(sp, setup.role), captain: setup.captain,
    x: hx, y, vx: 0, vy: 0, fx: 0, fy: team === 0 ? -1 : 1,
    stun: 0, tackleCd: 0, invuln: 0, boost: 0, lunge: 0, lungeSpecial: false, lungeX: 0, lungeY: 0,
    charge: 0, shotBoost: false, aiShootT: 0, aiShootCharge: 0, aiAimX: 50, holdT: 0,
    status: { slow: 0, para: 0, freeze: 0, burn: 0 },
  }
}

export function createMatch(opts: MatchOptions): GameState {
  const fighters: Fighter[] = []
  opts.ours.forEach((s, i) => fighters.push(mkFighter(i, 0, s, i)))
  opts.theirs.forEach((s, i) => fighters.push(mkFighter(5 + i, 1, s, i)))
  const mkTeam = (): TeamState => ({ score: 0, pp: 50, hissatsu: 0, tackles: 0, perfects: 0 })
  const s: GameState = {
    tick: 0, elapsed: 0, time: MATCH_SECONDS, overtime: false, phase: 'kickoff', phaseT: 120,
    fighters,
    ball: { x: 50, y: H / 2, vx: 0, vy: 0, owner: null, lastTeam: 0, noPickupId: -1, noPickupT: 0, passTarget: null, shotBy: null, shotSpeed: 0, gkErr: 0 },
    teams: [mkTeam(), mkTeam()],
    controlled: 4, duel: null, lastDuel: null, log: [], difficulty: opts.difficulty, rng: new Rng(opts.seed),
    lastPassPress: -999, pickupTick: -999, pickupId: -1, winner: null,
    banner: { text: 'COUP D’ENVOI', t: 100 },
  }
  resetKickoff(s, 0)
  return s
}

function resetKickoff(s: GameState, kickTeam: TeamId) {
  s.fighters.forEach((f, i) => {
    const idx = i % 5
    const [hx, hy] = BASE[idx]
    f.x = hx
    f.y = f.team === 0 ? hy : H - hy
    f.vx = f.vy = 0
    f.fx = 0
    f.fy = f.team === 0 ? -1 : 1
    f.stun = f.lunge = f.invuln = f.boost = 0
    f.charge = 0
    f.shotBoost = false
    f.aiShootT = 0
    f.holdT = 0
    f.status = { slow: 0, para: 0, freeze: 0, burn: 0 }
  })
  const kicker = s.fighters[kickTeam === 0 ? 4 : 9]
  kicker.x = 50
  kicker.y = kickTeam === 0 ? H / 2 + 6 : H / 2 - 6
  s.ball = { ...s.ball, x: kicker.x, y: H / 2, vx: 0, vy: 0, owner: kicker.id, lastTeam: kickTeam, passTarget: null, shotBy: null, noPickupT: 0 }
  s.controlled = 4
  s.duel = null
  s.phase = 'kickoff'
  s.phaseT = 75
}

// ---------- utilitaires ----------
const goalY = (t: TeamId) => (t === 0 ? 0 : H) // but que `t` attaque
const ownGoalY = (t: TeamId) => (t === 0 ? H : 0)
export const gkOf = (s: GameState, t: TeamId) => s.fighters[t === 0 ? 0 : 5]

function speedOf(s: GameState, f: Fighter): number {
  let v = 16 + 1.8 * f.sp.spd
  if (f.role === 'GK') v *= 1.2
  if (f.boost > 0) v *= 1.5
  if (s.ball.owner === f.id) v *= 0.93
  if (f.status.slow > 0) v *= 0.55
  if (f.status.para > 0) v *= 0.3
  if (f.status.freeze > 0) v = 0
  if (f.team === 1) v *= [0, 0.9, 0.98, 1.05][s.difficulty]
  return v
}

function setBannerText(s: GameState, text: string, t = 70) {
  s.banner = { text, t }
}

function pushEvent(s: GameState, e: Omit<GameEvent, 'sec'>) {
  s.log.push({ ...e, sec: Math.round(s.elapsed) })
}

function isHuman(s: GameState, f: Fighter) {
  return f.team === 0 && f.id === s.controlled
}

// ---------- étape principale ----------
export function step(s: GameState, input: Input): void {
  if (s.phase === 'end') return
  s.tick++
  if (s.banner && --s.banner.t <= 0) s.banner = null

  if (s.phase === 'kickoff') {
    if (--s.phaseT <= 0) s.phase = 'play'
    // la balle suit son propriétaire, mais personne ne bouge
    syncCarriedBall(s)
    return
  }
  if (s.phase === 'duel') return stepDuel(s, input)
  if (s.phase === 'duelResult') {
    if (--s.phaseT <= 0) {
      if (s.winner !== null) {
        s.phase = 'end'
      } else if (s.lastDuel?.goal) {
        resetKickoff(s, s.ball.lastTeam === 0 ? 1 : 0)
      } else {
        s.phase = 'play'
      }
    }
    return
  }
  if (s.phase === 'goal') {
    if (--s.phaseT <= 0) {
      if (s.winner !== null) s.phase = 'end'
      else resetKickoff(s, s.ball.lastTeam === 0 ? 1 : 0)
    }
    return
  }

  // ----- phase de jeu -----
  s.elapsed += DT
  s.time -= DT
  if (s.time <= 0) {
    if (s.teams[0].score !== s.teams[1].score) {
      endMatch(s)
      return
    }
    if (!s.overtime) {
      s.overtime = true
      s.time = OVERTIME_SECONDS
      setBannerText(s, 'MORT SUBITE', 110)
    } else {
      endMatch(s)
      return
    }
  }

  for (const t of s.teams) t.pp = Math.min(PP_MAX, t.pp + 1.3 * DT)
  for (const f of s.fighters) tickTimers(f)

  selectControlled(s)
  humanActions(s, input)
  const chasers = pickChasers(s)
  for (const f of s.fighters) {
    if (f.stun > 0 || f.status.freeze > 0) {
      f.vx *= 0.8
      f.vy *= 0.8
    } else if (f.lunge > 0) {
      f.vx = f.lungeX
      f.vy = f.lungeY
      f.lunge--
      checkLungeHit(s, f)
    } else if (isHuman(s, f)) {
      moveHuman(s, f, input)
    } else {
      aiThink(s, f, chasers)
    }
    f.x = clamp(f.x + f.vx * DT, 3, W - 3)
    f.y = clamp(f.y + f.vy * DT, 3, H - 3)
    if (Math.abs(f.vx) + Math.abs(f.vy) > 4 && f.lunge === 0) {
      const l = len(f.vx, f.vy)
      f.fx = f.vx / l
      f.fy = f.vy / l
    }
  }
  updateBall(s)
}

function tickTimers(f: Fighter) {
  if (f.stun > 0) f.stun--
  if (f.tackleCd > 0) f.tackleCd--
  if (f.invuln > 0) f.invuln--
  if (f.boost > 0) f.boost--
  const st = f.status
  if (st.slow > 0) st.slow -= 1
  if (st.para > 0) st.para -= 1
  if (st.freeze > 0) st.freeze -= 1
  if (st.burn > 0) st.burn -= 1
}

function endMatch(s: GameState) {
  const a = s.teams[0].score
  const b = s.teams[1].score
  s.winner = a > b ? 0 : b > a ? 1 : null
  s.phase = 'end'
}

function syncCarriedBall(s: GameState) {
  const b = s.ball
  if (b.owner === null) return
  const o = s.fighters[b.owner]
  b.x = o.x + o.fx * 3.6
  b.y = o.y + o.fy * 3.6
  b.vx = b.vy = 0
}

// ---------- sélection du joueur contrôlé ----------
function selectControlled(s: GameState) {
  const b = s.ball
  const cur = s.fighters[s.controlled]
  if (b.owner !== null && s.fighters[b.owner].team === 0 && s.fighters[b.owner].role !== 'GK') {
    s.controlled = b.owner
    return
  }
  if (b.passTarget !== null && s.fighters[b.passTarget].team === 0 && s.fighters[b.passTarget].role !== 'GK') {
    s.controlled = b.passTarget
    return
  }
  let best = -1
  let bd = 1e9
  for (let i = 1; i < 5; i++) {
    const f = s.fighters[i]
    const d = len(f.x - b.x, f.y - b.y)
    if (d < bd) { bd = d; best = i }
  }
  const dc = len(cur.x - b.x, cur.y - b.y)
  if (cur.role === 'GK' || bd < dc - 5) s.controlled = best
}

// ---------- humain ----------
function moveHuman(s: GameState, f: Fighter, input: Input) {
  const m = len(input.mx, input.my)
  const k = m > 1 ? 1 / m : 1
  const sp = speedOf(s, f) * (f.charge > 0 ? 0.35 : 1)
  f.vx += (input.mx * k * sp - f.vx) * 0.3
  f.vy += (input.my * k * sp - f.vy) * 0.3
}

function humanActions(s: GameState, input: Input) {
  const f = s.fighters[s.controlled]
  if (f.team !== 0) return
  const b = s.ball
  const owns = b.owner === f.id
  if (input.pass) {
    if (owns && f.stun === 0) doPass(s, f, input.mx, input.my)
    else {
      s.lastPassPress = s.tick
      // appui juste après la réception => passe parfaite
      if (b.owner === f.id && s.tick - s.pickupTick <= 8) grantPerfect(s, f)
    }
  }
  if (owns && f.stun === 0) {
    if (input.shootDown) {
      f.charge = Math.min(1, f.charge + DT / 0.85)
    } else if (f.charge > 0) {
      shoot(s, f, Math.max(f.charge, 0.22), 50 + clamp(input.mx, -1, 1) * 12)
      f.charge = 0
    }
    if (input.special1) tryHissatsuShot(s, f)
    else if (input.special2 && f.moves[1].family === 'DRIBBLE') tryDribble(s, f)
  } else {
    f.charge = 0
    if (input.tackle && f.tackleCd === 0 && f.stun === 0) startTackle(s, f, input.mx, input.my, false)
    else if (input.special2 && f.moves[1].family === 'TACLE' && f.stun === 0 && f.tackleCd === 0) {
      const t = s.teams[0]
      if (t.pp >= f.moves[1].cost) {
        t.pp -= f.moves[1].cost
        t.hissatsu++
        pushEvent(s, { kind: 'hissatsu', team: 0, fighter: f.id, label: f.moves[1].name })
        setBannerText(s, f.moves[1].name.toUpperCase())
        startTackle(s, f, input.mx, input.my, true)
      }
    }
  }
  if (owns && input.tackle) {
    // le porteur peut aussi feinter : petit dash latéral
    if (f.tackleCd === 0) {
      f.tackleCd = 40
      f.invuln = 14
      const sx = input.mx !== 0 ? Math.sign(input.mx) : 1
      f.vx = sx * 55
    }
  }
}

function grantPerfect(s: GameState, f: Fighter) {
  if (f.shotBoost) return
  f.shotBoost = true
  f.boost = 50
  s.teams[f.team].perfects++
  pushEvent(s, { kind: 'perfect', team: f.team, fighter: f.id })
  setBannerText(s, 'PASSE PARFAITE !', 60)
}

function doPass(s: GameState, f: Fighter, mx: number, my: number) {
  const aim = len(mx, my) > 0.2 ? [mx / len(mx, my), my / len(mx, my)] : [0, f.team === 0 ? -1 : 1]
  let best: Fighter | null = null
  let bs = -1e9
  for (const m of s.fighters) {
    if (m.team !== f.team || m.id === f.id) continue
    const dx = m.x - f.x
    const dy = m.y - f.y
    const d = len(dx, dy)
    if (d < 8) continue
    const dot = (dx * aim[0] + dy * aim[1]) / d
    const score = dot * 1.0 - d * 0.004 - (m.role === 'GK' ? 0.4 : 0)
    if (score > bs) { bs = score; best = m }
  }
  if (best) passTo(s, f, best)
}

function passTo(s: GameState, f: Fighter, target: Fighter) {
  const b = s.ball
  const lead = 0.22
  const tx = target.x + target.vx * lead
  const ty = target.y + target.vy * lead
  const dx = tx - f.x
  const dy = ty - f.y
  const d = len(dx, dy) || 1
  const speed = 78
  b.owner = null
  b.vx = (dx / d) * speed
  b.vy = (dy / d) * speed
  b.x = f.x + (dx / d) * 4
  b.y = f.y + (dy / d) * 4
  b.passTarget = target.id
  b.noPickupId = f.id
  b.noPickupT = 22
  b.shotBy = null
  b.lastTeam = f.team
}

function shoot(s: GameState, f: Fighter, charge: number, aimX: number) {
  const b = s.ball
  const gy = goalY(f.team)
  let dx = aimX - f.x
  let dy = gy - f.y
  const dist = len(dx, dy) || 1
  let c = charge
  if (f.shotBoost) c = Math.max(c, 0.7)
  const err = s.rng.range(-1, 1) * (0.012 + 0.09 * (dist / 110) * (1.15 - c))
  const ang = Math.atan2(dy, dx) + err
  dx = Math.cos(ang)
  dy = Math.sin(ang)
  const speed = (52 + 78 * c) * (0.85 + 0.03 * f.sp.pow) * (f.shotBoost ? 1.12 : 1)
  f.shotBoost = false
  b.owner = null
  b.vx = dx * speed
  b.vy = dy * speed
  b.x = f.x + dx * 4
  b.y = f.y + dy * 4
  b.shotBy = f.team
  b.shotSpeed = speed
  b.passTarget = null
  b.lastTeam = f.team
  b.noPickupId = f.id
  b.noPickupT = 20
  const gk = gkOf(s, f.team === 0 ? 1 : 0)
  b.gkErr = s.rng.range(-1, 1) * (s.difficulty === 3 ? 3 : s.difficulty === 2 ? 5 : 7) * (gk.team === 1 ? 1 : 1.2)
}

// ---------- hissatsu ----------
function distToGoal(f: Fighter) {
  return len(50 - f.x, goalY(f.team) - f.y)
}

function tryHissatsuShot(s: GameState, f: Fighter) {
  const mv = f.moves[0]
  const t = s.teams[f.team]
  if (t.pp < mv.cost || distToGoal(f) > 72) return false
  t.pp -= mv.cost
  t.hissatsu++
  pushEvent(s, { kind: 'hissatsu', team: f.team, fighter: f.id, label: mv.name })
  const keeper = gkOf(s, f.team === 0 ? 1 : 0)
  s.phase = 'duel'
  s.duel = {
    shooterId: f.id, keeperId: keeper.id, move: mv, t: 0, marker: 0,
    autoPressAt: f.team === 0 ? 150 : 40 + s.rng.int(50),
    aiQuality: s.rng.next(), result: null,
  }
  f.charge = 0
  return true
}

function tryDribble(s: GameState, f: Fighter) {
  const mv = f.moves[1]
  const t = s.teams[f.team]
  if (t.pp < mv.cost) return false
  t.pp -= mv.cost
  t.hissatsu++
  f.invuln = 110
  f.boost = 110
  pushEvent(s, { kind: 'hissatsu', team: f.team, fighter: f.id, label: mv.name })
  if (f.team === 0) setBannerText(s, mv.name.toUpperCase())
  return true
}

export function markerAt(t: number): number {
  const p = (t / 60) * 1.3 * 2 // 1,3 aller-retour par seconde
  const m = p % 2
  return m > 1 ? 2 - m : m
}

export function timingMult(marker: number): { mult: number; perfect: boolean } {
  const [a, b] = PERFECT_ZONE
  if (marker >= a && marker <= b) return { mult: 1.2, perfect: true }
  const d = marker < a ? a - marker : marker - b
  return { mult: Math.max(0.8, 1 - 0.4 * d), perfect: false }
}

function stepDuel(s: GameState, input: Input) {
  const d = s.duel!
  d.t++
  d.marker = markerAt(d.t)
  const shooter = s.fighters[d.shooterId]
  let press = false
  if (shooter.team === 0) {
    press = input.press || d.t >= d.autoPressAt
  } else if (d.t >= d.autoPressAt) {
    press = true
    // l'IA vise la zone avec une précision qui dépend de la difficulté
    const q = [0, 0.25, 0.4, 0.55][s.difficulty]
    if (d.aiQuality < q) d.marker = (PERFECT_ZONE[0] + PERFECT_ZONE[1]) / 2
    else d.marker = d.aiQuality
  }
  if (press) resolveDuel(s, d.marker)
}

function resolveDuel(s: GameState, marker: number) {
  const d = s.duel!
  const shooter = s.fighters[d.shooterId]
  const keeper = s.fighters[d.keeperId]
  const ktm = s.teams[keeper.team]
  const { mult, perfect } = timingMult(marker)
  const eff = duelEffect(d.move.type, keeper.sp.types)
  let shield: number
  let shieldMove = 'Plongeon'
  const ark = keeper.moves[1]
  if (ark.family === 'ARRET' && ktm.pp >= ark.cost) {
    ktm.pp -= ark.cost
    shield = ark.power * (1 + 0.03 * keeper.sp.def)
    shieldMove = ark.name
  } else {
    shield = 45 * (1 + 0.03 * keeper.sp.def)
  }
  if (keeper.status.burn > 0) shield *= 0.8
  if (keeper.status.freeze > 0 || keeper.status.para > 0) shield *= 0.5
  const atk = 0.8 * d.move.power * eff * mult * (0.85 + 0.03 * shooter.sp.pow) * (shooter.captain ? 1.1 : 1) * (shooter.shotBoost ? 1.1 : 1)
  shooter.shotBoost = false
  const goal = atk > shield
  const res: DuelResult = { goal, atk: Math.round(atk), shield: Math.round(shield), eff, timing: mult, perfect, shield_move: shieldMove }
  d.result = res
  s.lastDuel = res
  s.phase = 'duelResult'
  s.phaseT = 110
  if (perfect) s.teams[shooter.team].perfects++
  const b = s.ball
  b.lastTeam = shooter.team
  b.shotBy = null
  b.passTarget = null
  if (goal) {
    registerGoal(s, shooter.team, shooter.id, d.move.name)
    // balle posée au fond des filets
    b.owner = null
    b.vx = b.vy = 0
    b.x = 50
    b.y = shooter.team === 0 ? 1 : H - 1
  } else {
    pushEvent(s, { kind: 'save', team: keeper.team, fighter: keeper.id, label: shieldMove })
    applyStatus(keeper, d.move.type)
    shooter.stun = 40
    b.owner = keeper.id
    keeper.x = clamp(keeper.x, GOAL_L + 4, GOAL_R - 4)
    syncCarriedBall(s)
  }
}

function applyStatus(f: Fighter, t: PType) {
  if (t === 'feu') f.status.burn = 360
  else if (t === 'eau') f.status.slow = 240
  else if (t === 'electrik') f.status.para = 150
  else if (t === 'glace') f.status.freeze = 150
}

function registerGoal(s: GameState, team: TeamId, scorer: number, label?: string) {
  s.teams[team].score++
  pushEvent(s, { kind: 'goal', team, fighter: scorer, label })
  s.ball.lastTeam = team
  setBannerText(s, 'BUT !', 120)
  if (s.overtime) s.winner = team
}

// ---------- tacle ----------
function startTackle(s: GameState, f: Fighter, mx: number, my: number, special: boolean) {
  const b = s.ball
  let dx = mx
  let dy = my
  if (b.owner !== null && s.fighters[b.owner].team !== f.team) {
    const o = s.fighters[b.owner]
    const d = len(o.x - f.x, o.y - f.y)
    if (d < 26) { dx = o.x - f.x; dy = o.y - f.y }
  }
  if (len(dx, dy) < 0.2) { dx = f.fx; dy = f.fy }
  const d = len(dx, dy) || 1
  const sp = special ? 95 : 64
  f.lungeX = (dx / d) * sp
  f.lungeY = (dy / d) * sp
  f.lunge = special ? 14 : 10
  f.lungeSpecial = special
  f.tackleCd = special ? 60 : 42
}

function checkLungeHit(s: GameState, f: Fighter) {
  const b = s.ball
  if (b.owner === null) return
  const o = s.fighters[b.owner]
  if (o.team === f.team || o.role === 'GK') return
  const reach = f.lungeSpecial ? 9 : 6
  if (len(o.x - f.x, o.y - f.y) > reach || o.invuln > 0) return
  const p = f.lungeSpecial ? 1 : clamp(0.6 + 0.04 * (f.sp.def - o.sp.spd), 0.35, 0.9)
  f.lunge = 0
  if (s.rng.next() < p) {
    b.owner = null
    b.vx = f.lungeX * 0.45 + s.rng.range(-8, 8)
    b.vy = f.lungeY * 0.45 + s.rng.range(-8, 8)
    b.noPickupId = o.id
    b.noPickupT = 36
    b.passTarget = null
    o.stun = 36
    o.charge = 0
    o.shotBoost = false
    s.teams[f.team].tackles++
    s.teams[f.team].pp = Math.min(PP_MAX, s.teams[f.team].pp + 4)
    pushEvent(s, { kind: 'tackle', team: f.team, fighter: f.id })
  } else {
    f.stun = 26
  }
}

// ---------- balle ----------
function updateBall(s: GameState) {
  const b = s.ball
  if (b.noPickupT > 0) b.noPickupT--
  if (b.owner !== null) {
    syncCarriedBall(s)
    return
  }
  b.x += b.vx * DT
  b.y += b.vy * DT

  // ----- arrêts du gardien sur tir -----
  if (b.shotBy !== null) {
    const keeper = gkOf(s, b.shotBy === 0 ? 1 : 0)
    const toward = keeper.team === 1 ? b.vy < 0 : b.vy > 0
    if (toward && Math.abs(b.y - keeper.y) < Math.max(3.2, Math.abs(b.vy) * DT + 1.5)) {
      const frozen = keeper.status.freeze > 0 || keeper.status.para > 0
      const reach = (6.5 + 0.5 * keeper.sp.def) * (frozen ? 0.4 : 1) * (keeper.status.slow > 0 ? 0.8 : 1)
      if (Math.abs(b.x - keeper.x) < reach) {
        const parry = clamp((b.shotSpeed - 70) / 70, 0, 0.8)
        pushEvent(s, { kind: 'save', team: keeper.team, fighter: keeper.id })
        if (s.rng.next() < parry) {
          b.vy *= -0.35
          b.vx = s.rng.range(-26, 26)
          b.shotBy = null
          b.noPickupId = keeper.id
          b.noPickupT = 14
        } else {
          b.owner = keeper.id
          b.vx = b.vy = 0
          b.shotBy = null
          b.lastTeam = keeper.team
        }
        return
      }
    }
  }

  // ----- but -----
  if (b.x > GOAL_L && b.x < GOAL_R) {
    if (b.y <= 0) { scoreGoal(s, 0); return }
    if (b.y >= H) { scoreGoal(s, 1); return }
  }

  // ----- murs (arcade : la balle rebondit) -----
  let bounced = false
  if (b.x < 1) { b.x = 1; b.vx = Math.abs(b.vx) * 0.75; bounced = true }
  if (b.x > W - 1) { b.x = W - 1; b.vx = -Math.abs(b.vx) * 0.75; bounced = true }
  if (b.y < 1) { b.y = 1; b.vy = Math.abs(b.vy) * 0.75; bounced = true }
  if (b.y > H - 1) { b.y = H - 1; b.vy = -Math.abs(b.vy) * 0.75; bounced = true }
  if (bounced) b.shotBy = null

  const sp = len(b.vx, b.vy)
  if (sp < 55 && b.shotBy !== null) b.shotBy = null
  b.vx *= 0.987
  b.vy *= 0.987
  if (sp < 1.5) { b.vx = b.vy = 0; b.passTarget = null }

  // ----- ramassage -----
  let best: Fighter | null = null
  let bd = 1e9
  for (const f of s.fighters) {
    if (f.stun > 0 || f.status.freeze > 0) continue
    if (b.noPickupT > 0 && b.noPickupId === f.id) continue
    if (b.shotBy !== null) continue // seuls les gardiens arrêtent un tir
    const d = len(f.x - b.x, f.y - b.y)
    const radius = f.role === 'GK' ? 6.5 : 5.2
    if (d > radius) continue
    if (sp > 85 && b.passTarget !== f.id) continue
    if (d < bd) { bd = d; best = f }
  }
  if (best) {
    b.owner = best.id
    b.lastTeam = best.team
    b.passTarget = null
    b.vx = b.vy = 0
    best.holdT = 0
    s.pickupTick = s.tick
    s.pickupId = best.id
    if (best.id === s.controlled && s.tick - s.lastPassPress <= 12) grantPerfect(s, best)
  }
}

function scoreGoal(s: GameState, team: TeamId) {
  const b = s.ball
  registerGoal(s, team, team === 0 ? 4 : 9)
  b.vx = b.vy = 0
  s.phase = 'goal'
  s.phaseT = 100
  s.lastDuel = null
}

// ---------- IA ----------
function formationPos(s: GameState, f: Fighter): [number, number] {
  const idx = f.id % 5
  const [bx, by] = BASE[idx]
  const prog = f.team === 0 ? 1 - s.ball.y / H : s.ball.y / H
  const shift = (prog - 0.5) * ROLE_SHIFT[f.role]
  const y0 = by - shift
  const lateral = (s.ball.x - 50) * 0.25
  const x = clamp(bx + lateral, 10, 90)
  return [x, f.team === 0 ? y0 : H - y0]
}

function pickChasers(s: GameState): Set<number> {
  const out = new Set<number>()
  for (const t of [0, 1] as TeamId[]) {
    const cands = s.fighters.filter((f) => f.team === t && f.role !== 'GK')
    cands.sort((a, b) => len(a.x - s.ball.x, a.y - s.ball.y) - len(b.x - s.ball.x, b.y - s.ball.y))
    out.add(cands[0].id)
    if (s.ball.owner !== null && s.fighters[s.ball.owner].team !== t) out.add(cands[1].id)
  }
  return out
}

function steer(s: GameState, f: Fighter, tx: number, ty: number, mul = 1) {
  const dx = tx - f.x
  const dy = ty - f.y
  const d = len(dx, dy)
  const sp = speedOf(s, f) * mul
  const k = d < 6 ? d / 6 : 1
  const wx = d > 0.3 ? (dx / d) * sp * k : 0
  const wy = d > 0.3 ? (dy / d) * sp * k : 0
  f.vx += (wx - f.vx) * 0.25
  f.vy += (wy - f.vy) * 0.25
}

function aiThink(s: GameState, f: Fighter, chasers: Set<number>) {
  const b = s.ball
  const diff = s.difficulty
  if (f.role === 'GK') return aiKeeper(s, f)

  // --- porteur ---
  if (b.owner === f.id) return aiCarrier(s, f)

  const owner = b.owner !== null ? s.fighters[b.owner] : null
  // --- adversaire en possession : pressing ---
  if (owner && owner.team !== f.team) {
    if (chasers.has(f.id) && !(f.team === 0 && isHuman(s, f))) {
      steer(s, f, owner.x + owner.vx * 0.2, owner.y + owner.vy * 0.2, 0.97)
      const d = len(owner.x - f.x, owner.y - f.y)
      const wait = f.team === 0 ? 0.04 : 0.12 + 0.04 * diff
      if (d < 9 && f.tackleCd === 0 && s.rng.next() < wait) {
        // les IA adverses utilisent parfois un tacle hissatsu
        const mv = f.moves[1]
        const t = s.teams[f.team]
        if (f.team === 1 && mv.family === 'TACLE' && t.pp >= mv.cost + 20 && s.rng.next() < 0.1 * diff) {
          t.pp -= mv.cost
          t.hissatsu++
          pushEvent(s, { kind: 'hissatsu', team: 1, fighter: f.id, label: mv.name })
          startTackle(s, f, owner.x - f.x, owner.y - f.y, true)
        } else {
          startTackle(s, f, owner.x - f.x, owner.y - f.y, false)
        }
      }
      return
    }
    const [hx, hy] = formationPos(s, f)
    steer(s, f, hx, hy, 0.9)
    return
  }
  // --- ballon libre ---
  if (!owner) {
    if (chasers.has(f.id)) {
      steer(s, f, b.x + b.vx * 0.25, b.y + b.vy * 0.25)
      return
    }
    const [hx, hy] = formationPos(s, f)
    steer(s, f, hx, hy, 0.9)
    return
  }
  // --- mon équipe attaque : appel de balle ---
  const [hx, hy] = formationPos(s, f)
  const forward = f.team === 0 ? -1 : 1
  steer(s, f, hx + (f.id % 2 === 0 ? 6 : -6), hy + forward * 12, 0.85)
}

function aiKeeper(s: GameState, f: Fighter) {
  const b = s.ball
  const gy = ownGoalY(f.team)
  const base = f.team === 0 ? gy - 8 : gy + 8
  if (b.owner === f.id) {
    f.holdT++
    if (f.holdT > 40) {
      const mates = s.fighters.filter((m) => m.team === f.team && m.role !== 'GK')
      const tgt = mates.sort((a, c) => len(a.x - f.x, a.y - f.y) - len(c.x - f.x, c.y - f.y))[1] ?? mates[0]
      passTo(s, f, tgt)
    }
    steer(s, f, 50, base)
    return
  }
  let tx = clamp(b.x, GOAL_L + 2, GOAL_R - 2)
  let ty = base
  const incoming = b.shotBy !== null && b.shotBy !== f.team && (f.team === 0 ? b.vy > 0 : b.vy < 0)
  if (incoming && Math.abs(b.vy) > 1) {
    const t = (f.y - b.y) / b.vy
    const px = b.x + b.vx * t + b.gkErr
    tx = clamp(px, GOAL_L + 1, GOAL_R - 1)
  } else if (b.owner === null && len(b.x - f.x, b.y - f.y) < 22 && b.shotBy === null) {
    tx = b.x
    ty = b.y
  } else {
    const near = clamp(1 - Math.abs(b.y - gy) / 70, 0, 1)
    ty = base + (f.team === 0 ? -1 : 1) * 8 * near
  }
  steer(s, f, tx, ty, incoming ? 1.35 : 1)
}

function aiCarrier(s: GameState, f: Fighter) {
  const fwd = f.team === 0 ? -1 : 1
  const gy = goalY(f.team)
  const dg = distToGoal(f)
  const enemyGk = gkOf(s, f.team === 0 ? 1 : 0)
  const t = s.teams[f.team]

  // charge de tir en cours
  if (f.aiShootT > 0) {
    f.aiShootT--
    f.charge = Math.min(1, f.charge + DT / 0.85)
    f.vx *= 0.8
    f.vy *= 0.8
    if (f.aiShootT === 0) {
      shoot(s, f, Math.max(0.3, f.aiShootCharge), f.aiAimX)
      f.charge = 0
    }
    return
  }

  // relance des gardiens, passes sous pression
  const foes = s.fighters.filter((o) => o.team !== f.team && o.role !== 'GK')
  let nearest: Fighter | null = null
  let nd = 1e9
  for (const o of foes) {
    const d = len(o.x - f.x, o.y - f.y)
    if (d < nd) { nd = d; nearest = o }
  }

  // hissatsu de tir (IA adverse uniquement, l'équipe 0 est pilotée par l'humain)
  if (f.team === 1 && dg < 62 && t.pp >= f.moves[0].cost + 8 && s.rng.next() < 0.0025 * (1 + s.difficulty)) {
    tryHissatsuShot(s, f)
    return
  }
  if (f.team === 1 && f.moves[1].family === 'DRIBBLE' && nd < 14 && t.pp >= f.moves[1].cost + 30 && s.rng.next() < 0.03) {
    tryDribble(s, f)
  }

  // tir normal
  if (dg < 50 && s.rng.next() < 0.05 + 0.012 * s.difficulty) {
    f.aiShootT = 14 + s.rng.int(24)
    f.aiShootCharge = 0.45 + s.rng.next() * 0.5
    f.aiAimX = enemyGk.x < 50 ? 62 : 38
    f.aiAimX += s.rng.range(-3, 3)
    f.charge = 0.05
    return
  }

  // passe si pressé
  if (nearest && nd < 11 && s.rng.next() < 0.08) {
    const mates = s.fighters.filter((m) => m.team === f.team && m.id !== f.id && m.role !== 'GK')
    const ahead = mates.filter((m) => (m.y - f.y) * fwd > -6).sort((a, c) => Math.abs(a.x - f.x) - Math.abs(c.x - f.x))
    const tgt = ahead[0] ?? mates[0]
    if (tgt) { passTo(s, f, tgt); return }
  }

  // conduite vers le but, en contournant le défenseur le plus proche
  let tx = 50 + clamp(f.x - 50, -12, 12) * 0.5
  let ty = gy
  if (nearest && nd < 20) {
    const side = f.x < nearest.x ? -1 : 1
    tx = clamp(f.x + side * 18, 12, 88)
    ty = f.y + fwd * 26
  }
  steer(s, f, tx, ty, 0.95)
}
