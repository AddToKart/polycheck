import Link from 'next/link'

export const metadata = {
  title: 'Offline — Polycheck',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-100 px-6 text-center dark:bg-pup-black">
      <div className="max-w-md border border-zinc-200 bg-white p-8 shadow-sm dark:border-golden/15 dark:bg-surface-dark">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden">
          No connection
        </p>
        <h1 className="font-heading text-2xl font-bold text-maroon-dark dark:text-white">
          Polycheck is offline
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          This page isn’t available offline yet. If you already opened Polycheck on this device,
          go back and continue — attendance actions you take are saved locally and sync when the
          connection returns.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-maroon-dark dark:bg-golden dark:text-maroon-dark dark:hover:bg-golden/90"
        >
          Try again
        </Link>
      </div>
    </main>
  )
}
