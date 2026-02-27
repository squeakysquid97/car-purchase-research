"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

function formatCountdown(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export default function LandingPage() {
  const targetDate = useMemo(() => new Date("2026-03-27T00:00:00"), []);
  const [timeLeft, setTimeLeft] = useState<number>(targetDate.getTime() - Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeLeft(targetDate.getTime() - Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="min-h-screen bg-black text-white grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-0 row-start-2 items-center sm:items-center">
        <Image
          className=""
          src="/cprlogo.png"
          alt="CPR logo"
          width={1000}
          height={100}
          priority
        />
        <div className="text-4xl font-bold">
          <h1>Launching in:</h1>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-wide">
          {timeLeft > 0 ? formatCountdown(timeLeft) : "Launched"}
        </p>
        <p className="mt-1 text-xs text-white/60">March 27, 2026</p>
      </main>
    </div>
  );
}

