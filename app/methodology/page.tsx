import Link from "next/link";

export default function MethodologyPage() {
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
              Scoring Methodology
            </h1>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              What Buyability Means
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              posuere sem et odio volutpat, in tincidunt purus euismod.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              How the Score Is Calculated
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
              tristique, ipsum vitae condimentum tincidunt, mauris risus
              pulvinar massa, quis interdum justo est sit amet nibh.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Durability and Longevity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Major Failure Risk
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Repair Frequency and Severity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Ownership Cost Profile
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:col-span-2">
                <h3 className="text-xs font-medium text-white/90">
                  Safety and Recall Stability
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Category Definitions
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras
              suscipit lorem nec justo commodo, ac feugiat purus tincidunt.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Durability and Longevity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Major Failure Risk
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Repair Frequency and Severity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Ownership Cost Profile
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:col-span-2">
                <h3 className="text-xs font-medium text-white/90">
                  Safety and Recall Stability
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Catastrophic Risk Adjustment
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eu
              interdum metus, quis volutpat ex.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Data Sources and Limitations
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec
              dictum justo in leo volutpat, non cursus lacus vulputate.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              How to Use This Score
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus
              semper, mauris at facilisis pharetra, nibh lacus aliquet ligula.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
