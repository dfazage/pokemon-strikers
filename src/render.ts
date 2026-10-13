import { H, W, GOAL_L, GOAL_R, type Fighter, type GameState } from './engine/sim'
import { TYPE_COLOR } from './engine/types'

const base = import.meta.env.BASE_URL
const cache = new Map<string, HTMLImageElement>()

export function sprite(id: number, side: 'front' | 'back'): HTMLImageElement {
  const k = `${side}/${id}`
  let img = cache.get(k)
  if (!img) {
    img = new Image()
    img.src = `${base}sprites/${side}/${id}.png`
    cache.set(k, img)
  }
  return img
}

export function preload(ids: number[]) {
  return Promise.all(
    ids.flatMap((id) => (['front', 'back'] as const).map((side) => {
      const img = sprite(id, side)
      return img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r() })
    })),
  )
}

const MARGIN = 7 // unités de marge pour afficher les buts
export const VIEW_H = H + 2 * MARGIN

export function draw(ctx: CanvasRenderingContext2D, cw: number, s: GameState, aimX: number, time: number) {
  const k = cw / W
  ctx.clearRect(0, 0, cw, VIEW_H * k)
  const Y = (y: number) => (y + MARGIN) * k
  const X = (x: number) => x * k

  // herbe
  const stripes = 10
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#95DEA9' : '#86D69C'
    ctx.fillRect(0, Y((H / stripes) * i), cw, (H / stripes) * k + 1)
  }
  ctx.fillStyle = '#86D69C'
  ctx.fillRect(0, 0, cw, MARGIN * k)
  ctx.fillRect(0, Y(H), cw, MARGIN * k)

  // lignes
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = Math.max(2, k * 0.5)
  ctx.strokeRect(X(1), Y(0), X(W - 2), (H) * k)
  ctx.beginPath()
  ctx.moveTo(X(1), Y(H / 2)); ctx.lineTo(X(W - 1), Y(H / 2))
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(X(50), Y(H / 2), 14 * k, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeRect(X(24), Y(0), X(52), 24 * k)
  ctx.strokeRect(X(24), Y(H - 24), X(52), 24 * k)

  // buts + filets
  for (const top of [true, false]) {
    const y0 = top ? Y(-6) : Y(H)
    ctx.fillStyle = 'rgba(30,70,60,0.22)'
    ctx.fillRect(X(GOAL_L), y0, X(GOAL_R - GOAL_L), 6 * k)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = Math.max(3, k * 0.7)
    ctx.strokeRect(X(GOAL_L), y0, X(GOAL_R - GOAL_L), 6 * k)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    for (let i = 1; i < 14; i++) {
      ctx.beginPath(); ctx.moveTo(X(GOAL_L + i * 2), y0); ctx.lineTo(X(GOAL_L + i * 2), y0 + 6 * k); ctx.stroke()
    }
  }

  const ball = s.ball
  const SZ = 15 * k
  const carrier = ball.owner !== null ? s.fighters[ball.owner] : null

  // ligne de visée
  if (carrier && carrier.team === 0 && carrier.charge > 0) {
    ctx.save()
    ctx.setLineDash([k * 1.6, k * 1.6])
    ctx.strokeStyle = `rgba(214,58,45,${0.45 + carrier.charge * 0.5})`
    ctx.lineWidth = Math.max(2, k * 0.6)
    ctx.beginPath()
    ctx.moveTo(X(carrier.x), Y(carrier.y))
    ctx.lineTo(X(aimX), Y(0))
    ctx.stroke()
    ctx.restore()
  }

  // ombres du ballon et des joueurs
  const order = s.fighters.slice().sort((a, b) => a.y - b.y)
  for (const f of order) shadow(ctx, X(f.x), Y(f.y), SZ)
  shadow(ctx, X(ball.x), Y(ball.y), k * 3.6)

  // joueurs triés par y
  const ballAbove = (f: Fighter) => ball.y < f.y
  let ballDrawn = false
  const drawBall = () => { ballDrawn = true; drawBallAt(ctx, X(ball.x), Y(ball.y), k, time) }
  for (const f of order) {
    if (!ballDrawn && ballAbove(f) === false && ball.y <= f.y) drawBall()
    drawFighter(ctx, f, s, SZ, k, X(f.x), Y(f.y), time)
  }
  if (!ballDrawn) drawBall()
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = 'rgba(20,70,50,0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.36, size * 0.11, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawBallAt(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, time: number) {
  const r = 1.9 * k
  const lift = 0
  ctx.save()
  ctx.translate(x, y - r - lift)
  ctx.rotate(time * 6)
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
  ctx.save(); ctx.clip()
  ctx.fillStyle = '#EF4444'; ctx.fillRect(-r, -r, r * 2, r * 0.9)
  ctx.fillStyle = '#1B2440'; ctx.fillRect(-r, -r * 0.1, r * 2, r * 0.2)
  ctx.restore()
  ctx.lineWidth = Math.max(1.5, k * 0.35); ctx.strokeStyle = '#1B2440'
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, s: GameState, size: number, k: number, x: number, y: number, time: number) {
  const img = sprite(f.sp.id, f.team === 0 ? 'back' : 'front')
  const controlled = f.team === 0 && f.id === s.controlled

  // anneau du joueur contrôlé
  if (controlled) {
    ctx.strokeStyle = '#2F6BFF'
    ctx.lineWidth = Math.max(2, k * 0.55)
    ctx.beginPath(); ctx.ellipse(x, y, size * 0.42, size * 0.14, 0, 0, Math.PI * 2); ctx.stroke()
  }
  // aura de charge
  if (f.charge > 0) {
    ctx.fillStyle = `rgba(255,150,40,${0.18 + f.charge * 0.35})`
    ctx.beginPath(); ctx.arc(x, y - size * 0.45, size * (0.5 + f.charge * 0.35), 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#FFB400'; ctx.lineWidth = Math.max(3, k * 0.7)
    ctx.beginPath(); ctx.arc(x, y - size * 0.45, size * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.charge); ctx.stroke()
  }
  if (f.boost > 0 || f.shotBoost) {
    ctx.fillStyle = 'rgba(255,214,64,0.25)'
    ctx.beginPath(); ctx.arc(x, y - size * 0.4, size * 0.55, 0, Math.PI * 2); ctx.fill()
  }
  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (f.stun > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45
  if (f.invuln > 0) { ctx.shadowColor = '#FFD740'; ctx.shadowBlur = size * 0.3 }
  const bob = Math.abs(f.vx) + Math.abs(f.vy) > 6 ? Math.sin(time * 18 + f.id) * k * 0.5 : 0
  if (img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size * 0.9 + bob, size, size)
  ctx.restore()

  // capitaine + statuts
  const top = y - size * 0.95
  if (f.captain) {
    ctx.fillStyle = '#FFB400'
    ctx.font = `${Math.round(k * 3)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('★', x, top)
  }
  const st: string[] = []
  if (f.status.burn > 0) st.push(TYPE_COLOR.feu)
  if (f.status.slow > 0) st.push(TYPE_COLOR.eau)
  if (f.status.para > 0) st.push(TYPE_COLOR.electrik)
  if (f.status.freeze > 0) st.push(TYPE_COLOR.glace)
  st.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath(); ctx.arc(x + (i - (st.length - 1) / 2) * k * 2.2, top - k * 3.2, k * 0.9, 0, Math.PI * 2); ctx.fill()
  })
  // petit marqueur d'équipe adverse
  if (f.team === 1) {
    ctx.fillStyle = '#7A47E0'
    ctx.beginPath(); ctx.arc(x, y + k * 0.8, k * 0.7, 0, Math.PI * 2); ctx.fill()
  }
}
