import type { ExcuseStatus } from '@polycheck/shared'

const statusStyles: Record<ExcuseStatus, string> = {
  requested: 'bg-white text-maroon border border-maroon dark:bg-surface-dark dark:text-golden dark:border-golden',
  approved: 'bg-golden text-maroon-dark',
  rejected: 'bg-maroon-dark text-golden border border-golden',
}

const statusLabels: Record<ExcuseStatus, string> = {
  requested: 'Excuse requested',
  approved: 'Excuse approved',
  rejected: 'Excuse rejected',
}

/** Row-level chip for the excuse sub-state on an attendance record (EXC5). */
export default function ExcuseStatusBadge({ status }: { status: ExcuseStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}
