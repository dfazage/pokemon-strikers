import { useEffect, useMemo, useRef, useState } from 'react'
import { DT, HISS_RANGE, PERFECT_ZONE, PP_MAX, aimXFor, createMatch, step, CX, type DuelResult, type GameState, type Phase } from '../engine/sim'
import type { DailyChallenge } from '../engine/daily'
import { TYPE_COLOR, TYPE_LABEL } from '../engine/types'
import { Controls } from './controls'
import { CANVAS_ASPECT, cameraTarget, draw, preload, sprite } from '../render'

interface Hud {
  phase: Phase
  score: [number, number]
  time: number
  overtime: boolean
  pp: number
  banner: string | null
  duel: { mine: boolean; move: string; type: string; power: number; marker: number; shooter: number } | null
  result: DuelResult | null
  carrier: boolean
  inRange: boolean
  moves: [string, string]
  families: [string, string]
  costs: [number, number]
  sec: [boolean, boolean]
  charge: number
  tackleNear: boolean
}

function snapshot(s: GameState): Hud {
  const f = s.fighters[s.controlled]
  const d = s.duel
  const owns = s.ball.owner === f.id
  const dist = Math.hypot(CX - f.x, 0 - f.y)
  const m1 = f.moves[1]
  const secOk = m1.family === 'DRIBBLE' ? owns : m1.family === 'TACLE' ? !owns : false
  return {
    phase: s.phase,
    score: [s.teams[0].score, s.teams[1].score],
    time: Math.max(0, s.time),
    overtime: s.overtime,
    pp: s.teams[0].pp,
    banner: s.banner?.text ?? null,
    duel: d && s.phase === 'duel'
      ? { mine: s.fighters[d.shooterId].team === 0, move: d.move.name, type: d.move.type, power: d.move.power, marker: d.marker, shooter: s.fighters[d.shooterId].sp.id }
      : null,
    result: s.phase === 'duelResult' ? s.lastDuel : null,
    carrier: owns,
    inRange: owns && dist <= HISS_RANGE,
    moves: [f.moves[0].name, m1.name],
    families: [f.moves[0].family, m1.family],
    costs: [f.moves[0].cost, m1.cost],
    sec: [true, secOk],
    charge: f.charge,
    tackleNear: !owns && s.ball.owner !== null && s.fighters[s.ball.owner].team === 1 && Math.hypot(s.fighters[s.ball.owner].x - f.x, s.fighters[s.ball.owner].y - f.y) < 12,
  }
}

interface Props {
  challenge: DailyChallenge
  hearts: number
  onEnd: (s: GameState) => void
  onQuit: () => void
}

export function MatchScreen({ challenge, hearts, onEnd, onQuit }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const controls = useMemo(() => new Controls(), [])
  const [hud, setHud] = useState<Hud | null>(null)
  const [ready, setReady] = useState(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    let cancelled = false
    const ids = [...challenge.ours, ...challenge.theirs].map((f) => f.speciesId)
    preload(ids).then(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [challenge])

  useEffect(() => {
    if (!ready) return
    const s = createMatch(challenge.options)
    const detach = controls.attach()
    const cv = canvas.current!
    const ctx = cv.getContext('2d')!
    const resize = () => {
      const w = wrap.current!.clientWidth
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(w * CANVAS_ASPECT * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap.current!)

    let raf = 0
    let last = performance.now()
    let acc = 0
    let frame = 0
    let aimX = CX
    let camY = cameraTarget(s)
    let ended = false
    const loop = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000)
      last = now
      let guard = 0
      while (acc >= DT && guard++ < 6) {
        const inp = controls.read()
        aimX = aimXFor(inp.mx)
        step(s, inp)
        acc -= DT
      }
      camY += (cameraTarget(s) - camY) * 0.12
      draw(ctx, cv.width, s, aimX, now / 1000, camY)
      frame++
      if (frame % 3 === 0 || s.phase === 'duel') setHud(snapshot(s))
      if (s.phase === 'end' && !ended) {
        ended = true
        setHud(snapshot(s))
        setTimeout(() => onEndRef.current(s), 1400)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      detach()
    }
  }, [ready, challenge, controls])

  const t = challenge.trainer
  const mm = hud ? Math.floor(hud.time / 60) : 1
  const ss = hud ? String(Math.floor(hud.time % 60)).padStart(2, '0') : '30'

  return (
    <div className="match">
      <div className="match-top glass">
        <button className="icon-btn" onClick={onQuit} aria-label="Quitter">✕</button>
        <div className="score">
          <span className="team-tag you"><i className="dot blue" />TOI</span>
          <span className="pixel c-blue">{hud?.score[0] ?? 0}</span>
          <span className="clock">{hud?.overtime ? 'MORT SUBITE ' : ''}{mm}:{ss}</span>
          <span className="pixel c-violet">{hud?.score[1] ?? 0}</span>
          <span className="team-tag foe">{t.name.toUpperCase()}<i className="dot violet" /></span>
        </div>
        <div className="hearts">{'❤️'.repeat(hearts)}{'🖤'.repeat(3 - hearts)}</div>
      </div>

      <div className="pitch-wrap" ref={wrap}>
        <canvas ref={canvas} className="pitch" />
        {!ready && <div className="loading">Chargement des sprites…</div>}
        {hud?.banner && <div className="banner glass pixel-b">{hud.banner}</div>}

        {hud?.duel && <DuelOverlay hud={hud} onPress={() => controls.tap('press')} />}
        {hud?.result && <ResultOverlay r={hud.result} />}
        {hud?.phase === 'end' && <div className="banner glass pixel-b">{hud.score[0] > hud.score[1] ? 'VICTOIRE !' : hud.score[0] < hud.score[1] ? 'DÉFAITE' : 'MATCH NUL'}</div>}
        <div className="pp glass">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#E8730C" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
          <div className="pp-bar"><div className="pp-fill" style={{ width: `${((hud?.pp ?? 50) / PP_MAX) * 100}%` }} /></div>
          <span className="pp-num">{Math.floor(hud?.pp ?? 50)}</span>
        </div>
      </div>

      <div className="hud-bottom">
        <TouchPad controls={controls} hud={hud} />
        <p className="keys-hint">Flèches/ZQSD · Espace/J tir (maintenir) · K passe · L tacle · U/I hissatsu</p>
      </div>
    </div>
  )
}

function DuelOverlay({ hud, onPress }: { hud: Hud; onPress: () => void }) {
  const d = hud.duel!
  return (
    <div className="duel glass">
      <div className="duel-head">
        <img src={sprite(d.shooter, d.mine ? 'back' : 'front').src} alt="" className="duel-sprite" />
        <div>
          <div className="eyebrow">{d.mine ? 'TON HISSATSU' : 'HISSATSU ADVERSE'}</div>
          <div className="duel-move">{d.move}</div>
        </div>
        <span className="type-pill" style={{ background: TYPE_COLOR[d.type as keyof typeof TYPE_COLOR] }}>{TYPE_LABEL[d.type as keyof typeof TYPE_LABEL]}</span>
      </div>
      <div className="timing">
        <div className="zone" style={{ left: `${PERFECT_ZONE[0] * 100}%`, width: `${(PERFECT_ZONE[1] - PERFECT_ZONE[0]) * 100}%` }} />
        <div className="marker" style={{ left: `${d.marker * 100}%` }} />
      </div>
      <div className="timing-help">{d.mine ? 'Zone verte = bonus ×1,2' : 'Le gardien se prépare…'}</div>
      {d.mine && <button className="cta" onPointerDown={onPress}>TIRE !</button>}
    </div>
  )
}

function ResultOverlay({ r }: { r: DuelResult }) {
  const total = r.atk + r.shield
  return (
    <div className="duel glass">
      <div className="eyebrow">{r.goal ? 'BUT !' : `ARRÊTÉ PAR ${r.shield_move.toUpperCase()}`}</div>
      <div className="vs-bar">
        <div className="vs-atk" style={{ width: `${(r.atk / total) * 100}%` }}>{r.atk}</div>
        <div className="vs-def" style={{ width: `${(r.shield / total) * 100}%` }}>{r.shield}</div>
      </div>
      <div className="chips">
        {r.eff > 1 && <span className="chip good">SUPER EFFICACE ×{r.eff}</span>}
        {r.eff < 1 && <span className="chip bad">PEU EFFICACE ×{r.eff}</span>}
        {r.perfect && <span className="chip good">TIMING PARFAIT</span>}
      </div>
    </div>
  )
}

function TouchPad({ controls, hud }: { controls: Controls; hud: Hud | null }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)

  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let dx = (e.clientX - cx) / (r.width / 2)
    let dy = (e.clientY - cy) / (r.height / 2)
    const l = Math.hypot(dx, dy)
    if (l > 1) { dx /= l; dy /= l }
    controls.joy = { x: Math.abs(dx) < 0.12 ? 0 : dx, y: Math.abs(dy) < 0.12 ? 0 : dy }
    setKnob({ x: dx, y: dy })
  }
  const release = () => {
    active.current = null
    controls.joy = { x: 0, y: 0 }
    setKnob({ x: 0, y: 0 })
  }
  const pp = hud?.pp ?? 0
  const can1 = !!hud && hud.carrier && hud.inRange && pp >= hud.costs[0]
  const can2 = !!hud && hud.sec[1] && pp >= hud.costs[1]

  return (
    <div className="dock glass">
      <div
        className="joystick"
        ref={base}
        onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
        onPointerMove={(e) => { if (active.current === e.pointerId) move(e) }}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label="Joystick de déplacement"
      >
        <div className="knob" style={{ transform: `translate(${knob.x * 32}px, ${knob.y * 32}px)` }} />
      </div>
      <div className="cluster">
        <div className="hiss-row">
          <button className={`hiss ${can1 ? 'ready' : ''}`} disabled={!can1} onPointerDown={() => controls.tap('special1')}>
            <b>{hud?.moves[0] ?? '—'}</b><small>TIR · {hud?.costs[0]} PP</small>
          </button>
          <button className={`hiss ${can2 ? 'ready' : ''}`} disabled={!can2} onPointerDown={() => controls.tap('special2')}>
            <b>{hud?.moves[1] ?? '—'}</b><small>{hud?.families[1]} · {hud?.costs[1]} PP</small>
          </button>
        </div>
        <div className="round-row">
          <button className={`round tackle ${hud?.tackleNear ? 'near' : ''}`} onPointerDown={() => controls.tap('tackle')}>TACLE</button>
          <button className="round pass" onPointerDown={() => controls.tap('pass')}>PASSE</button>
          <button
            className="round shoot"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); controls.shootHeld = true }}
            onPointerUp={() => { controls.shootHeld = false }}
            onPointerCancel={() => { controls.shootHeld = false }}
            style={{ ['--charge' as string]: `${(hud?.charge ?? 0) * 100}%` }}
          >TIR</button>
        </div>
      </div>
    </div>
  )
}
