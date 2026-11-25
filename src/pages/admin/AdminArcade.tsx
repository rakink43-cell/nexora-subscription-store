import { useCallback, useEffect, useState } from 'react'
import { Gamepad2, RefreshCw, Save, ShieldCheck, ToggleLeft, ToggleRight, Coins } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type ArcadeGame = { slug: string; title: string; genre: string; description: string; is_active: boolean; sort_order: number }
type ArcadeLevel = { game_slug: string; level_number: number; reward_coins: number }

export default function AdminArcade() {
  const [games, setGames] = useState<ArcadeGame[]>([])
  const [levels, setLevels] = useState<ArcadeLevel[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setMessage('Connect the live Supabase project to manage Arcade settings.'); setLoading(false); return }
    setLoading(true)
    const [g, l] = await Promise.all([
      supabase.from('arcade_games').select('slug,title,genre,description,is_active,sort_order').order('sort_order'),
      supabase.from('arcade_game_levels').select('game_slug,level_number,reward_coins').order('level_number'),
    ])
    if (g.error || l.error) setMessage(g.error?.message ?? l.error?.message ?? 'Unable to load Arcade settings.')
    else {
      const rows = (g.data ?? []) as ArcadeGame[]
      setGames(rows)
      setLevels((l.data ?? []) as ArcadeLevel[])
      setSelected((current) => current || rows[0]?.slug || '')
      setMessage('')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const toggleGame = async (game: ArcadeGame) => {
    if (!supabase) return
    setSaving(true); setMessage('')
    const { error } = await supabase.from('arcade_games').update({ is_active: !game.is_active }).eq('slug', game.slug)
    if (error) setMessage(error.message)
    else { setGames((prev) => prev.map((g) => g.slug === game.slug ? { ...g, is_active: !g.is_active } : g)); setMessage(`${game.title} ${game.is_active ? 'hidden' : 'activated'}.`) }
    setSaving(false)
  }

  const updateReward = (level: number, value: string) => {
    const coins = Math.max(0, Math.min(10000, Math.floor(Number(value) || 0)))
    setLevels((prev) => prev.map((row) => row.game_slug === selected && row.level_number === level ? { ...row, reward_coins: coins } : row))
  }

  const saveRewards = async () => {
    if (!supabase || !selected) return
    setSaving(true); setMessage('')
    const rows = levels.filter((row) => row.game_slug === selected)
    const { error } = await supabase.from('arcade_game_levels').upsert(rows, { onConflict: 'game_slug,level_number' })
    setMessage(error ? error.message : 'Level coin rewards saved.')
    setSaving(false)
  }

  const activeCount = games.filter((g) => g.is_active).length
  const current = games.find((g) => g.slug === selected)

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Arcade control center</p><h1 className="mt-1 font-display text-2xl font-bold text-white">Games & Rewards</h1><p className="mt-1 text-sm text-white/45">Manage game visibility and level coin values.</p></div><button onClick={() => void load()} className="nx-btn nx-btn-ghost px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5"/> Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Games in catalogue" value={String(games.length)} icon={<Gamepad2 className="h-4 w-4"/>}/><Stat label="Visible in Arcade" value={String(activeCount)} icon={<ToggleRight className="h-4 w-4"/>}/><Stat label="Level reward rules" value={String(levels.length)} icon={<Coins className="h-4 w-4"/>}/></div>
    {message && <div role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/65">{message}</div>}
    {loading ? <div className="rounded-xl border border-white/8 p-8 text-center text-sm text-white/45">Loading Arcade settings…</div> : <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"><h2 className="mb-3 text-sm font-bold text-white">Game catalogue</h2><div className="space-y-2">{games.map((game) => <div key={game.slug} className="flex items-center gap-3 rounded-xl border border-white/6 bg-black/20 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-violet-200"><Gamepad2 className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{game.title}</p><p className="text-[11px] text-white/40">{game.genre}</p></div><span className={`text-[10px] font-bold ${game.is_active ? 'text-emerald-300' : 'text-white/30'}`}>{game.is_active ? 'ACTIVE' : 'HIDDEN'}</span><button disabled={saving} onClick={() => void toggleGame(game)} aria-label={`${game.is_active ? 'Hide' : 'Activate'} ${game.title}`} className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 disabled:opacity-40">{game.is_active ? <ToggleRight className="h-5 w-5 text-emerald-300"/> : <ToggleLeft className="h-5 w-5"/>}</button></div>)}</div></section>
      <section className="h-fit rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="mb-3 flex items-center gap-2"><Coins className="h-4 w-4 text-amber-300"/><h2 className="text-sm font-bold text-white">Level coin rewards</h2></div><label className="mb-2 block text-xs text-white/45">Select game</label><select value={selected} onChange={(e) => setSelected(e.target.value)} className="mb-4 w-full rounded-lg border border-white/10 bg-[#090a10] px-3 py-2 text-sm text-white">{games.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}</select>{current && <p className="mb-3 text-[11px] leading-5 text-white/40">Reward amounts are configured here. Level completion rewards remain inactive until secure game validation is enabled.</p>}<div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">{levels.filter((l) => l.game_slug === selected).map((row) => <label key={row.level_number} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 px-3 py-2"><span className="text-xs text-white/60">Level {row.level_number}</span><span className="flex items-center gap-2"><input type="number" min="0" max="10000" value={row.reward_coins} onChange={(e) => updateReward(row.level_number, e.target.value)} className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-right text-xs text-white"/><span className="text-[10px] text-amber-200/60">coins</span></span></label>)}</div><button disabled={saving || !levels.some((l) => l.game_slug === selected)} onClick={() => void saveRewards()} className="nx-btn nx-btn-primary mt-4 w-full justify-center py-2.5 text-xs"><Save className="h-3.5 w-3.5"/> {saving ? 'Saving…' : 'Save level rewards'}</button></section>
    </div>}
    <div className="flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3 text-[11px] leading-5 text-emerald-100/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"/><p>Wallet balance and ledger are protected by row-level security. Admin can configure game visibility and reward values; customer coin awards are not client-editable.</p></div>
  </div>
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4"><div className="flex items-center gap-2 text-violet-200">{icon}<span className="text-[11px] text-white/40">{label}</span></div><p className="mt-2 text-2xl font-bold text-white">{value}</p></div>
}
