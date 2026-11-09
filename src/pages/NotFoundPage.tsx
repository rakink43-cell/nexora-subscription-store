import { Link } from 'react-router-dom'
import { Compass, Home, Search } from 'lucide-react'
import { ButtonLink } from '../components/ui'

export default function NotFoundPage() {
  return (
    <div className="nx-container grid min-h-[62vh] place-items-center py-16">
      <div className="max-w-md text-center">
        <p className="font-display text-[76px] font-extrabold leading-none text-white/10">404</p>
        <span className="mx-auto -mt-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#008CFF]/25 to-[#F00016]/10 text-[#6EC1FF]">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-white">This page took a wrong turn</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
          The link may be broken or the product may have moved. Try the catalogue — it has everything we
          sell, sorted and searchable.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink to="/products" icon={<Search className="h-4 w-4" />}>
            Browse products
          </ButtonLink>
          <ButtonLink to="/" variant="ghost" icon={<Home className="h-4 w-4" />}>
            Go home
          </ButtonLink>
        </div>
        <p className="mt-6 text-[12px] text-white/30">
          Need help finding something?{' '}
          <Link to="/contact" className="text-[#6EC1FF] hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  )
}
