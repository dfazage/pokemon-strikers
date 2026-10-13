import { useEffect, useMemo, useState } from 'react'
import { dailyChallenge, dayKey, type DailyChallenge } from '../engine/daily'
import type { GameState } from '../engine/sim'
import { SPECIES_BY_ID } from '../engine/data'
import { TYPE_COLOR, TYPE_LABEL } from '../engine/types'
import { HEARTS, currentStreak, dayRecord, loadSave, recordAttempt, type Attempt, type Save } from '../storage'
import { eventLine, shareText } from '../share'
import { MatchScreen } from './MatchScreen'
import { sprite } from '../render'

type Screen = 'home' | 'prep' | 'match' | 'result'

function secondsToReset(): number {
  const now = Date.now()
  const k = dayKey(new Date(now))
  let lo = now
  let hi = now + 25 * 3600 * 1000
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2
    if (dayKey(new Date(mid)) === k) lo = mid
    else hi = mid
  }
  return Math.max(0, Math.round((hi - now) / 1000))
}

function useCountdown() {
  const [s, setS] = useState(secondsToReset())
  useEffect(() => {
    const id = setInterval(() => setS(secondsToReset()), 1000)
    return () => clearInterval(id)
  }, [])
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

export function App() {
  const key = useMemo(() => dayKey(), [])
  const challenge = useMemo(() => dailyChallenge(key), [key])
  const [save, setSave] = useState<Save>(loadSave)
  const [screen, setScreen] = useState<Screen>('home')
  const [last, setLast] = useState<Attempt | null>(null)

  const rec = dayRecord(save, key)

  const finish = (s: GameState) => {
    const gf = s.teams[0].score
    const ga = s.teams[1].score
    const result: Attempt['result'] = gf > ga ? 'win' : gf < ga ? 'loss' : 'draw'
    const heartsAfter = result === 'win' ? rec.heartsLeft : rec.heartsLeft - 1
    const score = result === 'win' ? Math.max(0, 1000 + 120 * (gf - ga) + 40 * s.teams[0].hissatsu + 200 * heartsAfter) : 0
    const attempt: Attempt = { gf, ga, result, hissatsu: s.teams[0].hissatsu, score }
    setSave((prev) => recordAttempt(prev, key, attempt, eventLine(s)))
    setLast(attempt)
    setScreen('result')
  }

  return (
    <div className="app">
      <div className="blobs" aria-hidden="true"><i /><i /><i /></div>
      {screen === 'home' && <Home c={challenge} save={save} rec={rec} streak={currentStreak(save, key)} onPlay={() => setScreen('prep')} onResult={() => { setLast(rec.attempts[rec.attempts.length - 1] ?? null); setScreen('result') }} />}
      {screen === 'prep' && <Prep c={challenge} hearts={rec.heartsLeft} onBack={() => setScreen('home')} onStart={() => setScreen('match')} />}
      {screen === 'match' && <MatchScreen challenge={challenge} hearts={rec.heartsLeft} onEnd={finish} onQuit={() => setScreen('home')} />}
      {screen === 'result' && last && <Result c={challenge} rec={rec} attempt={last} streak={currentStreak(save, key)} onHome={() => setScreen('home')} onRetry={() => setScreen('prep')} />}
    </div>
  )
}

function TypePills({ types }: { types: string[] }) {
  return <>{types.map((t) => <span key={t} className="type-pill sm" style={{ background: TYPE_COLOR[t as keyof typeof TYPE_COLOR] }}>{TYPE_LABEL[t as keyof typeof TYPE_LABEL]}</span>)}</>
}

function TrainerPortrait({ id, name }: { id: string; name: string }) {
  const [bad, setBad] = useState(false)
  return bad ? (
    <div className="portrait fallback">{name[0]}</div>
  ) : (
    <img className="portrait" alt={name} src={`https://play.pokemonshowdown.com/sprites/trainers/${id}.png`} onError={() => setBad(true)} />
  )
}

function Home({ c, save, rec, streak, onPlay, onResult }: { c: DailyChallenge; save: Save; rec: ReturnType<typeof dayRecord>; streak: number; onPlay: () => void; onResult: () => void }) {
  const countdown = useCountdown()
  const t = c.trainer
  return (
    <main className="screen home">
      <header className="top glass">
        <div className="chip-stat">🔥 <b>{streak}</b> j</div>
        <div className="brand">POKÉMON <span>STRIKERS</span></div>
        <div className="chip-stat pixel-s">{save.score.toLocaleString('fr-FR')}</div>
      </header>

      <section className="titleRow">
        <h1>Match du Jour <small>#{c.number}</small></h1>
        <span className="timer">⏱ {countdown}</span>
      </section>

      <section className="hero glass">
        <div className="hero-head">
          <TrainerPortrait id={t.id} name={t.name} />
          <div>
            <div className="eyebrow">DRESSEUR DU JOUR</div>
            <h2>{t.name}</h2>
            <div className="muted">{t.title}</div>
            <div className="stars" aria-label={`Difficulté ${t.difficulty} sur 3`}>{'★'.repeat(t.difficulty)}<span>{'★'.repeat(3 - t.difficulty)}</span></div>
          </div>
        </div>
        <div className="sprites-row">
          {c.theirs.map((f) => <img key={f.speciesId} src={sprite(f.speciesId, 'front').src} alt={SPECIES_BY_ID.get(f.speciesId)?.name} />)}
        </div>
        {rec.done ? (
          <button className="cta" onClick={onResult}>{rec.won ? 'Voir ma victoire' : 'Défi terminé — voir le bilan'}</button>
        ) : (
          <button className="cta" onClick={onPlay}>Préparer le match</button>
        )}
        <div className="hearts big">{'❤️'.repeat(rec.heartsLeft)}{'🖤'.repeat(HEARTS - rec.heartsLeft)}</div>
      </section>

      <section className="stats">
        <div className="tile glass"><b>{save.wins}</b><span>Victoires</span></div>
        <div className="tile glass"><b>{streak}</b><span>Série</span></div>
        <div className="tile glass"><b>{save.best}</b><span>Record</span></div>
      </section>

      <section>
        <div className="eyebrow pad">TON ÉQUIPE IMPOSÉE</div>
        <div className="carousel">
          {[...c.ours.map((f) => f.speciesId), ...(c.oursReserve ? [c.oursReserve] : [])].map((id) => (
            <div key={id} className="mini glass"><img src={sprite(id, 'front').src} alt="" /><span>{SPECIES_BY_ID.get(id)?.name}</span></div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Prep({ c, hearts, onBack, onStart }: { c: DailyChallenge; hearts: number; onBack: () => void; onStart: () => void }) {
  const roleLabel = { GK: 'Gardien', DEF: 'Défenseur', FWD: 'Attaquant' } as const
  return (
    <main className="screen prep">
      <header className="top glass">
        <button className="icon-btn" onClick={onBack} aria-label="Retour">‹</button>
        <div className="brand">ÉQUIPE DU JOUR</div>
        <div className="hearts">{'❤️'.repeat(hearts)}{'🖤'.repeat(HEARTS - hearts)}</div>
      </header>
      <p className="muted pad">Même équipe pour tout le monde. <b>3 titulaires + 1 remplaçant</b>, les PP sont partagés.</p>
      <div className="formation" aria-label="Composition sur le terrain">
        <div className="f-center" />
        <div className="f-box" />
        {c.ours.slice().reverse().map((f, i) => (
          <div key={f.speciesId} className="f-slot" style={{ left: ['50%', '24%', '50%'][i], top: ['16%', '52%', '78%'][i] }}>
            <img src={sprite(f.speciesId, 'back').src} alt="" />
            <i className="disc" />
            <span className="f-role">{{ FWD: 'ATT', DEF: 'DÉF', GK: 'GB' }[f.role]}</span>
          </div>
        ))}
        {c.oursReserve && (
          <div className="f-bench"><span>BANC</span><img src={sprite(c.oursReserve, 'back').src} alt="" /></div>
        )}
      </div>
      <div className="cards">
        {c.ours.map((f) => {
          const sp = SPECIES_BY_ID.get(f.speciesId)!
          return (
            <article key={f.speciesId} className="pcard glass">
              <img src={sprite(f.speciesId, 'back').src} alt="" />
              <div className="pbody">
                <h3>{sp.name} {f.captain && <span className="cap">★ CAPITAINE</span>}</h3>
                <div className="muted">{roleLabel[f.role]}</div>
                <div className="row"><TypePills types={sp.types} /></div>
                <div className="bars">
                  <label>VIT<i style={{ width: `${sp.spd * 10}%` }} /></label>
                  <label>PUI<i style={{ width: `${sp.pow * 10}%` }} /></label>
                  <label>DÉF<i style={{ width: `${sp.def * 10}%` }} /></label>
                </div>
              </div>
            </article>
          )
        })}
        {c.oursReserve && (
          <article className="pcard glass reserve">
            <img src={sprite(c.oursReserve, 'back').src} alt="" />
            <div className="pbody"><h3>{SPECIES_BY_ID.get(c.oursReserve)?.name}</h3><div className="muted">Remplaçant · entre en jeu dans une prochaine version</div></div>
          </article>
        )}
      </div>
      <button className="cta sticky" onClick={onStart}>Coup d’envoi</button>
    </main>
  )
}

function Result({ c, rec, attempt, streak, onHome, onRetry }: { c: DailyChallenge; rec: ReturnType<typeof dayRecord>; attempt: Attempt; streak: number; onHome: () => void; onRetry: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = shareText(c, rec, attempt)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch { /* annulé */ }
  }
  const title = attempt.result === 'win' ? 'Victoire !' : attempt.result === 'draw' ? 'Match nul' : 'Défaite'
  return (
    <main className="screen result">
      <header className="top glass"><div className="brand">RÉSULTAT · #{c.number}</div></header>
      <section className="glass hero center">
        <h1 className={`res ${attempt.result}`}>{title}</h1>
        <div className="bigscore pixel">{attempt.gf} - {attempt.ga}</div>
        <div className="muted">contre {c.trainer.name}</div>
        <div className="hearts big">{'❤️'.repeat(rec.heartsLeft)}{'🖤'.repeat(HEARTS - rec.heartsLeft)}</div>
        <div className="stats">
          <div className="tile"><b>{streak}</b><span>Série</span></div>
          <div className="tile"><b>{attempt.hissatsu}</b><span>Hissatsu</span></div>
          <div className="tile"><b>{attempt.score}</b><span>Score</span></div>
        </div>
        <pre className="share">{text}</pre>
        <button className="cta" onClick={share}>{copied ? 'Copié !' : 'Partager'}</button>
        {!rec.done && <button className="cta ghost" onClick={onRetry}>Réessayer ({rec.heartsLeft} ❤️)</button>}
        <button className="cta ghost" onClick={onHome}>Accueil</button>
      </section>
    </main>
  )
}
