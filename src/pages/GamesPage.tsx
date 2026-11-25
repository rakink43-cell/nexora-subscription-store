import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Gamepad2, Ghost, Shield, Rocket, Car, Puzzle,
  Sword, Mountain, Trophy, Coins, LockKeyhole, Play, X, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Game = { id: number; title: string; genre: string; description: string; icon: typeof Gamepad2; color: string; status: 'playable' | 'soon'; }

const GAMES: Game[] = [
  { id: 1, title: 'Neon Memory', genre: 'Puzzle', description: 'Remember the pattern and repeat it as the rounds get faster.', icon: Puzzle, color: 'from-violet-500/25 to-fuchsia-500/5', status: 'playable' },
  { id: 2, title: 'Shadow Escape', genre: 'Horror', description: 'Explore a mysterious abandoned place and find the exit.', icon: Ghost, color: 'from-red-500/25 to-rose-500/5', status: 'soon' },
  { id: 3, title: 'Tower Guard', genre: 'Tower Defense', description: 'Protect your base from waves of incoming enemies.', icon: Shield, color: 'from-cyan-500/25 to-blue-500/5', status: 'soon' },
  { id: 4, title: 'Star Pilot', genre: 'Space Action', description: 'Pilot through a cosmic field of hazards.', icon: Rocket, color: 'from-blue-500/25 to-indigo-500/5', status: 'soon' },
  { id: 5, title: 'Turbo Circuit', genre: 'Racing', description: 'Race against time on a neon track.', icon: Car, color: 'from-orange-500/25 to-amber-500/5', status: 'soon' },
  { id: 6, title: 'Dungeon Quest', genre: 'Adventure', description: 'Explore rooms, collect keys and uncover secrets.', icon: Sword, color: 'from-amber-500/25 to-yellow-500/5', status: 'soon' },
  { id: 7, title: 'Mountain Climb', genre: 'Platformer', description: 'Jump across platforms and reach the summit.', icon: Mountain, color: 'from-emerald-500/25 to-green-500/5', status: 'soon' },
  { id: 8, title: 'Zombie Holdout', genre: 'Survival', description: 'Survive increasingly difficult waves.', icon: Shield, color: 'from-lime-500/20 to-green-500/5', status: 'soon' },
  { id: 9, title: 'Mystery Rooms', genre: 'Mystery', description: 'Solve clues to unlock the next room.', icon: Puzzle, color: 'from-sky-500/25 to-cyan-500/5', status: 'soon' },
  { id: 10, title: 'Battle Blocks', genre: 'Arcade', description: 'Dodge, react and beat your best score.', icon: Gamepad2, color: 'from-pink-500/25 to-rose-500/5', status: 'soon' },
  { id: 11, title: 'City Builder', genre: 'City Simulator', description: 'Build a thriving city one block at a time.', icon: Mountain, color: 'from-teal-500/25 to-emerald-500/5', status: 'soon' },
  { id: 12, title: 'Farm Life', genre: 'Farm Simulator', description: 'Plant, harvest and grow your small farm.', icon: Sparkles, color: 'from-green-500/25 to-lime-500/5', status: 'soon' },
  { id: 13, title: 'Cafe Manager', genre: 'Business Sim', description: 'Run a cafe and keep customers happy.', icon: Trophy, color: 'from-amber-500/25 to-orange-500/5', status: 'soon' },
  { id: 14, title: 'Treasure Trail', genre: 'Treasure Hunt', description: 'Follow clues and find hidden treasure.', icon: Sparkles, color: 'from-yellow-500/25 to-amber-500/5', status: 'soon' },
  { id: 15, title: 'Endless Runner', genre: 'Runner', description: 'Keep moving, dodge obstacles and collect stars.', icon: ArrowRight, color: 'from-purple-500/25 to-violet-500/5', status: 'soon' },
  { id: 16, title: 'Deep Sea', genre: 'Exploration', description: 'Discover an underwater world and its secrets.', icon: Rocket, color: 'from-blue-500/25 to-teal-500/5', status: 'soon' },
  { id: 17, title: 'Tactical Grid', genre: 'Strategy', description: 'Plan each move on a compact tactical board.', icon: Shield, color: 'from-slate-500/25 to-gray-500/5', status: 'soon' },
  { id: 18, title: 'Alien Outpost', genre: 'Sci-Fi', description: 'Defend a remote outpost from strange visitors.', icon: Rocket, color: 'from-fuchsia-500/25 to-purple-500/5', status: 'soon' },
  { id: 19, title: 'Parkour Rush', genre: 'Action', description: 'Chain jumps and slides through an obstacle course.', icon: Sword, color: 'from-red-500/25 to-orange-500/5', status: 'soon' },
  { id: 20, title: 'Logic Lab', genre: 'Brain Game', description: 'Solve quick logic challenges and unlock harder puzzles.', icon: Puzzle, color: 'from-indigo-500/25 to-blue-500/5', status: 'soon' },
]

const FILTERS = ['All Games', 'Action', 'Adventure', 'Horror', 'Simulator', 'Puzzle']

const MUSIC_THEMES = [
  { slug: 'neon-memory', name: 'Neon Memory', bpm: 92, root: 220, scale: [0, 3, 7, 10, 12, 15, 19], wave: 'sine' as OscillatorType },
  { slug: 'shadow-escape', name: 'Shadow Escape', bpm: 68, root: 110, scale: [0, 2, 3, 7, 8, 12], wave: 'triangle' as OscillatorType },
  { slug: 'tower-guard', name: 'Tower Guard', bpm: 108, root: 146.83, scale: [0, 4, 7, 9, 12, 16, 19], wave: 'square' as OscillatorType },
  { slug: 'star-pilot', name: 'Star Pilot', bpm: 118, root: 174.61, scale: [0, 2, 4, 7, 9, 12, 14, 16], wave: 'sine' as OscillatorType },
  { slug: 'turbo-circuit', name: 'Turbo Circuit', bpm: 128, root: 130.81, scale: [0, 2, 4, 7, 9, 12, 14], wave: 'sawtooth' as OscillatorType },
  { slug: 'dungeon-quest', name: 'Dungeon Quest', bpm: 84, root: 164.81, scale: [0, 3, 5, 7, 10, 12, 15], wave: 'triangle' as OscillatorType },
  { slug: 'mountain-climb', name: 'Mountain Climb', bpm: 96, root: 196, scale: [0, 2, 4, 7, 9, 12, 16], wave: 'sine' as OscillatorType },
  { slug: 'zombie-holdout', name: 'Zombie Holdout', bpm: 76, root: 123.47, scale: [0, 1, 5, 7, 8, 12], wave: 'sawtooth' as OscillatorType },
  { slug: 'mystery-rooms', name: 'Mystery Rooms', bpm: 72, root: 207.65, scale: [0, 2, 3, 6, 7, 9, 12], wave: 'triangle' as OscillatorType },
  { slug: 'battle-blocks', name: 'Battle Blocks', bpm: 112, root: 155.56, scale: [0, 2, 5, 7, 9, 12, 14], wave: 'square' as OscillatorType },
  { slug: 'city-builder', name: 'City Builder', bpm: 88, root: 174.61, scale: [0, 2, 4, 5, 7, 9, 11, 12], wave: 'sine' as OscillatorType },
  { slug: 'farm-life', name: 'Farm Life', bpm: 90, root: 196, scale: [0, 2, 4, 7, 9, 12, 14], wave: 'triangle' as OscillatorType },
  { slug: 'cafe-manager', name: 'Cafe Manager', bpm: 100, root: 220, scale: [0, 2, 4, 7, 9, 11, 12], wave: 'sine' as OscillatorType },
  { slug: 'treasure-trail', name: 'Treasure Trail', bpm: 104, root: 185, scale: [0, 2, 4, 7, 9, 12, 16], wave: 'triangle' as OscillatorType },
  { slug: 'endless-runner', name: 'Endless Runner', bpm: 120, root: 164.81, scale: [0, 2, 4, 7, 9, 12, 14], wave: 'square' as OscillatorType },
  { slug: 'deep-sea', name: 'Deep Sea', bpm: 64, root: 130.81, scale: [0, 3, 5, 7, 10, 12, 15], wave: 'sine' as OscillatorType },
  { slug: 'tactical-grid', name: 'Tactical Grid', bpm: 82, root: 146.83, scale: [0, 2, 5, 7, 9, 12, 14], wave: 'triangle' as OscillatorType },
  { slug: 'alien-outpost', name: 'Alien Outpost', bpm: 102, root: 155.56, scale: [0, 1, 4, 6, 7, 8, 11, 12], wave: 'sine' as OscillatorType },
  { slug: 'parkour-rush', name: 'Parkour Rush', bpm: 126, root: 185, scale: [0, 2, 4, 7, 9, 12, 14], wave: 'sawtooth' as OscillatorType },
  { slug: 'logic-lab', name: 'Logic Lab', bpm: 86, root: 207.65, scale: [0, 2, 4, 6, 7, 9, 11, 12], wave: 'sine' as OscillatorType },
]

function ArcadeMusicPlayer({ themeIndex, setThemeIndex, playing, setPlaying }: { themeIndex: number; setThemeIndex: (index: number) => void; playing: boolean; setPlaying: (playing: boolean) => void }) {
  useEffect(() => {
    if (!playing) return
    const theme = MUSIC_THEMES[themeIndex]
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) { setPlaying(false); return }
    const ctx = new AudioCtor()
    const master = ctx.createGain()
    master.gain.value = 0.055
    master.connect(ctx.destination)
    let step = 0
    const beatMs = 60000 / theme.bpm / 2
    const playNote = () => {
      const scaleIndex = (step * (themeIndex % 3 + 1) + Math.floor(step / 7) * 2 + themeIndex) % theme.scale.length
      const octave = step % 8 === 0 ? 0.5 : step % 4 === 2 ? 2 : 1
      const freq = theme.root * octave * Math.pow(2, theme.scale[scaleIndex] / 12)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = theme.wave
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(step % 4 === 0 ? 0.42 : 0.2, ctx.currentTime + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + beatMs / 1000 * 0.85)
      osc.connect(gain); gain.connect(master)
      osc.start(); osc.stop(ctx.currentTime + beatMs / 1000)
      if (step % 4 === 0) {
        const bass = ctx.createOscillator()
        const bassGain = ctx.createGain()
        bass.type = 'sine'
        bass.frequency.setValueAtTime(theme.root * 0.5, ctx.currentTime)
        bassGain.gain.setValueAtTime(0.12, ctx.currentTime)
        bassGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
        bass.connect(bassGain); bassGain.connect(master)
        bass.start(); bass.stop(ctx.currentTime + 0.32)
      }
      step += 1
    }
    void ctx.resume()
    playNote()
    const timer = window.setInterval(playNote, beatMs)
    return () => { window.clearInterval(timer); void ctx.close() }
  }, [playing, themeIndex])
  return <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.04] p-4">
    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-fuchsia-200">Original Arcade BGM</p><p className="mt-1 text-[11px] text-white/40">Each game has its own generated theme. Choose a game to preview its unique music.</p></div>
    <select aria-label="Select game music" value={themeIndex} onChange={(e) => setThemeIndex(Number(e.target.value))} className="max-w-full rounded-lg border border-white/10 bg-[#090a10] px-3 py-2 text-xs text-white">{MUSIC_THEMES.map((theme, i) => <option key={theme.slug} value={i}>{theme.name}</option>)}</select>
    <button onClick={() => setPlaying(!playing)} className="nx-btn nx-btn-primary min-w-28 justify-center px-3 py-2 text-xs">{playing ? 'Stop music' : 'Play music'}</button>
  </div>
}

export default function GamesPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('All Games')
  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  const [catalogSlugs, setCatalogSlugs] = useState<string[] | null>(null)
  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.from('arcade_games').select('slug').eq('is_active', true).order('sort_order')
      .then(({ data, error }) => { if (active) setCatalogSlugs(error ? null : (data ?? []).map((row) => row.slug)) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!user || !supabase) { setCoinBalance(null); return }
    let active = true
    supabase.from('arcade_wallets').select('coin_balance').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => { if (active && !error) setCoinBalance(Number(data?.coin_balance ?? 0)) })
    return () => { active = false }
  }, [user])
  const [activeGame, setActiveGame] = useState<Game | null>(null)
  const [musicIndex, setMusicIndex] = useState(0)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const games = useMemo(() => GAMES.filter((g) => {
    if (catalogSlugs !== null && !catalogSlugs.includes(g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))) return false
    if (filter === 'All Games') return true
    if (filter === 'Simulator') return /sim/i.test(g.genre)
    if (filter === 'Puzzle') return /puzzle|brain|logic/i.test(g.genre)
    return g.genre.toLowerCase().includes(filter.toLowerCase())
  }), [filter, catalogSlugs])

  return (
    <div className="nx-container py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-[#090711] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-300"><Gamepad2 className="h-4 w-4"/> NEXORA ARCADE</p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-6xl">Play. Explore.<br/><span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">Earn Rewards.</span></h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">Twenty mini-game worlds are planned for your next break. Play across mobile and desktop, save progress to your account, and collect rewards as the secure wallet system rolls out.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#game-library" className="nx-btn nx-btn-primary px-4 py-2.5"><Play className="h-4 w-4"/> Explore games</a>
              <Link to="/dashboard" className="nx-btn nx-btn-ghost px-4 py-2.5"><Coins className="h-4 w-4"/> {user ? 'My account' : 'Login to play'}</Link>
            </div>
          </div>
          <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 shadow-[0_0_70px_rgba(139,92,246,.16)] sm:h-48 sm:w-48">
            <Gamepad2 className="h-16 w-16 text-violet-200 sm:h-20 sm:w-20"/>
            <span className="absolute -bottom-3 rounded-full border border-violet-300/25 bg-[#100b1d] px-4 py-1.5 text-xs font-bold text-violet-200">20 GAME WORLDS</span>
          </div>
        </div>
      </section>

      {user && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/15 text-violet-200"><Coins className="h-5 w-5"/></div><div><p className="text-xs text-white/45">Your Arcade Coins</p><p className="text-xl font-bold text-white">{coinBalance === null ? "Loading…" : coinBalance.toLocaleString()}</p></div></div><p className="max-w-sm text-xs leading-5 text-white/45">Welcome reward: 10 coins once per account. Level rewards are being secured before activation.</p></div>}
      <ArcadeMusicPlayer themeIndex={musicIndex} setThemeIndex={setMusicIndex} playing={musicPlaying} setPlaying={setMusicPlaying} />
      <section id="game-library" className="mt-10 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Game library</p><h2 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">Choose your next challenge</h2><p className="mt-2 text-sm text-white/45">{games.length} games currently visible · 20 game concepts in the catalogue</p></div>
          <div className="flex flex-wrap gap-1.5">{FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${filter === f ? 'border-violet-400/40 bg-violet-500/20 text-violet-200' : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'}`}>{f}</button>)}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {games.map((game) => {
            const Icon = game.icon
            return <article key={game.id} className="group overflow-hidden rounded-2xl border border-white/8 bg-[#0a0a0f] transition hover:-translate-y-0.5 hover:border-violet-400/30">
              <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${game.color}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.07),transparent_60%)]"/>
                <Icon className="relative h-12 w-12 text-white/75 transition group-hover:scale-110 group-hover:text-violet-200"/>
                <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-white/65">{game.genre}</span>
                <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${game.status === 'playable' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/50'}`}>{game.status === 'playable' ? 'PLAYABLE' : 'COMING SOON'}</span>
              </div>
              <div className="p-4"><h3 className="font-display text-base font-bold text-white">{String(game.id).padStart(2, '0')} · {game.title}</h3><p className="mt-1.5 min-h-10 text-xs leading-5 text-white/45">{game.description}</p>
                <button disabled={game.status !== 'playable'} onClick={() => { setMusicIndex(game.id - 1); setMusicPlaying(true); setActiveGame(game) }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 py-2.5 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-white/30">{game.status === 'playable' ? <><Play className="h-3.5 w-3.5"/> Play demo</> : <><LockKeyhole className="h-3.5 w-3.5"/> In development</>}</button>
              </div>
            </article>
          })}
        </div>
      </section>
      <section className="mt-8 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-xs leading-5 text-amber-100/60"><p className="font-semibold text-amber-100/80">Reward status</p>First-login coins are stored in your account wallet. Level rewards remain disabled until each game can verify its completed level server-side. Practice mode does not award coins.</section>
      {activeGame && <MemoryGame game={activeGame} onClose={() => { setActiveGame(null); setMusicPlaying(false) }} loggedIn={Boolean(user)}/>}
    </div>
  )
}

function MemoryGame({ game, onClose, loggedIn }: { game: Game; onClose: () => void; loggedIn: boolean }) {
  const [round, setRound] = useState(1)
  const [sequence, setSequence] = useState<number[]>(() => [Math.floor(Math.random() * 9)])
  const [input, setInput] = useState<number[]>([])
  const [phase, setPhase] = useState<'ready' | 'show' | 'input' | 'done'>('ready')
  const [flash, setFlash] = useState(-1)
  const [message, setMessage] = useState('Press Start to watch the pattern.')
  useEffect(() => {
    if (phase !== 'show') return
    const timers: ReturnType<typeof setTimeout>[] = []
    setFlash(-1)
    sequence.forEach((tile, index) => {
      timers.push(setTimeout(() => setFlash(tile), 450 + index * 700))
      timers.push(setTimeout(() => setFlash(-1), 850 + index * 700))
    })
    timers.push(setTimeout(() => {
      setFlash(-1)
      setInput([])
      setPhase('input')
      setMessage('Your turn! Repeat the pattern.')
    }, 450 + sequence.length * 700))
    return () => timers.forEach(clearTimeout)
  }, [phase, sequence])

  const reset = () => {
    setRound(1)
    setSequence([Math.floor(Math.random() * 9)])
    setInput([])
    setFlash(-1)
    setPhase('ready')
    setMessage('Press Start to watch the pattern.')
  }
  const tap = (n: number) => {
    if (phase !== 'input') return
    const next = [...input, n]
    setInput(next)
    if (sequence[next.length - 1] !== n) {
      setPhase('ready')
      setFlash(-1)
      setMessage('Pattern missed. Press Try again to replay this round.')
      return
    }
    if (next.length === sequence.length) {
      if (round >= 10) {
        setPhase('done')
        setMessage('You cleared all 10 practice rounds! Great memory.')
        return
      }
      const nextSeq = [...sequence, Math.floor(Math.random() * 9)]
      setSequence(nextSeq)
      setRound(round + 1)
      setPhase('show')
      setMessage('Round cleared! Watch the longer pattern.')
    }
  }
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={game.title}>
    <div className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#0b0912] p-5 shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Practice mini-game</p><h2 className="mt-1 text-xl font-bold text-white">{game.title}</h2></div><button onClick={onClose} aria-label="Close game" className="rounded-lg p-2 text-white/50 hover:bg-white/5"><X className="h-4 w-4"/></button></div>
      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center"><p className="text-xs text-white/55">Round {round} / 10</p><p className="mt-1 min-h-5 text-sm text-violet-200">{message}</p></div>
      <div className="mx-auto mt-4 grid max-w-[280px] grid-cols-3 gap-2">{Array.from({length:9},(_,n)=><button key={n} aria-label={`Tile ${n+1}`} onClick={()=>tap(n)} disabled={phase !== 'input'} className={`aspect-square rounded-xl border transition duration-150 ${flash === n ? 'scale-95 border-fuchsia-200 bg-fuchsia-300 shadow-[0_0_28px_rgba(232,121,249,.8)]' : phase === 'input' ? 'border-violet-300/25 bg-violet-500/15 hover:bg-violet-500/35 active:scale-95' : 'border-white/5 bg-white/[0.02]'}`}/>)}</div>
      <div className="mt-4 flex gap-2"><button disabled={phase === 'show' || phase === 'input'} onClick={()=>{setInput([]);setPhase('show');setMessage('Watch carefully…')}} className="nx-btn nx-btn-primary flex-1 justify-center py-2.5 disabled:opacity-50"><Play className="h-3.5 w-3.5"/> {phase === 'done' ? 'Play again' : phase === 'ready' ? (round === 1 && input.length === 0 ? 'Start round' : 'Try again') : 'Showing pattern…'}</button><button onClick={reset} className="nx-btn nx-btn-ghost px-4 py-2.5">Reset</button></div>
      <p className="mt-3 text-center text-[10px] text-white/35">{loggedIn ? 'Signed in · practice mode only' : 'Sign in to use future saved progress'} · No coins awarded in this demo</p>
    </div>
  </div>
}
