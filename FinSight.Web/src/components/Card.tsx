import type { ReactNode } from 'react'

export default function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-gray-800/80 shadow-lg ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-wide text-gray-100">{title}</h2>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
