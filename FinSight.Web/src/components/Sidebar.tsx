import type { ReactNode } from 'react'
import { CandlestickChart, LayoutDashboard, Receipt } from 'lucide-react'

export type TabKey = 'dashboard' | 'transactions' | 'stocks'

export default function Sidebar({
  activeTab,
  onChange,
}: {
  activeTab: TabKey
  onChange: (tab: TabKey) => void
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/40 p-4 backdrop-blur lg:block">
      <div className="flex items-center px-2 py-3">
        <div className="text-xl font-bold text-white tracking-wide">FinSight</div>
      </div>

      <nav className="mt-4 space-y-1">
        <NavItem
          active={activeTab === 'dashboard'}
          icon={<LayoutDashboard className="h-4 w-4" />}
          onClick={() => onChange('dashboard')}
        >
          Dashboard
        </NavItem>
        <NavItem
          active={activeTab === 'transactions'}
          icon={<Receipt className="h-4 w-4" />}
          onClick={() => onChange('transactions')}
        >
          Transactions
        </NavItem>
        <NavItem
          active={activeTab === 'stocks'}
          icon={<CandlestickChart className="h-4 w-4" />}
          onClick={() => onChange('stocks')}
        >
          Stocks
        </NavItem>
      </nav>

    </aside>
  )
}

function NavItem({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean
  icon: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
        active
          ? 'bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/30'
          : 'text-gray-200 hover:bg-white/5'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${active ? 'bg-indigo-600/20' : 'bg-gray-900/40'} text-gray-200`}>
          {icon}
        </span>
        <span>{children}</span>
      </span>
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-indigo-400' : 'bg-transparent'}`} />
    </button>
  )
}
