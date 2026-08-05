import Link from 'next/link'
import type { Section } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StudentSubjectsGridProps {
  sections: Section[]
  subjectMap: Map<string, { name: string; code: string }>
}

export function StudentSubjectsGrid({ sections, subjectMap }: StudentSubjectsGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {sections.map((section) => {
        const subject = subjectMap.get(section.subjectId)
        return (
          <Link key={section.id} href={`/student/subjects/${section.id}`} className="block group">
            <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer flex flex-col h-full">
              <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">{subject?.code}</span><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sec {section.section}</span></div>
                <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors line-clamp-2 leading-tight">{subject?.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 flex-1 flex flex-col">
                <div className="space-y-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 flex-1 uppercase tracking-wider">
                  <div className="flex justify-between border-b border-zinc-300 dark:border-zinc-800 pb-2"><span className="text-zinc-400">Instructor</span><span className="text-foreground text-right">{section.teacherName}</span></div>
                  <div className="flex justify-between border-b border-zinc-300 dark:border-zinc-800 pb-2"><span className="text-zinc-400">Room</span><span className="text-foreground text-right">{section.room}</span></div>
                  <div className="flex justify-between border-b border-zinc-300 dark:border-zinc-800 pb-2"><span className="text-zinc-400">Schedule</span><span className="text-foreground text-right">{section.schedule.map((slot) => `${slot.day} ${slot.startTime}-${slot.endTime}`).join(', ')}</span></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
      {sections.length === 0 ? (
        <div className="col-span-full border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20">
          <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO ENROLLMENTS</p>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Contact your instructor for the subject enrollment code.</p>
        </div>
      ) : null}
    </div>
  )
}
