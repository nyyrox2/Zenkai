import type { ReactNode } from 'react'
import { SpotlightCard } from './SpotlightCard'
import { Skeleton } from './Skeleton'

export function StatCard({
  icon,
  label,
  value,
  hint,
  loading = false,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint?: string
  loading?: boolean
}) {
  return (
    <SpotlightCard className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted">
        {icon}
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      )}
      {hint && !loading && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </SpotlightCard>
  )
}
