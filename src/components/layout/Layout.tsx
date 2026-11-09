import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { Header } from './Header'
import { Footer } from './Footer'
import { useStore } from '../../context/SettingsContext'
import { contactLink } from '../../lib/utils'
import { getDataSource } from '../../lib/api'

export function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <DemoBanner />
      <Header />
      <main id="main" className="flex-1">
        <div key={pathname} className="nx-page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-[#008CFF] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      Skip to content
    </a>
  )
}

/** Honest, dismissible notice while the app runs on local demo data. */
function DemoBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('nexora.demoBanner') === 'hidden',
  )
  const source = getDataSource()

  if (source === 'live' || dismissed) return null

  const isSetup = source === 'setup'

  return (
    <div
      className={
        isSetup
          ? 'border-b border-rose-500/30 bg-rose-500/[0.09] px-3 py-2'
          : 'border-b border-amber-500/25 bg-amber-500/[0.08] px-3 py-2'
      }
    >
      <div className="nx-container flex items-center gap-2.5">
        <span
          className={
            isSetup
              ? 'shrink-0 rounded bg-rose-500/25 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-rose-200'
              : 'shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-300'
          }
        >
          {isSetup ? 'Setup required' : 'Demo'}
        </span>
        {isSetup ? (
          <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-rose-100/85">
            Supabase is connected but the <b>database schema has not been applied</b>. Catalogue is
            shown from bundled demo data; <b>sign-up, login, orders and the admin panel are disabled</b>{' '}
            until you run <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[10.5px]">supabase/migrations/0001–0009</code>{' '}
            in the Supabase SQL editor. See <b>docs/SETUP.md</b>.
          </p>
        ) : (
          <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-amber-100/80">
            No Supabase credentials detected — running on local browser storage so you can test every
            flow. Add <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[10.5px]">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-black/40 py-0.5 font-mono text-[10.5px] px-1">VITE_SUPABASE_ANON_KEY</code> to go live.
            {' '}Demo admin: <b>admin@nexora.store</b> / <b>Nexora@2026</b>
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('nexora.demoBanner', 'hidden')
            setDismissed(true)
          }}
          aria-label="Dismiss notice"
          className="shrink-0 rounded p-1 text-white/50 transition hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function WhatsAppFab() {
  const { settings } = useStore()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setExpanded(true), 3200)
    const h = window.setTimeout(() => setExpanded(false), 9500)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(h)
    }
  }, [])

  return (
    <a
      href={contactLink('whatsapp', settings.contact.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with NEXORA support on WhatsApp"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="group fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#0B1F16]/95 py-2.5 pl-2.5 pr-3 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)] backdrop-blur transition hover:border-emerald-400 hover:bg-emerald-600 sm:bottom-6 sm:right-6"
    >
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white">
        <MessageCircle className="h-4 w-4" aria-hidden />
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" aria-hidden />
      </span>
      <span
        className={
          expanded
            ? 'max-w-[150px] overflow-hidden whitespace-nowrap text-[12.5px] font-semibold text-emerald-300 transition-all duration-300 sm:max-w-[150px]'
            : 'max-w-0 overflow-hidden text-[12.5px] font-semibold text-emerald-300 transition-all duration-300 sm:max-w-0'
        }
      >
        Chat with us
      </span>
    </a>
  )
}
