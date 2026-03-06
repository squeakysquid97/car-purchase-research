"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type MakeOption = {
  value: string;
  label: string;
};

type ModelOption = {
  value: string;
  label: string;
};

type YearOption = {
  value: string;
  label: string;
};

export default function CarSearchForm() {
  const router = useRouter();

  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [makes, setMakes] = useState<MakeOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [years, setYears] = useState<YearOption[]>([]);

  const [isMakesLoading, setIsMakesLoading] = useState<boolean>(false);
  const [isModelsLoading, setIsModelsLoading] = useState<boolean>(false);
  const [isYearsLoading, setIsYearsLoading] = useState<boolean>(false);

  const [makesError, setMakesError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [yearsError, setYearsError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadMakes = useCallback(async () => {
    setIsMakesLoading(true);
    setMakesError(null);

    try {
      const res = await fetch("/api/makes");
      if (!res.ok) throw new Error("Failed to load makes");

      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Failed to load makes");

      const rows = (json.data ?? []) as { name: string }[];
      const options: MakeOption[] = rows.map((row) => ({
        value: row.name,
        label: row.name,
      }));
      setMakes(options);
    } catch {
      // Keep any already-loaded values where possible.
      setMakesError("We couldn't load makes right now.");
    } finally {
      setIsMakesLoading(false);
    }
  }, []);

  const loadModels = useCallback(async (make: string) => {
    setIsModelsLoading(true);
    setModelsError(null);

    try {
      const params = new URLSearchParams({ make });
      const res = await fetch(`/api/models?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load models");

      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Failed to load models");

      const rows = (json.data ?? []) as { name: string }[];
      const options: ModelOption[] = rows.map((row) => ({
        value: row.name,
        label: row.name,
      }));
      setModels(options);
    } catch {
      setModelsError("We couldn't load models right now.");
    } finally {
      setIsModelsLoading(false);
    }
  }, []);

  const loadYears = useCallback(async (make: string, model: string) => {
    setIsYearsLoading(true);
    setYearsError(null);

    try {
      const params = new URLSearchParams({ make, model });
      const res = await fetch(`/api/years?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load years");

      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Failed to load years");

      const rows = (json.data ?? []) as { year: number }[];
      const options: YearOption[] = rows.map((row) => ({
        value: String(row.year),
        label: String(row.year),
      }));
      setYears(options);
    } catch {
      setYearsError("We couldn't load years right now.");
    } finally {
      setIsYearsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMakes();
  }, [loadMakes]);

  const handleMakeChange = useCallback(
    async (value: string) => {
      const nextMake = value.trim();
      setSelectedMake(nextMake);

      // Selecting a make resets dependent picks.
      setSelectedModel("");
      setSelectedYear("");
      setModels([]);
      setYears([]);
      setModelsError(null);
      setYearsError(null);

      if (!nextMake) {
        setIsModelsLoading(false);
        setIsYearsLoading(false);
        return;
      }

      setIsYearsLoading(false);
      await loadModels(nextMake);
    },
    [loadModels]
  );

  const handleModelChange = useCallback(
    async (value: string) => {
      const nextModel = value.trim();
      setSelectedModel(nextModel);

      // Selecting a model resets year.
      setSelectedYear("");
      setYears([]);
      setYearsError(null);

      if (!nextModel || !selectedMake) {
        setIsYearsLoading(false);
        return;
      }

      await loadYears(selectedMake, nextModel);
    },
    [loadYears, selectedMake]
  );

  const handleYearChange = useCallback((value: string) => {
    setSelectedYear(value);
  }, []);

  const isValidMake = !!selectedMake;
  const isValidModel = !!selectedModel;
  const isValidYear = !!selectedYear;
  const isAnyFieldLoading = isMakesLoading || isModelsLoading || isYearsLoading;
  const isModelDisabled = !isValidMake || isModelsLoading;
  const isYearDisabled = !isValidModel || isModelsLoading || isYearsLoading;

  const canSubmit =
    isValidMake &&
    isValidModel &&
    isValidYear &&
    !isSubmitting &&
    !isMakesLoading &&
    !isModelsLoading &&
    !isYearsLoading;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;

      setIsSubmitting(true);

      const params = new URLSearchParams({
        make: selectedMake,
        model: selectedModel,
        year: selectedYear,
      });

      router.push(`/car?${params.toString()}`);
    },
    [canSubmit, router, selectedMake, selectedModel, selectedYear]
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-center py-8 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Image
            src="/cprlogo.webp"
            alt="Car Purchase Research logo"
            width={260}
            height={40}
            priority
          />
          <span className="hidden sm:inline-block text-sm uppercase tracking-[0.2em] text-white/60">
            Car Purchase Research
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl">
          <div className="bg-white/5 border border-white/10 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-md p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Get a buyability report
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Choose the exact vehicle you&apos;re considering and we&apos;ll
                analyze known issues, ownership costs, and long-term risks.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="make" className="text-sm font-medium text-white/90">
                  Make
                </label>
                <div className="relative">
                  <select
                    id="make"
                    name="make"
                    className={`block w-full appearance-none rounded-lg border border-white/15 bg-black/60 pl-3 pr-10 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      isMakesLoading ? "animate-pulse" : ""
                    }`}
                    value={selectedMake}
                    onChange={(e) => void handleMakeChange(e.target.value)}
                    disabled={isMakesLoading}
                  >
                    <option value="">
                      {isMakesLoading
                        ? "Loading makes..."
                        : makesError
                        ? "Couldn't load makes"
                        : "Select a make"}
                    </option>
                    {!isMakesLoading &&
                      !makesError &&
                      makes.map((make) => (
                        <option key={make.value} value={make.value}>
                          {make.label}
                        </option>
                      ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/75">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                {isMakesLoading && <p className="text-[11px] text-white/50">Loading...</p>}
                {makesError && !isMakesLoading && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-white/70">{makesError}</p>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-white/90 underline underline-offset-2 disabled:opacity-50"
                      onClick={() => void loadMakes()}
                      disabled={isMakesLoading}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="model" className="text-sm font-medium text-white/90">
                  Model
                </label>
                <div className="relative">
                  <select
                    id="model"
                    name="model"
                    className={`block w-full appearance-none rounded-lg border border-white/15 bg-black/60 pl-3 pr-10 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      isModelsLoading ? "animate-pulse" : ""
                    }`}
                    value={selectedModel}
                    onChange={(e) => void handleModelChange(e.target.value)}
                    disabled={isModelDisabled}
                  >
                    <option value="">
                      {!isValidMake
                        ? "Select a make first"
                        : isModelsLoading
                        ? "Loading models..."
                        : modelsError
                        ? "Couldn't load models"
                        : "Select a model"}
                    </option>
                    {isValidMake &&
                      !isModelsLoading &&
                      !modelsError &&
                      models.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/75">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                {isModelsLoading && <p className="text-[11px] text-white/50">Loading...</p>}
                {modelsError && !isModelsLoading && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-white/70">{modelsError}</p>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-white/90 underline underline-offset-2 disabled:opacity-50"
                      onClick={() => {
                        if (selectedMake) void loadModels(selectedMake);
                      }}
                      disabled={isModelsLoading || !selectedMake}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="year" className="text-sm font-medium text-white/90">
                  Year
                </label>
                <div className="relative">
                  <select
                    id="year"
                    name="year"
                    className={`block w-full appearance-none rounded-lg border border-white/15 bg-black/60 pl-3 pr-10 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      isYearsLoading ? "animate-pulse" : ""
                    }`}
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    disabled={isYearDisabled}
                  >
                    <option value="">
                      {!isValidModel
                        ? "Select a model first"
                        : isYearsLoading
                        ? "Loading years..."
                        : yearsError
                        ? "Couldn't load years"
                        : "Select a year"}
                    </option>
                    {isValidModel &&
                      !isYearsLoading &&
                      !yearsError &&
                      years.map((year) => (
                        <option key={year.value} value={year.value}>
                          {year.label}
                        </option>
                      ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/75">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                {isYearsLoading && <p className="text-[11px] text-white/50">Loading...</p>}
                {yearsError && !isYearsLoading && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-white/70">{yearsError}</p>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-white/90 underline underline-offset-2 disabled:opacity-50"
                      onClick={() => {
                        if (selectedMake && selectedModel) {
                          void loadYears(selectedMake, selectedModel);
                        }
                      }}
                      disabled={isYearsLoading || !selectedMake || !selectedModel}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-white/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-black/60"
                  disabled={!canSubmit}
                >
                  {isSubmitting || isAnyFieldLoading ? "Loading..." : "Get Buyability Report"}
                </button>
              </div>

              <p className="pt-1 text-[11px] leading-relaxed text-white/60">
                This tool summarizes patterns from historical repair data,
                recalls, and ownership reports. It is not a substitute for a
                professional inspection or your own judgment.{" "}
                <a
                  href="/disclaimer"
                  className="underline underline-offset-2 hover:text-white"
                >
                  Read the full disclaimer
                </a>
                .
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
