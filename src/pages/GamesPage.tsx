import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Gamepad2, Ghost, Shield, Rocket, Car, Puzzle,
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

export default function GamesPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('All Games')
  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  useEffect(() => {
    if (!user || !supabase) { setCoinBalance(null); return }
    let active = true
    supabase.from('arcade_wallets').select('coin_balance').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => { if (active && !error) setCoinBalance(Number(data?.coin_balance ?? 0)) })
    return () => { active = false }
  }, [user])
  const [activeGame, setActiveGame] = useState<Game | null>(null)
  const games = useMemo(() => GAMES.filter((g) => {
    if (filter === 'All Games') return true
    if (filter === 'Simulator') return /sim/i.test(g.genre)
    if (filter === 'Puzzle') return /puzzle|brain|logic/i.test(g.genre)
    return g.genre.toLowerCase().includes(filter.toLowerCase())
  }), [filter])

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
      <section id="game-library" className="mt-10 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Game library</p><h2 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">Choose your next challenge</h2><p className="mt-2 text-sm text-white/45">{GAMES.length} different game concepts · Responsive controls planned</p></div>
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
                <button disabled={game.status !== 'playable'} onClick={() => setActiveGame(game)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 py-2.5 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-white/30">{game.status === 'playable' ? <><Play className="h-3.5 w-3.5"/> Play demo</> : <><LockKeyhole className="h-3.5 w-3.5"/> In development</>}</button>
              </div>
            </article>
          })}
        </div>
      </section>
      <section className="mt-8 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-xs leading-5 text-amber-100/60"><p className="font-semibold text-amber-100/80">Reward status</p>First-login coins are stored in your account wallet. Level rewards remain disabled until each game can verify its completed level server-side. Practice mode does not award coins.</section>
      {activeGame && <MemoryGame game={activeGame} onClose={() => setActiveGame(null)} loggedIn={Boolean(user)}/>}
    </div>
  )
}

function MemoryGame({ game, onClose, loggedIn }: { game: Game; onClose: () => void; loggedIn: boolean }) {
  const [round, setRound] = useState(1)
  const [sequence, setSequence] = useState<number[]>(() => [Math.floor(Math.random() * 9)])
  const [input, setInput] = useState<number[]>([])
  const [message, setMessage] = useState('Watch the glowing tile, then repeat the pattern.')
  const [playing, setPlaying] = useState(false)
  const reset = () => { setRound(1); setSequence([Math.floor(Math.random() * 9)]); setInput([]); setPlaying(false); setMessage('Watch the glowing tile, then repeat the pattern.') }
  const tap = (n: number) => {
    if (!playing) return
    const next = [...input, n]
    setInput(next)
    if (sequence[next.length - 1] !== n) { setPlaying(false); setMessage('Not quite! Try again to beat the pattern.'); return }
    if (next.length === sequence.length) {
      if (round >= 10) { setPlaying(false); setMessage('Great memory! Demo completed. Rewards are not enabled in this preview.'); return }
      const nextSeq = [...sequence, Math.floor(Math.random() * 9)]
      setSequence(nextSeq); setInput([]); setRound(round + 1); setPlaying(false); setMessage('Round cleared! Press Start round to continue.')
    }
  }
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={game.title}>
    <div className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#0b0912] p-5 shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Practice mini-game</p><h2 className="mt-1 text-xl font-bold text-white">{game.title}</h2></div><button onClick={onClose} aria-label="Close game" className="rounded-lg p-2 text-white/50 hover:bg-white/5"><X className="h-4 w-4"/></button></div>
      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center"><p className="text-xs text-white/55">Round {round} / 10</p><p className="mt-1 text-sm text-violet-200">{message}</p></div>
      <div className="mx-auto mt-4 grid max-w-[280px] grid-cols-3 gap-2">{Array.from({length:9},(_,n)=><button key={n} aria-label={`Tile ${n+1}`} onClick={()=>tap(n)} disabled={!playing} className={`aspect-square rounded-xl border transition ${playing ? 'border-violet-300/20 bg-violet-500/10 hover:bg-violet-500/30 active:scale-95' : 'border-white/5 bg-white/[0.02]'}`}/>)}</div>
      <div className="mt-4 flex gap-2"><button onClick={()=>{setPlaying(true);setInput([]);setMessage('Repeat the pattern!')}} className="nx-btn nx-btn-primary flex-1 justify-center py-2.5"><Play className="h-3.5 w-3.5"/> {round === 1 && input.length === 0 ? 'Start round' : 'Try round'}</button><button onClick={reset} className="nx-btn nx-btn-ghost px-4 py-2.5">Reset</button></div>
      <p className="mt-3 text-center text-[10px] text-white/35">{loggedIn ? 'Signed in · practice mode only' : 'Login required for future saved progress'} · No coins awarded in this demo</p>
    </div>
  </div>
}
