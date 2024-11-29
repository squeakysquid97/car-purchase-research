import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-center">
        <Image
          className="dark:invert"
          src="/cprlogo.svg"
          alt="CPR logo"
          width={200}
          height={38}
          priority
        />
        <div className=" ">
          <h1> Coming Soon! </h1>
        </div>
      </main>
    </div>
  );
}
