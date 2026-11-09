import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { Logo } from '../brand/Logo'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/SettingsContext'
import { cn, formatBDT } from '../../lib/utils'
import { api } from '../../lib/api'
import type { Product } from '../../types'

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'All Products', to: '/products' },
  { label: 'OTT', to: '/category/ott-subscriptions' },
  { label: 'AI Tools', to: '/category/ai-premium-tools' },
  { label: 'Education', to: '/category/educational-subscriptions' },
  { label: 'Offers', to: '/offers' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { count } = useCart()
  const { user, isAdmin, signOut } = useAuth()
  const { categories, settings } = useStore()

  useEffect(() => {
    setMobileOpen(false)
    setCatOpen(false)
    setUserOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setCatOpen(false)
        setUserOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#050505]/85 backdrop-blur-xl">
      {settings.notices?.announcement_active && settings.notices?.announcement && (
        <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-r from-[#008CFF]/15 via-[#050505] to-[#F00016]/15">
          <div className="nx-container flex h-8 items-center justify-center">
            <p className="flex items-center gap-2 text-center text-[11px] font-medium text-white/70 sm:text-xs">
              <Sparkles className="h-3 w-3 shrink-0 text-[#6EC1FF]" aria-hidden />
              <span className="truncate">{settings.notices.announcement}</span>
            </p>
          </div>
        </div>
      )}

      <div className="nx-container flex h-16 items-center gap-3">
        <Logo />

        {/* desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((v) => !v)}
              aria-expanded={catOpen}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/70 transition hover:bg-white/6 hover:text-white"
            >
              Categories
              <ChevronDown className={cn('h-3.5 w-3.5 transition', catOpen && 'rotate-180')} aria-hidden />
            </button>
            {catOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCatOpen(false)} aria-hidden />
                <div className="nx-glass absolute left-0 top-full z-20 mt-2 w-[420px] overflow-hidden rounded-xl p-2 shadow-2xl">
                  <div className="grid grid-cols-2 gap-1">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        to={`/category/${c.slug}`}
                        className="group rounded-lg px-3 py-2.5 transition hover:bg-white/6"
                      >
                        <p className="text-[13px] font-medium text-white group-hover:text-[#6EC1FF]">
                          {c.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-white/40">{c.description}</p>
                      </Link>
                    ))}
                  </div>
                  <Link
                    to="/products"
                    className="mt-1 flex items-center justify-between rounded-lg bg-[#008CFF]/10 px-3 py-2.5 text-[13px] font-semibold text-[#6EC1FF] transition hover:bg-[#008CFF]/20"
                  >
                    Browse all subscriptions
                    <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </div>

          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'nx-link-underline rounded-lg px-3 py-2 text-[13.5px] font-medium transition',
                  isActive ? 'text-white' : 'text-white/65 hover:text-white',
                )
              }
            >
              {({ isActive }) => <span data-active={isActive}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <SearchTrigger onOpen={() => setSearchOpen(true)} />

          {user ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-2.5 text-[13px] font-medium text-white/85 transition hover:border-white/25 hover:text-white"
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#008CFF] to-[#F00016] text-[11px] font-bold text-white">
                  {(user.full_name ?? user.email ?? 'U').slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[80px] truncate md:inline">
                  {user.full_name?.split(' ')[0] ?? 'Account'}
                </span>
                <ChevronDown className="h-3 w-3 text-white/50" aria-hidden />
              </button>
              {userOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} aria-hidden />
                  <div className="nx-glass absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl p-1.5 shadow-2xl">
                    <div className="border-b border-white/8 px-3 pb-2.5 pt-1.5">
                      <p className="truncate text-[13px] font-semibold text-white">{user.full_name ?? 'Customer'}</p>
                      <p className="truncate text-[11px] text-white/45">{user.email}</p>
                    </div>
                    <MenuLink to="/dashboard" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>
                      Dashboard
                    </MenuLink>
                    <MenuLink to="/dashboard/orders" icon={<Package className="h-3.5 w-3.5" />}>
                      My Orders
                    </MenuLink>
                    <MenuLink to="/dashboard/profile" icon={<User className="h-3.5 w-3.5" />}>
                      Profile settings
                    </MenuLink>
                    {isAdmin && (
                      <MenuLink to="/admin" icon={<Sparkles className="h-3.5 w-3.5" />} highlight>
                        Admin panel
                      </MenuLink>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await signOut()
                        navigate('/')
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-white/85 transition hover:border-white/25 hover:text-white sm:block"
            >
              Login
            </Link>
          )}

          <Link
            to="/cart"
            className="relative grid h-9.5 w-9.5 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-[#008CFF]/50 hover:text-white"
            aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
            style={{ height: '2.4rem', width: '2.4rem' }}
          >
            <ShoppingCart className="h-4.5 w-4.5" style={{ height: '1.1rem', width: '1.1rem' }} aria-hidden />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#F00016] px-1 text-[10px] font-bold text-white ring-2 ring-[#050505]">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>

          <Link
            to="/products"
            className="nx-btn nx-btn-primary hidden px-3.5 py-2 text-[13px] xl:inline-flex"
          >
            Explore
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="grid h-9.5 w-9.5 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white lg:hidden"
            style={{ height: '2.4rem', width: '2.4rem' }}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <MobileNav
          categories={categories}
          user={user ? { name: user.full_name ?? user.email ?? '' } : null}
          isAdmin={isAdmin}
          onLogout={async () => {
            await signOut()
            navigate('/')
          }}
        />
      )}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  )
}

function MenuLink({
  to,
  icon,
  children,
  highlight,
}: {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition',
        highlight
          ? 'text-[#6EC1FF] hover:bg-[#008CFF]/12'
          : 'text-white/75 hover:bg-white/6 hover:text-white',
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

function MobileNav({
  categories,
  user,
  isAdmin,
  onLogout,
}: {
  categories: { id: string; name: string; slug: string }[]
  user: { name: string } | null
  isAdmin: boolean
  onLogout: () => void
}) {
  return (
    <div className="nx-glass max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/8 lg:hidden">
      <nav className="nx-container py-3" aria-label="Mobile">
        <div className="grid gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-[#008CFF]/15 text-[#6EC1FF]' : 'text-white/75 hover:bg-white/6',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <p className="mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Categories
        </p>
        <div className="grid gap-0.5">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.slug}`}
              className="rounded-lg px-3 py-2 text-[13px] text-white/65 transition hover:bg-white/6 hover:text-white"
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-4 grid gap-0.5 border-t border-white/8 pt-3">
          {user ? (
            <>
              <Link to="/dashboard" className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/6">
                Dashboard
              </Link>
              <Link to="/dashboard/orders" className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/6">
                My Orders
              </Link>
              {isAdmin && (
                <Link to="/admin" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#6EC1FF] hover:bg-white/6">
                  Admin Panel
                </Link>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-300 hover:bg-rose-500/10"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1">
              <Link to="/login" className="nx-btn nx-btn-ghost py-2.5 text-[13px]">
                Login
              </Link>
              <Link to="/register" className="nx-btn nx-btn-primary py-2.5 text-[13px]">
                Register
              </Link>
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 px-1">
            <Link to="/faq" className="nx-btn nx-btn-ghost py-2 text-xs">FAQ</Link>
            <Link to="/contact" className="nx-btn nx-btn-ghost py-2 text-xs">Contact</Link>
          </div>
        </div>
      </nav>
    </div>
  )
}

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search subscriptions"
      className="grid h-9.5 w-9.5 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-[#008CFF]/50 hover:text-white sm:hidden"
      style={{ height: '2.4rem', width: '2.4rem' }}
    >
      <Search className="h-4 w-4" aria-hidden />
    </button>
  )
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    let active = true
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const { rows } = await api.catalogue.products({ search: query, perPage: 6 })
        if (active) setResults(rows)
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 260)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/products?q=${encodeURIComponent(query.trim())}`)
    onClose()
  }

  const suggestions = useMemo(() => ['Netflix', 'ChatGPT Plus', 'Canva Pro', 'Microsoft 365', 'Spotify'], [])

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="nx-container relative pt-[12vh]">
        <div className="nx-glass mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-2xl">
          <form onSubmit={submit} className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
            <Search className="h-4.5 w-4.5 shrink-0 text-white/40" style={{ height: '1.1rem', width: '1.1rem' }} aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Netflix, ChatGPT, Canva, Microsoft 365…"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              aria-label="Search products"
            />
            <button type="button" onClick={onClose} aria-label="Close search" className="rounded p-1 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </form>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading && <p className="px-3 py-4 text-xs text-white/40">Searching…</p>}
            {!loading && query.trim().length < 2 && (
              <div className="px-3 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  Popular searches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuery(s)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:border-[#008CFF]/50 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <p className="px-3 py-4 text-xs text-white/45">
                No matches for “{query}”. Try a brand name like Netflix or Canva.
              </p>
            )}
            {results.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-white/6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#008CFF]/25 to-[#F00016]/15 text-[11px] font-bold text-white">
                  {(p.brand ?? p.name).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{p.name}</p>
                  <p className="truncate text-[11px] text-white/40">
                    {p.brand} · {p.duration}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-[#6EC1FF]">
                  {formatBDT(p.discounted_price)}
                </span>
              </Link>
            ))}
            {query.trim().length >= 2 && results.length > 0 && (
              <button
                type="button"
                onClick={submit}
                className="mt-1 w-full rounded-lg bg-[#008CFF]/10 px-3 py-2.5 text-xs font-semibold text-[#6EC1FF] transition hover:bg-[#008CFF]/20"
              >
                See all results for “{query}”
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
