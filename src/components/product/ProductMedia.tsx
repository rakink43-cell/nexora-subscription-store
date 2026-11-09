import { cn, brandGradient } from '../../lib/utils'

/**
 * Product imagery.
 * - Uses the admin-uploaded `image_url` when present.
 * - Otherwise renders a premium generated tile (brand monogram + gradient) so
 *   the catalogue looks intentional before photography exists.
 */
export function ProductMedia({
  name,
  brand,
  imageUrl,
  className,
  size = 'md',
  rounded = 'rounded-xl',
}: {
  name: string
  brand?: string | null
  imageUrl?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
  rounded?: string
}) {
  const monogram = getMonogram(name, brand)

  if (imageUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-[#0A0F1A]', rounded, className)}>
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  const text = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  }[size]

  return (
    <div
      className={cn(
        'relative isolate flex items-center justify-center overflow-hidden bg-gradient-to-br',
        brandGradient(name),
        rounded,
        className,
      )}
      role="img"
      aria-label={name}
    >
      {/* subtle grid + light bloom */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, #000 20%, transparent 75%)',
        }}
        aria-hidden
      />
      <div
        className="absolute -top-1/3 left-1/2 h-[160%] w-[70%] -translate-x-1/2 rounded-full bg-white/15 blur-3xl"
        aria-hidden
      />
      <span
        className={cn(
          'relative font-display font-extrabold tracking-tight text-white/95 drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]',
          text,
        )}
      >
        {monogram}
      </span>
      {brand && (
        <span className="absolute bottom-1.5 left-0 right-0 truncate px-2 text-center text-[8.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          {brand}
        </span>
      )}
    </div>
  )
}

function getMonogram(name: string, brand?: string | null): string {
  const source = (brand || name).trim()
  // Prefer a compact brand token: "Prime Video" → "PV", "Disney+" → "D+", "ChatGPT Plus" → "GPT"
  const known: Record<string, string> = {
    Netflix: 'N',
    'Prime Video': 'PV',
    'Disney+': 'D+',
    Hoichoi: 'H',
    ZEE5: 'Z5',
    Chorki: 'C',
    OpenAI: 'GPT',
    Anthropic: 'C',
    Google: 'G',
    Perplexity: 'P',
    Midjourney: 'MJ',
    ElevenLabs: 'XI',
    Coursera: 'C',
    Udemy: 'U',
    Skillshare: 'S',
    Duolingo: 'D',
    LinkedIn: 'in',
    Microsoft: 'MS',
    Canva: 'C',
    Adobe: 'Ae',
    Notion: 'N',
    Grammarly: 'G',
    Spotify: 'S',
    YouTube: 'YT',
    PlayStation: 'PS',
    Xbox: 'X',
    Figma: 'F',
    Envato: 'E',
    Freepik: 'F',
    NEXORA: 'NX',
  }
  if (brand && known[brand]) return known[brand]
  const words = source.replace(/[^A-Za-z0-9+ ]/g, '').split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
