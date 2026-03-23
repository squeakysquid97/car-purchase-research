"use client";

import Link from "next/link";

type CarErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CarErrorPage({ reset }: CarErrorPageProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
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

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h1 className="text-xl font-semibold text-white/90">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-white/70">
              We hit an unexpected issue while loading this report.
            </p>
            <div className="mt-4">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/15"
                onClick={reset}
              >
                Try again
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
