import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * Official NEXORA mark (uploads/image-1.png) with a wordmark fallback for
 * small sizes. The artwork is never redrawn or recoloured.
 */
export function Logo({
  size = 'md',
  withWordmark = true,
  to = '/',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  withWordmark?: boolean
  to?: string
  className?: string
}) {
  const dims = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  }[size]

  const text = {
    sm: 'text-[15px]',
    md: 'text-lg',
    lg: 'text-2xl',
  }[size]

  return (
    <Link
      to={to}
      aria-label="NEXORA — home"
      className={cn('group flex items-center gap-2.5', className)}
    >
      <span
        className={cn(
          'relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-white/10 transition group-hover:ring-[#008CFF]/50',
          dims,
        )}
      >
        <img
          src="/brand/nexora-logo.png"
          alt=""
          className="h-full w-full scale-[1.35] object-contain"
          loading="eager"
          decoding="async"
        />
      </span>
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-display font-extrabold tracking-[0.14em] text-white', text)}>
            NEXORA
          </span>
          {size !== 'sm' && (
            <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.22em] text-white/40">
              Premium Subscriptions
            </span>
          )}
        </span>
      )}
    </Link>
  )
}
