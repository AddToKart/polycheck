import type { AttendanceStatus } from '@polycheck/shared'

const statusStyles: Record<AttendanceStatus, string> = {
  present: 'bg-golden text-maroon-dark',
  late: 'bg-maroon text-white',
  absent: 'bg-maroon-dark text-golden border border-golden',
  pending: 'bg-white text-maroon border border-maroon',
  disputed: 'bg-maroon-dark text-golden border border-golden',
  excused: 'bg-maroon text-golden border border-golden',
  incomplete: 'bg-white text-maroon-dark border border-dashed border-maroon dark:bg-transparent dark:text-golden dark:border-golden',
}

export default function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-semibold ${statusStyles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
