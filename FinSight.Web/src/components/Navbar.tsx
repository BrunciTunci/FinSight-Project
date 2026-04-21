export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600/90 text-sm font-bold text-white">F</div>
          <div>
            <div className="text-sm font-semibold text-white">FinSight</div>
            <div className="text-xs text-gray-400">Personal finance & stocks</div>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-gray-900/60 px-3 py-1.5 ring-1 ring-white/10 hover:bg-gray-900"
        >
          <span className="text-xs text-gray-300">Bruno</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gray-800 text-xs font-semibold text-gray-200">B</span>
        </button>
      </div>
    </header>
  )
}
