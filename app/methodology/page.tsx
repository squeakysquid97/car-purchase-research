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
              My first car cost $500. It was a 1995 Honda Accord, and it barely worked. I remember once, I was having difficulty slowing down at stop signs, suggesting a potential issue with the brakes. So, I took the car to a local brake shop (as one does) and was confronted with a $500 estimate to replace the pads and turn the rotors. I didn't have $500, so I took it home and replaced the brakes myself (it took me all day). Since then, I have been interested in what makes a car worth the money, and how I could translate that into something others could use to make good decisions when purchasing a vehicle. 
              "Buyability" is a score that attempts to quantify how much value a car is for the money. It is calculated based on a variety of factors, including the car's durability, reliability, and repair costs. Use this score to guide you in your car buying journey, and I hope it can help make that journey a little less frought with peril.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              How the Score Is Calculated
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Each category is scored on a 1 to 10 scale, weighted by its share
              of the model, then combined and multiplied by 10 to produce a
              100-point score. The final result is then reduced by complaint and
              catastrophic penalties when issue volume, severity, or systemic
              failure patterns justify added risk.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Durability and Longevity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Measures how well the vehicle platform tends to hold up over
                  time. This category carries the most weight because long-term
                  durability is central to ownership risk.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Major Failure Risk
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Captures the likelihood of expensive, high-impact failures in
                  core systems such as the engine, transmission, or drivetrain.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Repair Frequency and Severity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Reflects how often owners report problems and how disruptive
                  those repairs tend to be when they occur.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Ownership Cost Profile
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Estimates the financial burden of keeping the vehicle on the
                  road, with attention to repair cost patterns and cost
                  exposure.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:col-span-2">
                <h3 className="text-xs font-medium text-white/90">
                  Safety and Recall Stability
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Reviews recall history and safety-related complaint behavior to
                  identify models with persistent safety instability.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Category Definitions
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              The model separates durability, failure risk, repair patterns,
              ownership cost, and recall stability so different types of risk
              are not treated as the same problem. Mechanical issues affect
              durability and cost, complaint clusters signal frequency, and
              recalls are evaluated as a distinct safety input.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Durability and Longevity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Weight: 40%. This score reflects how reliably the vehicle
                  platform ages, with emphasis on long-run mechanical
                  durability, service life, and whether major systems hold up at
                  higher mileage.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Major Failure Risk
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Weight: 25%. This category focuses on low-frequency but
                  high-cost failures, especially engine, transmission, and other
                  systemic breakdowns that materially change ownership risk.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Repair Frequency and Severity
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Weight: 15%. It captures how often issues appear in owner and
                  complaint data, then adjusts for how serious or operationally
                  disruptive those repairs tend to be.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <h3 className="text-xs font-medium text-white/90">
                  Ownership Cost Profile
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Weight: 10%. This category uses repair cost estimates and cost
                  concentration to measure whether a vehicle is likely to be
                  cheap to keep running or prone to expensive maintenance events.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:col-span-2">
                <h3 className="text-xs font-medium text-white/90">
                  Safety and Recall Stability
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Weight: 10%. Recall history and safety-related complaint
                  patterns are used here to identify recurring safety defects,
                  unstable recall performance, and unresolved risk signals.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Catastrophic Risk Adjustment
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              An extra penalty is applied when the data shows evidence of severe
              systemic failures that are not fully captured by the weighted
              category average alone. This adjustment is intended for
              catastrophic patterns such as widespread engine or transmission
              failures that can make an otherwise average score misleading.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              Data Sources and Limitations
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Scores are built from NHTSA complaints and recalls, aggregated
              owner-reported issues, and repair cost estimates. Coverage and
              reporting quality vary by model year, trim, mileage, and owner
              behavior, so the score should be read as a structured estimate of
              risk rather than a complete record of every problem. As I build this out, I will be adding more data sources and refining the methodology.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white/90">
              How to Use This Score
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Use the score to compare expected ownership risk across vehicles,
              not as a guarantee of how any single car will perform. Higher
              scores generally indicate stronger durability and lower downside
              risk, while lower scores suggest more caution and closer review of
              failure, complaint, and recall history.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
