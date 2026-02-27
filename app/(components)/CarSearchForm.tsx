"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
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

function matchOptionValue<T extends { value: string }>(
  input: string,
  options: T[]
) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  const match = options.find(
    (option) => option.value.trim().toLowerCase() === normalized
  );
  return match?.value ?? null;
}

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
      if (!res.ok) {
        throw new Error("Failed to load makes");
      }

      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load makes");
      }

      const rows = (json.data ?? []) as { name: string }[];
      const options: MakeOption[] = rows.map((row) => ({
        value: row.name,
        label: row.name,
      }));
      setMakes(options);
    } catch {
      // Keep any previously loaded options to avoid unnecessary UI churn.
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
      if (!res.ok) {
        throw new Error("Failed to load models");
      }

      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load models");
      }

      const rows = (json.data ?? []) as { name: string }[];
      const options: ModelOption[] = rows.map((row) => ({
        value: row.name,
        label: row.name,
      }));
      setModels(options);
    } catch {
      // Keep options currently shown for this selection flow when possible.
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
      if (!res.ok) {
        throw new Error("Failed to load years");
      }

      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load years");
      }

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
      const matchedMake = matchOptionValue(nextMake, makes);
      const resolvedMake = matchedMake ?? nextMake;

      setSelectedMake(resolvedMake);
      // Behavior: selecting Make clears Model + Year
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

      if (!matchedMake) {
        setIsModelsLoading(false);
        setIsYearsLoading(false);
        return;
      }

      setIsYearsLoading(false);
      await loadModels(matchedMake);
    },
    [loadModels, makes]
  );

  const handleModelChange = useCallback(
    async (value: string) => {
      const nextModel = value.trim();
      const matchedModel = matchOptionValue(nextModel, models);
      const resolvedModel = matchedModel ?? nextModel;

      setSelectedModel(resolvedModel);
      // Behavior: selecting Model clears Year
      setSelectedYear("");
      setYears([]);
      setYearsError(null);

      if (!nextModel || !selectedMake) {
        setIsYearsLoading(false);
        return;
      }

      if (!matchedModel) {
        setIsYearsLoading(false);
        return;
      }

      await loadYears(selectedMake, matchedModel);
    },
    [loadYears, models, selectedMake]
  );

  const handleYearChange = useCallback(
    (value: string) => {
      const nextYear = value.trim();
      const matchedYear = matchOptionValue(nextYear, years);
      setSelectedYear(matchedYear ?? nextYear);
    },
    [years]
  );

  const isValidMake = !!matchOptionValue(selectedMake, makes);
  const isValidModel = !!matchOptionValue(selectedModel, models);
  const isValidYear = !!matchOptionValue(selectedYear, years);
  const matchedSelectedMake = matchOptionValue(selectedMake, makes);
  const matchedSelectedModel = matchOptionValue(selectedModel, models);
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
      {/* Header */}
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

      {/* Main content */}
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
              {/* Make */}
              <div className="space-y-1.5">
                <label htmlFor="make" className="text-sm font-medium text-white/90">
                  Make
                </label>
                <input
                  id="make"
                  name="make"
                  list="make-options"
                  className={`block w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    isMakesLoading ? "animate-pulse" : ""
                  }`}
                  value={selectedMake}
                  onChange={(e) => void handleMakeChange(e.target.value)}
                  disabled={isMakesLoading}
                  placeholder={
                    isMakesLoading
                      ? "Loading makes..."
                      : makesError
                      ? "Couldn't load makes"
                      : "Type or select a make"
                  }
                  autoComplete="off"
                />
                <datalist id="make-options">
                  {!isMakesLoading &&
                    !makesError &&
                    makes.map((make) => (
                      <option key={make.value} value={make.value}>
                        {make.label}
                      </option>
                    ))}
                </datalist>
                {isMakesLoading && (
                  <p className="text-[11px] text-white/50">Loading...</p>
                )}
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

              {/* Model */}
              <div className="space-y-1.5">
                <label htmlFor="model" className="text-sm font-medium text-white/90">
                  Model
                </label>
                <input
                  id="model"
                  name="model"
                  list="model-options"
                  className={`block w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    isModelsLoading ? "animate-pulse" : ""
                  }`}
                  value={selectedModel}
                  onChange={(e) => void handleModelChange(e.target.value)}
                  disabled={isModelDisabled}
                  placeholder={
                    !isValidMake
                      ? "Type/select a valid make first"
                      : isModelsLoading
                      ? "Loading models..."
                      : modelsError
                      ? "Couldn't load models"
                      : "Type or select a model"
                  }
                  autoComplete="off"
                />
                <datalist id="model-options">
                  {isValidMake &&
                    !isModelsLoading &&
                    !modelsError &&
                    models.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                </datalist>
                {isModelsLoading && (
                  <p className="text-[11px] text-white/50">Loading...</p>
                )}
                {modelsError && !isModelsLoading && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-white/70">{modelsError}</p>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-white/90 underline underline-offset-2 disabled:opacity-50"
                      onClick={() => {
                        if (matchedSelectedMake) {
                          void loadModels(matchedSelectedMake);
                        }
                      }}
                      disabled={isModelsLoading || !matchedSelectedMake}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              {/* Year */}
              <div className="space-y-1.5">
                <label htmlFor="year" className="text-sm font-medium text-white/90">
                  Year
                </label>
                <input
                  id="year"
                  name="year"
                  list="year-options"
                  className={`block w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    isYearsLoading ? "animate-pulse" : ""
                  }`}
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  disabled={isYearDisabled}
                  placeholder={
                    !isValidModel
                      ? "Type/select a valid model first"
                      : isYearsLoading
                      ? "Loading years..."
                      : yearsError
                      ? "Couldn't load years"
                      : "Type or select a year"
                  }
                  autoComplete="off"
                />
                <datalist id="year-options">
                  {isValidModel &&
                    !isYearsLoading &&
                    !yearsError &&
                    years.map((year) => (
                      <option key={year.value} value={year.value}>
                        {year.label}
                      </option>
                    ))}
                </datalist>
                {isYearsLoading && (
                  <p className="text-[11px] text-white/50">Loading...</p>
                )}
                {yearsError && !isYearsLoading && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-white/70">{yearsError}</p>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-white/90 underline underline-offset-2 disabled:opacity-50"
                      onClick={() => {
                        if (matchedSelectedMake && matchedSelectedModel) {
                          void loadYears(matchedSelectedMake, matchedSelectedModel);
                        }
                      }}
                      disabled={
                        isYearsLoading ||
                        !matchedSelectedMake ||
                        !matchedSelectedModel
                      }
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-white/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-black/60"
                  disabled={!canSubmit}
                >
                  {isSubmitting || isAnyFieldLoading
                    ? "Loading..."
                    : "Get Buyability Report"}
                </button>
              </div>

              {/* Helper text + disclaimer */}
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
