import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity, BookOpen, Droplets, LayoutDashboard, LifeBuoy, LineChart, LogOut, Moon,
  Radio, Sparkles, User, History, Lightbulb,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Logo } from './Logo'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/live', label: 'Live Session', icon: Radio },
  { to: '/sessions', label: 'Sessions', icon: History },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/strategies', label: 'Strategies', icon: Lightbulb },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/mood', label: 'Mood', icon: Sparkles },
  { to: '/water', label: 'Water', icon: Droplets },
  { to: '/habits', label: 'Habits', icon: Activity },
  { to: '/sleep', label: 'Sleep', icon: Moon },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="glass fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-line max-lg:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo size={36} />
          <div>
            <p className="font-serif text-lg font-semibold leading-none">EMORA</p>
            <p className="text-[10px] uppercase tracking-widest text-muted">wellness companion</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'aurora-bg font-semibold text-ink' : 'text-muted hover:bg-surface-2 hover:text-cream'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="mb-3 truncate text-xs text-muted">{user?.email}</div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-cream"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col max-lg:ml-0 lg:ml-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/80 px-6 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-serif text-lg font-semibold">EMORA</span>
          </div>
          <button onClick={onLogout} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="flex-1 px-6 py-6 max-lg:pb-24">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-ink/95 py-2 backdrop-blur lg:hidden">
          {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export { NavLink }
