import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Car Purchase Research
          </p>
          <Link
            href="/"
            className="text-xs font-medium text-white/70 underline underline-offset-4 hover:text-white"
          >
            Back to search
          </Link>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Disclaimer
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Car Purchase Research provides informational summaries to support
              your vehicle research. The content is intended to help you ask
              better questions, not to replace professional evaluation.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              No Mechanical or Financial Advice
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Nothing on this site should be treated as mechanical, legal, or
              financial advice. Decisions about purchasing, financing, or
              repairing a vehicle remain your responsibility.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              No Guarantees of Reliability or Future Performance
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Reliability scores and risk indicators reflect historical patterns
              and model-level trends. They do not guarantee how any individual
              vehicle will perform in the future.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Data Limitations
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Data can be incomplete, delayed, or influenced by factors such as
              maintenance history, climate, driving style, and configuration
              differences. Use this information as one input, not the only one.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Always Get a Pre-Purchase Inspection
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Before buying any used car, have it inspected by a qualified
              mechanic and review service records. A hands-on inspection is the
              best way to evaluate the condition of a specific vehicle.
            </p>
          </section>

          <footer className="pb-2 text-[11px] leading-relaxed text-white/55">
            Informational only. Use this report alongside professional
            inspection and your own judgment.
          </footer>
        </div>
      </main>
    </div>
  );
}
