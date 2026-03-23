export default function CarLoadingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-72 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="h-3 w-36 rounded bg-white/10 animate-pulse" />
            <div className="mt-4 h-11 w-44 rounded bg-white/10 animate-pulse" />
            <div className="mt-4 h-2 w-full rounded-full bg-white/10 animate-pulse" />
            <div className="mt-3 h-3 w-52 rounded bg-white/10 animate-pulse" />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-3">
              <div className="h-3 w-36 rounded bg-white/10 animate-pulse" />
              <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
              <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
              <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-3">
              <div className="h-3 w-40 rounded bg-white/10 animate-pulse" />
              <div className="h-20 rounded-xl bg-white/10 animate-pulse" />
              <div className="h-20 rounded-xl bg-white/10 animate-pulse" />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
