import type { AttendanceStatus } from '@polycheck/shared'

const statusStyles: Record<AttendanceStatus, string> = {
  present: 'bg-golden text-maroon-dark',
  late: 'bg-maroon text-white',
  absent: 'bg-maroon-dark text-golden border border-golden',
  pending: 'bg-white text-maroon border border-maroon',
  disputed: 'bg-maroon-dark text-golden border border-golden',
}

export default function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-semibold ${statusStyles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
