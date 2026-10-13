export type PType =
  | 'normal' | 'feu' | 'eau' | 'plante' | 'electrik' | 'glace' | 'combat' | 'poison' | 'sol'
  | 'vol' | 'psy' | 'insecte' | 'roche' | 'spectre' | 'dragon' | 'tenebres' | 'acier'

export const TYPE_LABEL: Record<PType, string> = {
  normal: 'Normal', feu: 'Feu', eau: 'Eau', plante: 'Plante', electrik: 'Électrik', glace: 'Glace',
  combat: 'Combat', poison: 'Poison', sol: 'Sol', vol: 'Vol', psy: 'Psy', insecte: 'Insecte',
  roche: 'Roche', spectre: 'Spectre', dragon: 'Dragon', tenebres: 'Ténèbres', acier: 'Acier',
}

export const TYPE_COLOR: Record<PType, string> = {
  normal: '#A8A878', feu: '#F08030', eau: '#6890F0', plante: '#78C850', electrik: '#F8D030',
  glace: '#98D8D8', combat: '#C03028', poison: '#A040A0', sol: '#E0C068', vol: '#A890F0',
  psy: '#F85888', insecte: '#A8B820', roche: '#B8A038', spectre: '#705898', dragon: '#7038F8',
  tenebres: '#705848', acier: '#B8B8D0',
}

// Table d'efficacité génération 5 (hors Fée). Seules les entrées != 1 sont listées.
const CHART: Record<PType, Partial<Record<PType, number>>> = {
  normal: { roche: 0.5, acier: 0.5, spectre: 0 },
  feu: { feu: 0.5, eau: 0.5, plante: 2, glace: 2, insecte: 2, roche: 0.5, dragon: 0.5, acier: 2 },
  eau: { feu: 2, eau: 0.5, plante: 0.5, sol: 2, roche: 2, dragon: 0.5 },
  plante: { feu: 0.5, eau: 2, plante: 0.5, poison: 0.5, sol: 2, vol: 0.5, insecte: 0.5, roche: 2, dragon: 0.5, acier: 0.5 },
  electrik: { eau: 2, plante: 0.5, electrik: 0.5, sol: 0, vol: 2, dragon: 0.5 },
  glace: { feu: 0.5, eau: 0.5, plante: 2, glace: 0.5, sol: 2, vol: 2, dragon: 2, acier: 0.5 },
  combat: { normal: 2, glace: 2, poison: 0.5, vol: 0.5, psy: 0.5, insecte: 0.5, roche: 2, spectre: 0, tenebres: 2, acier: 2 },
  poison: { plante: 2, poison: 0.5, sol: 0.5, roche: 0.5, spectre: 0.5, acier: 0 },
  sol: { feu: 2, plante: 0.5, electrik: 2, poison: 2, vol: 0, insecte: 0.5, roche: 2, acier: 2 },
  vol: { plante: 2, electrik: 0.5, combat: 2, insecte: 2, roche: 0.5, acier: 0.5 },
  psy: { combat: 2, poison: 2, psy: 0.5, tenebres: 0, acier: 0.5 },
  insecte: { feu: 0.5, plante: 2, combat: 0.5, poison: 0.5, vol: 0.5, psy: 2, spectre: 0.5, tenebres: 2, acier: 0.5 },
  roche: { feu: 2, glace: 2, combat: 0.5, sol: 0.5, vol: 2, insecte: 2, acier: 0.5 },
  spectre: { normal: 0, psy: 2, spectre: 2, tenebres: 0.5, acier: 0.5 },
  dragon: { dragon: 2, acier: 0.5 },
  tenebres: { combat: 0.5, psy: 2, spectre: 2, tenebres: 0.5, acier: 0.5 },
  acier: { feu: 0.5, eau: 0.5, electrik: 0.5, glace: 2, roche: 2, acier: 0.5 },
}

/** Multiplicateur d'une attaque `atk` contre un Pokémon de types `def`. */
export function effectiveness(atk: PType, def: readonly PType[]): number {
  let m = 1
  for (const d of def) m *= CHART[atk][d] ?? 1
  return m
}

/** Pour éviter qu'une immunité annule totalement un hissatsu (arcade), on plancher à 0.25. */
export function duelEffect(atk: PType, def: readonly PType[]): number {
  return Math.max(0.25, effectiveness(atk, def))
}
