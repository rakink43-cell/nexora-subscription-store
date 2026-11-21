import { NavLink, Outlet, Link } from 'react-router-dom'
import { LayoutDashboard, LifeBuoy, Package, ShoppingBag, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn, initials } from '../../lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/orders', label: 'My Orders', icon: Package },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
]

export default function DashboardLayout() {
  const { user, isAdmin } = useAuth()

  return (
    <div className="nx-container nx-game-dashboard py-8">
      <div className="nx-game-dashboard-header mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#A855F7] to-[#EC4899] text-sm font-bold text-white">
            {initials(user?.full_name ?? user?.email ?? 'N')}
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/35">Customer dashboard</p>
            <h1 className="font-display text-lg font-bold text-white">
              {user?.full_name ?? 'Welcome back'}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/admin" className="nx-btn nx-btn-outline-blue px-3 py-2 text-[12.5px]">
              Admin panel
            </Link>
          )}
          <Link to="/products" className="nx-btn nx-btn-primary px-3 py-2 text-[12.5px]" >
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
            Shop
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="nx-game-dashboard-nav lg:sticky lg:top-24 lg:self-start" aria-label="Dashboard">
          <div className="nx-scroll-x lg:flex-col lg:gap-0.5 lg:overflow-visible">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition',
                    isActive
                      ? 'bg-[#A855F7]/20 text-[#D8B4FE]'
                      : 'text-white/60 hover:bg-white/6 hover:text-white',
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
