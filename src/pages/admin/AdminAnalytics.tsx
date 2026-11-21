import { useEffect, useState } from 'react'
import { Activity, Eye, UserRound, UserPlus } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, StatTile } from '../../components/admin/AdminUI'
import { ErrorNote, Skeleton } from '../../components/ui'

type AnalyticsData = {
  page_views: number
  visitors: number
  signups: number
  daily: { day: string; views: number; signups: number }[]
  pages: { path: string; count: number }[]
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.admin.analytics().then((result: AnalyticsData) => {
      if (active) setData(result)
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Could not load analytics.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const max = Math.max(1, ...(data?.daily ?? []).map((item) => item.views))
  const maxSignups = Math.max(1, ...(data?.daily ?? []).map((item) => item.signups))
  return (
    <div>
      <AdminHeader title="Analytics" description="Privacy-conscious traffic and signup overview for the last 30 days." />
      {error && <ErrorNote message={error} className="mb-4" />}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Page views" value={String(data?.page_views ?? 0)} icon={<Eye className="h-4 w-4" />} hint="Last 30 days" loading={loading} />
        <StatTile label="Tracked visitors" value={String(data?.visitors ?? 0)} icon={<UserRound className="h-4 w-4" />} hint="Unique browser sessions" loading={loading} />
        <StatTile label="Account signups" value={String(data?.signups ?? 0)} icon={<UserPlus className="h-4 w-4" />} hint="Tracked registrations" loading={loading} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <AdminCard title="Daily traffic" description="Page views over the last 14 days">
          {loading ? <Skeleton className="h-40 w-full" /> : data?.daily.length ? (
            <div className="flex h-40 items-end gap-1.5">
              {data.daily.map((day) => (
                <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-[9px] text-white/35">{day.views || ''}</span>
                  <div className="w-full rounded-t bg-gradient-to-t from-[#0067C5]/40 to-[#38A8FF]" style={{ height: `${Math.max(3, day.views / max * 100)}%` }} />
                  <span className="mt-1 text-[8px] text-white/30">{new Date(day.day).toLocaleDateString('en-GB', { day: '2-digit' })}</span>
                </div>
              ))}
            </div>
          ) : <p className="py-10 text-center text-[12px] text-white/40">No traffic data recorded yet. Views will appear as visitors browse the live site.</p>}
        </AdminCard>
        <AdminCard title="Top pages" description="Most viewed paths in the last 30 days">
          {loading ? <Skeleton className="h-32 w-full" /> : data?.pages.length ? (
            <div className="space-y-3">
              {data.pages.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[11px] text-white/65">{page.path}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-white">{page.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : <p className="py-8 text-center text-[12px] text-white/40">No page data yet.</p>}
        </AdminCard>
      </div>
      <div className="mt-4">
        <AdminCard title="Daily account signups" description="New customer accounts created over the last 14 days">
          {loading ? <Skeleton className="h-32 w-full" /> : data?.daily.length ? (
            <div className="flex h-32 items-end gap-1.5">
              {data.daily.map((day) => (
                <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-[9px] text-white/35">{day.signups || ''}</span>
                  <div className="w-full rounded-t bg-gradient-to-t from-violet-500/40 to-violet-300" style={{ height: `${Math.max(3, day.signups / maxSignups * 100)}%` }} />
                  <span className="mt-1 text-[8px] text-white/30">{new Date(day.day).toLocaleDateString('en-GB', { day: '2-digit' })}</span>
                </div>
              ))}
            </div>
          ) : <p className="py-8 text-center text-[12px] text-white/40">No signup data yet.</p>}
        </AdminCard>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-white/30"><Activity className="h-3 w-3" /> Visitor counts use a temporary browser-session ID. No names, emails or IP addresses are stored in analytics.</p>
    </div>
  )
}
