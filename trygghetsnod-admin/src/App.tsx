import { Outlet, NavLink } from 'react-router-dom'
import { Activity, FileText, Globe, Info, Library, MapPin, MessageSquare, Newspaper, QrCode, ScrollText, ExternalLink } from 'lucide-react'
import { cn } from './lib/utils'

const nav = [
  { to: '/', label: 'Översikt', icon: Activity, end: true },
  { to: '/lagesuppdatering', label: 'Lägesuppdatering', icon: FileText },
  { to: '/artiklar', label: 'Artiklar', icon: Newspaper },
  { to: '/forum', label: 'Forum', icon: MessageSquare },
  { to: '/kartmarkorer', label: 'Kartmarkörer', icon: MapPin },
  { to: '/kallor', label: 'Källor', icon: Globe },
  { to: '/innehall', label: 'Innehåll', icon: Library },
  { to: '/loggbok', label: 'Loggbok', icon: ScrollText },
  { to: '/qr', label: 'QR-kod', icon: QrCode },
  { to: '/om', label: 'Om enheten', icon: Info },
]

export function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-paper-rule bg-paper">
        <div className="container-app flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <div className="font-sans text-[15px] font-medium leading-none">Trygghetsnod</div>
              <div className="kicker mt-0.5">Administration</div>
            </div>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            title="Öppna medborgarportalen i ny flik"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Medborgarportalen
          </a>
        </div>
      </header>

      <div className="container-app grid gap-8 py-8 md:grid-cols-[220px_1fr]">
        <nav className="md:sticky md:top-8 md:self-start">
          <ul className="space-y-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 border-l-2 px-3 py-2 font-sans text-sm transition-colors',
                      isActive
                        ? 'border-myndig bg-myndig-tint text-myndig no-underline'
                        : 'border-transparent text-ink-soft no-underline hover:border-paper-rule hover:bg-paper-warm/40'
                    )
                  }
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Trygghetsnod"
    >
      <rect x="2" y="9" width="18" height="11" stroke="#1E3A5F" strokeWidth="1.4" fill="#EDF1F6" />
      <path d="M2 9L11 2L20 9" stroke="#1E3A5F" strokeWidth="1.4" fill="#EDF1F6" strokeLinejoin="round" />
      <rect x="9" y="13" width="4" height="7" stroke="#1E3A5F" strokeWidth="1.4" fill="#FDFDFC" />
    </svg>
  )
}
