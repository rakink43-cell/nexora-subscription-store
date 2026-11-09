import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  ChevronLeft,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Receipt,
  Settings,
  Sparkles,
  Star,
  Store,
  Tags,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import { Logo } from '../../components/brand/Logo'
import { api, isDemoMode } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { cn, timeAgo } from '../../lib/utils'
import type { Notification } from '../../types'

const NAV: { section: string; items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] }[] = [
  {
    section: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    section: 'Commerce',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: Receipt },
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/categories', label: 'Categories', icon: Tags },
      { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
    ],
  },
  {
    section: 'Customers',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/support', label: 'Support', icon: LifeBuoy },
      { to: '/admin/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    section: 'Website',
    items: [
      { to: '/admin/promotions', label: 'Promotions', icon: Sparkles },
      { to: '/admin/content', label: 'Content & FAQ', icon: MessageSquareQuote },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    setMobileOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  const loadNotifications = () => {
    api.admin
      .notifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }

  useEffect(() => {
    loadNotifications()
  }, [location.pathname])

  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-[#05070C]">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#05070C]/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 lg:hidden"
            aria-label="Toggle admin menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2.5">
            <Logo size="sm" withWordmark={false} to="/admin" />
            <div className="hidden sm:block">
              <p className="text-[13px] font-semibold leading-none text-white">NEXORA Admin</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">Control panel</p>
            </div>
          </div>

          {isDemoMode && (
            <span className="ml-1 hidden rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-300 sm:inline">
              Demo mode
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-white/25 hover:text-white sm:flex"
            >
              <Store className="h-3.5 w-3.5" aria-hidden />
              View store
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v)
                  if (!notifOpen && unread > 0) {
                    api.admin.markNotificationsRead().then(loadNotifications).catch(() => {})
                  }
                }}
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:text-white"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#F00016] px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} aria-hidden />
                  <div className="nx-glass absolute right-0 top-full z-20 mt-2 max-h-[70vh] w-[min(92vw,340px)] overflow-y-auto rounded-xl p-1.5 shadow-2xl">
                    <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Notifications
                    </p>
                    {notifications.length === 0 ? (
                      <p className="px-2.5 py-4 text-[12px] text-white/40">Nothing yet.</p>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <Link
                          key={n.id}
                          to={n.link ?? '/admin/orders'}
                          className="block rounded-lg px-2.5 py-2 transition hover:bg-white/6"
                        >
                          <p className="text-[12.5px] font-medium text-white">{n.title}</p>
                          <p className="truncate text-[11px] text-white/45">{n.body}</p>
                          <p className="mt-0.5 text-[10px] text-white/25">{timeAgo(n.created_at)}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-white/10 px-2 py-1 sm:flex">
              <span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-[#008CFF] to-[#F00016] text-[10px] font-bold text-white">
                {(user?.full_name ?? 'A').slice(0, 1)}
              </span>
              <span className="max-w-[90px] truncate text-[12px] text-white/70">{user?.full_name}</span>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/50 transition hover:border-rose-500/40 hover:text-rose-300"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-60 transform border-r border-white/8 bg-[#05070C] pt-14 transition-transform lg:sticky lg:top-14 lg:z-0 lg:block lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 lg:pt-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <nav className="h-full overflow-y-auto px-2.5 py-4" aria-label="Admin">
            {NAV.map((group) => (
              <div key={group.section} className="mb-4">
                <p className="mb-1.5 px-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/30">
                  {group.section}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition',
                          isActive
                            ? 'bg-[#008CFF]/15 text-[#6EC1FF]'
                            : 'text-white/60 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-6 rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-white/60">
                <BarChart3 className="h-3 w-3 text-[#6EC1FF]" aria-hidden />
                {isDemoMode ? 'Demo dataset' : 'Live database'}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                {isDemoMode
                  ? 'Changes are saved in this browser only and reset when you clear storage.'
                  : 'All changes are written to Supabase and audited.'}
              </p>
            </div>
          </nav>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6">
          <div className="mb-4 flex items-center gap-2 text-[11.5px] text-white/35">
            <Link to="/admin" className="hover:text-white">Admin</Link>
            <ChevronLeft className="h-3 w-3 rotate-180" aria-hidden />
            <span className="text-white/60">
              {location.pathname === '/admin' ? 'Dashboard' : location.pathname.split('/').pop()}
            </span>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
