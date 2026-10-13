import { CX, GOAL_L, GOAL_R, H, W, type Fighter, type GameState } from './engine/sim'
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

// ---- géométrie de la caméra ----
export const MARGIN = 6 // profondeur des buts affichée hors terrain
export const CANVAS_ASPECT = 560 / 366 // hauteur / largeur du canevas (comme les maquettes)
export const VIEW_H = W * CANVAS_ASPECT // hauteur visible en unités monde (~107)
const SPRITE = 17 // taille d'un sprite en unités monde

const BLUE = '#2F6BFF'
const VIOLET = '#7A47E0'

/** Position y de la caméra (haut de l'écran) pour suivre le ballon, bornée au terrain. */
export function cameraTarget(s: GameState): number {
  const want = s.ball.y - VIEW_H / 2
  return Math.max(-MARGIN, Math.min(H + MARGIN - VIEW_H, want))
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function draw(ctx: CanvasRenderingContext2D, cw: number, s: GameState, aimX: number, time: number, camY: number) {
  const k = cw / W
  const ch = VIEW_H * k
  ctx.clearRect(0, 0, cw, ch)
  const X = (x: number) => x * k
  const Y = (y: number) => (y - camY) * k

  drawField(ctx, k, cw, ch, X, Y)

  const ball = s.ball
  const carrier = ball.owner !== null ? s.fighters[ball.owner] : null
  const size = SPRITE * k

  // ligne de visée du porteur qui charge
  if (carrier && carrier.team === 0 && carrier.charge > 0) {
    ctx.save()
    ctx.setLineDash([k * 1.2, k * 1.2])
    ctx.strokeStyle = `rgba(255,168,0,${0.6 + carrier.charge * 0.4})`
    ctx.lineWidth = Math.max(3, k * 0.7)
    ctx.beginPath()
    ctx.moveTo(X(ball.x), Y(ball.y))
    ctx.lineTo(X(aimX), Y(0))
    ctx.stroke()
    ctx.restore()
    ctx.strokeStyle = '#FFA800'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = Math.max(3, k * 0.6)
    ctx.beginPath(); ctx.arc(X(aimX), Y(0), k * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }

  // disques d'équipe (toujours sous les sprites)
  for (const f of s.fighters) drawDisc(ctx, f, s, size, k, X(f.x), Y(f.y), time)

  // sprites triés par y
  const order = s.fighters.slice().sort((a, b) => a.y - b.y)
  for (const f of order) drawSprite(ctx, f, size, k, X(f.x), Y(f.y), time)

  // marqueurs de porteur / joueur contrôlé, étiquette
  for (const f of order) drawMarkers(ctx, f, s, size, k, X(f.x), Y(f.y), carrier)

  // ballon : toujours au-dessus des sprites, avec halo
  drawBall(ctx, X(ball.x), Y(ball.y), k, time, carrier !== null)

  // joueurs de mon équipe hors caméra
  drawOffscreen(ctx, s, k, cw, ch, Y)
  drawMinimap(ctx, s, cw, camY)
}

function drawField(ctx: CanvasRenderingContext2D, k: number, cw: number, ch: number, X: (x: number) => number, Y: (y: number) => number) {
  const stripe = 12
  for (let y = -MARGIN - 12; y < H + MARGIN + 12; y += stripe) {
    const i = Math.floor((y + 1000) / stripe)
    ctx.fillStyle = i % 2 ? '#95DEA9' : '#86D69C'
    ctx.fillRect(0, Y(y), cw, stripe * k + 1)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = Math.max(3, k * 0.6)
  // bordures
  ctx.strokeRect(X(1), Y(0), X(W - 2), H * k)
  // ligne médiane + rond central
  ctx.beginPath(); ctx.moveTo(X(1), Y(H / 2)); ctx.lineTo(X(W - 1), Y(H / 2)); ctx.stroke()
  ctx.beginPath(); ctx.arc(X(CX), Y(H / 2), 10 * k, 0, Math.PI * 2); ctx.stroke()
  // surfaces
  for (const top of [true, false]) {
    const y0 = top ? 0 : H - 22
    ctx.strokeRect(X(9), Y(y0), X(W - 18), 22 * k)
    const g0 = top ? 0 : H - 8
    ctx.strokeRect(X(19), Y(g0), X(W - 38), 8 * k)
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath(); ctx.arc(X(CX), Y(top ? 15 : H - 15), k * 0.5, 0, Math.PI * 2); ctx.fill()
  }
  // buts et filets
  for (const top of [true, false]) {
    const y0 = top ? -MARGIN : H
    const x0 = X(GOAL_L)
    const w = X(GOAL_R - GOAL_L)
    ctx.fillStyle = 'rgba(30,70,60,0.22)'
    ctx.fillRect(x0, Y(y0), w, MARGIN * k)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1
    for (let i = 1; i < 12; i++) {
      ctx.beginPath(); ctx.moveTo(x0 + (w / 12) * i, Y(y0)); ctx.lineTo(x0 + (w / 12) * i, Y(y0) + MARGIN * k); ctx.stroke()
    }
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = Math.max(4, k * 0.8)
    ctx.strokeRect(x0, Y(y0), w, MARGIN * k)
  }
  void ch
}

function drawDisc(ctx: CanvasRenderingContext2D, f: Fighter, s: GameState, size: number, k: number, x: number, y: number, time: number) {
  const controlled = f.team === 0 && f.id === s.controlled
  const col = f.team === 0 ? BLUE : VIOLET
  const rx = size * 0.46
  const ry = size * 0.15
  const cy = y + ry * 0.2
  ctx.save()
  if (controlled) {
    ctx.fillStyle = `rgba(255,180,0,${0.25 + 0.15 * Math.sin(time * 6)})`
    ctx.beginPath(); ctx.ellipse(x, cy, rx + k * 1.6, ry + k * 0.9, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = f.team === 0 ? 'rgba(47,107,255,0.85)' : 'rgba(122,71,224,0.85)'
  ctx.shadowColor = col
  ctx.shadowBlur = k * 1.4
  ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  ctx.lineWidth = Math.max(3, k * (controlled ? 0.85 : 0.6))
  ctx.strokeStyle = controlled ? '#FFB400' : '#FFFFFF'
  ctx.stroke()
  ctx.restore()
}

function drawSprite(ctx: CanvasRenderingContext2D, f: Fighter, size: number, k: number, x: number, y: number, time: number) {
  const img = sprite(f.sp.id, f.team === 0 ? 'back' : 'front')
  if (f.charge > 0) {
    ctx.fillStyle = `rgba(255,140,30,${0.2 + f.charge * 0.3})`
    ctx.beginPath(); ctx.arc(x, y - size * 0.42, size * (0.55 + f.charge * 0.35), 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#FF8A2B'
    ctx.lineWidth = Math.max(4, k * 0.9)
    ctx.beginPath(); ctx.arc(x, y - size * 0.42, size * 0.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.charge); ctx.stroke()
  }
  if (f.boost > 0 || f.shotBoost) {
    ctx.fillStyle = 'rgba(255,214,64,0.28)'
    ctx.beginPath(); ctx.arc(x, y - size * 0.4, size * 0.58, 0, Math.PI * 2); ctx.fill()
  }
  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (f.stun > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45
  if (f.invuln > 0) { ctx.shadowColor = '#FFD740'; ctx.shadowBlur = size * 0.3 }
  const bob = Math.abs(f.vx) + Math.abs(f.vy) > 5 ? Math.sin(time * 16 + f.id) * k * 0.45 : 0
  if (img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size * 0.92 + bob, size, size)
  ctx.restore()
}

function tri(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(x - w, y - w * 1.25); ctx.lineTo(x + w, y - w * 1.25); ctx.lineTo(x, y); ctx.closePath(); ctx.fill()
  ctx.restore()
}

function drawMarkers(ctx: CanvasRenderingContext2D, f: Fighter, s: GameState, size: number, k: number, x: number, y: number, carrier: Fighter | null) {
  const head = y - size * 0.98
  const controlled = f.team === 0 && f.id === s.controlled
  if (controlled) {
    tri(ctx, x, head, k * 1.8, '#FFB400')
    pill(ctx, f.sp.name.toUpperCase(), x, y + size * 0.3, k, '#FFB400', '#1B2440')
  } else if (carrier && carrier.id === f.id && f.team === 1) {
    tri(ctx, x, head, k * 1.8, '#D63A2D')
    pill(ctx, 'PORTEUR', x, y + size * 0.3, k, '#D63A2D', '#FFFFFF')
  }
  if (f.captain) {
    ctx.fillStyle = '#FFB400'
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 3
    ctx.font = `700 ${Math.round(k * 3.2)}px sans-serif`
    ctx.textAlign = 'center'
    const cy = controlled || (carrier && carrier.id === f.id && f.team === 1) ? head - k * 4 : head - k * 0.2
    ctx.strokeText('★', x + size * 0.38, cy + k * 2)
    ctx.fillText('★', x + size * 0.38, cy + k * 2)
  }
  const st: string[] = []
  if (f.status.burn > 0) st.push(TYPE_COLOR.feu)
  if (f.status.slow > 0) st.push(TYPE_COLOR.eau)
  if (f.status.para > 0) st.push(TYPE_COLOR.electrik)
  if (f.status.freeze > 0) st.push(TYPE_COLOR.glace)
  st.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(x + (i - (st.length - 1) / 2) * k * 2.4, head - k * 2.6, k * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  })
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, k: number, bg: string, fg: string) {
  ctx.font = `700 ${Math.round(k * 2.1)}px Outfit, sans-serif`
  const w = ctx.measureText(text).width + k * 3.2
  const h = k * 3.3
  ctx.fillStyle = bg
  ctx.shadowColor = 'rgba(40,60,120,0.3)'
  ctx.shadowBlur = 6
  rr(ctx, cx - w / 2, cy, w, h, h / 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy + h / 2 + 1)
  ctx.textBaseline = 'alphabetic'
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, time: number, carried: boolean) {
  const r = 2.4 * k
  // halo
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.5, 'rgba(255,214,100,0.5)')
  g.addColorStop(1, 'rgba(255,214,100,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill()
  // ombre
  ctx.fillStyle = 'rgba(20,70,50,0.3)'
  ctx.beginPath(); ctx.ellipse(x, y + r * 1.15, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(time * (carried ? 3 : 7))
  ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill()
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill()
  ctx.save(); ctx.clip()
  ctx.fillStyle = '#EF4444'; ctx.fillRect(-r, -r, r * 2, r * 0.9)
  ctx.fillStyle = '#1B2440'; ctx.fillRect(-r, -r * 0.1, r * 2, r * 0.2)
  ctx.restore()
  ctx.lineWidth = Math.max(2, k * 0.5); ctx.strokeStyle = '#1B2440'
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke()
  ctx.restore()
}

/** Puce au bord de l'écran pour chaque coéquipier hors caméra. */
function drawOffscreen(ctx: CanvasRenderingContext2D, s: GameState, k: number, cw: number, ch: number, Y: (y: number) => number) {
  const size = SPRITE * k
  let top = 0
  let bottom = 0
  for (const f of s.fighters) {
    if (f.team !== 0) continue
    const py = Y(f.y)
    const above = py - size < 0
    const below = py > ch
    if (!(above && py < 0) && !below) continue
    if (above && py >= 0) continue
    const up = py < 0
    const label = `${f.sp.name.toUpperCase()}${f.role === 'GK' ? ' · GARDIEN' : ''}`
    ctx.font = `700 ${Math.round(k * 2.2)}px Outfit, sans-serif`
    const w = ctx.measureText(label).width + k * 8.5
    const h = k * 5.4
    const cx = Math.max(w / 2 + 8, Math.min(cw - w / 2 - 8, f.x * k))
    const y = up ? k * 9 + top * (h + 6) : ch - h - k * 2 - bottom * (h + 6)
    if (up) top++; else bottom++
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.strokeStyle = BLUE
    ctx.lineWidth = 3
    rr(ctx, cx - w / 2, y, w, h, h / 2)
    ctx.fill(); ctx.stroke()
    // flèche
    ctx.strokeStyle = BLUE
    ctx.lineWidth = Math.max(3, k * 0.6)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const ax = cx - w / 2 + k * 3.2
    const ay = y + h / 2
    ctx.beginPath()
    if (up) { ctx.moveTo(ax, ay + k * 1.4); ctx.lineTo(ax, ay - k * 1.4); ctx.moveTo(ax - k, ay - k * 0.4); ctx.lineTo(ax, ay - k * 1.5); ctx.lineTo(ax + k, ay - k * 0.4) }
    else { ctx.moveTo(ax, ay - k * 1.4); ctx.lineTo(ax, ay + k * 1.4); ctx.moveTo(ax - k, ay + k * 0.4); ctx.lineTo(ax, ay + k * 1.5); ctx.lineTo(ax + k, ay + k * 0.4) }
    ctx.stroke()
    ctx.fillStyle = '#1B2440'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, cx - w / 2 + k * 5.6, y + h / 2 + 1)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'center'
  }
}

/** Mini-terrain : toutes les positions + le cadre de la caméra. */
function drawMinimap(ctx: CanvasRenderingContext2D, s: GameState, cw: number, camY: number) {
  const u = cw / 366
  const w = 40 * u
  const h = 130 * u
  const x0 = cw - w - 10 * u
  const y0 = 10 * u
  const pad = 4 * u
  const fw = w - 2 * pad
  const fh = h - 2 * pad
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  rr(ctx, x0, y0, w, h, 12 * u); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.stroke()
  const fx = x0 + pad
  const fy = y0 + pad
  rr(ctx, fx, fy, fw, fh, 4 * u); ctx.clip()
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#95DEA9' : '#86D69C'; ctx.fillRect(fx, fy + (fh / 6) * i, fw, fh / 6 + 1) }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(fx, fy + fh / 2, fw, 1)
  const mx = (x: number) => fx + (x / W) * fw
  const my = (y: number) => fy + (y / H) * fh
  // cadre caméra
  const top = Math.max(0, camY)
  const bot = Math.min(H, camY + VIEW_H)
  ctx.strokeStyle = '#1B2440'; ctx.lineWidth = 1.5 * u
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(fx, my(top), fw, my(bot) - my(top))
  ctx.strokeRect(fx + 0.75 * u, my(top), fw - 1.5 * u, my(bot) - my(top))
  for (const f of s.fighters) {
    ctx.fillStyle = f.team === 0 ? BLUE : VIOLET
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5 * u
    ctx.beginPath(); ctx.arc(mx(f.x), my(f.y), 3.4 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#1B2440'; ctx.lineWidth = 1.5 * u
  ctx.beginPath(); ctx.arc(mx(s.ball.x), my(s.ball.y), 3 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}
