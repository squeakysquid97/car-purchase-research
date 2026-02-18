import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-0 row-start-2 items-center sm:items-center">
        <Image
          className="dark:invert"
          src="/cprlogo.svg"
          alt="CPR logo"
          width={1000}
          height={100}
          priority
        />
        <div className="text-4xl font-bold">
          <h1> Coming Soon! </h1>
        </div>
      </main>
    </div>
  );
}
