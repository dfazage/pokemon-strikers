import { NO_INPUT, type Input } from '../engine/sim'

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyQ: [-1, 0], KeyZ: [0, -1],
}

/** Agrège clavier + joystick/boutons tactiles en un Input par pas de simulation. */
export class Controls {
  private keys = new Set<string>()
  joy = { x: 0, y: 0 }
  shootHeld = false
  private edges = { pass: false, tackle: false, special1: false, special2: false, press: false }
  lastMx = 0

  attach(): () => void {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (MOVE_KEYS[e.code] || ['Space', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'Digit1', 'Digit2', 'Enter'].includes(e.code)) e.preventDefault()
      this.keys.add(e.code)
      if (e.code === 'KeyK') this.edges.pass = true
      if (e.code === 'KeyL') this.edges.tackle = true
      if (e.code === 'KeyU' || e.code === 'Digit1') this.edges.special1 = true
      if (e.code === 'KeyI' || e.code === 'Digit2') this.edges.special2 = true
      if (e.code === 'Space' || e.code === 'Enter') this.edges.press = true
    }
    const up = (e: KeyboardEvent) => this.keys.delete(e.code)
    const blur = () => this.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }

  tap(k: 'pass' | 'tackle' | 'special1' | 'special2' | 'press') {
    this.edges[k] = true
  }

  /** Lecture pour un pas de simulation : consomme les fronts montants. */
  read(): Input {
    let mx = this.joy.x
    let my = this.joy.y
    for (const k of this.keys) {
      const m = MOVE_KEYS[k]
      if (m) { mx += m[0]; my += m[1] }
    }
    const l = Math.hypot(mx, my)
    if (l > 1) { mx /= l; my /= l }
    if (Math.abs(mx) > 0.1) this.lastMx = mx
    const shootDown = this.shootHeld || this.keys.has('KeyJ') || this.keys.has('Space')
    const i: Input = { ...NO_INPUT, mx, my, shootDown, ...this.edges }
    // Espace sert au tir chargé ET au timing du duel : le front 'press' est consommé ici
    this.edges = { pass: false, tackle: false, special1: false, special2: false, press: false }
    return i
  }
}
