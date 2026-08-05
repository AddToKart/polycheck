const noticeVersion = process.env.NEXT_PUBLIC_PRIVACY_NOTICE_VERSION ?? '2026-08-04'

export default function PrivacyNoticePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 text-foreground">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon">Polycheck privacy notice</p>
      <h1 className="mt-3 font-serif text-4xl font-bold">Attendance evidence and your privacy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Version {noticeVersion}</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="text-lg font-bold text-foreground">Information collected</h2>
          <p className="mt-2">
            When you check in, Polycheck records your account, class session, timestamp, location coordinates,
            location accuracy and mock-location signal, an opaque installation identifier, QR input channel, and
            validation outcome. Proof-of-class photographs are stored only when an authorized person uploads them.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">Purpose and access</h2>
          <p className="mt-2">
            This information verifies attendance, prevents duplicate or fraudulent check-ins, resolves disputes, and
            supports authorized institutional reporting. Students can access their own records; teachers are limited
            to their classes; administrators are limited by their institutional or department scope.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">Retention and protection</h2>
          <p className="mt-2">
            Data is retained according to the institution’s approved records schedule. Denied, unlinked scan evidence
            is automatically removed after the configured short-term investigation period, while audit and academic
            attendance records use the institution’s longer retention schedule. Mobile offline data is encrypted and
            account-partitioned; production traffic must use HTTPS.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">Your choices</h2>
          <p className="mt-2">
            Polycheck will not submit location evidence until the current notice is accepted. You may decline, but QR
            attendance check-in will remain unavailable. Contact your institution’s Polycheck administrator or data
            protection office to request access, correction, or handling of your personal information.
          </p>
        </section>
      </div>
    </main>
  )
}
