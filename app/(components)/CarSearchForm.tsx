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

   useEffect(() => {
     setIsMakesLoading(true);
     setMakesError(null);
 
    const loadMakes = async () => {
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
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to load makes.";
        setMakesError(message);
        setMakes([]);
      } finally {
        setIsMakesLoading(false);
      }
    };
 
     void loadMakes();
   }, []);

   const handleMakeChange = useCallback(async (value: string) => {
     setSelectedMake(value);
     // Behavior: selecting Make clears Model + Year
     setSelectedModel("");
     setSelectedYear("");
     setModels([]);
     setYears([]);
     setModelsError(null);
     setYearsError(null);
 
     if (!value) {
       setIsModelsLoading(false);
       setIsYearsLoading(false);
       return;
     }
 
     setIsModelsLoading(true);
     setIsYearsLoading(false);
 
    try {
      const params = new URLSearchParams({ make: value });
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
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load models.";
      setModelsError(message);
      setModels([]);
    } finally {
      setIsModelsLoading(false);
    }
   }, []);
 
   const handleModelChange = useCallback(
     async (value: string) => {
       setSelectedModel(value);
       // Behavior: selecting Model clears Year
       setSelectedYear("");
       setYears([]);
       setYearsError(null);
 
       if (!value || !selectedMake) {
         setIsYearsLoading(false);
         return;
       }
 
       setIsYearsLoading(true);
 
      try {
        const params = new URLSearchParams({
          make: selectedMake,
          model: value,
        });
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
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to load years.";
        setYearsError(message);
        setYears([]);
      } finally {
        setIsYearsLoading(false);
      }
     },
     [selectedMake]
   );

   const handleYearChange = useCallback((value: string) => {
     setSelectedYear(value);
   }, []);

   const canSubmit =
     !!selectedMake &&
     !!selectedModel &&
     !!selectedYear &&
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
             className="dark:invert"
             src="/cprlogo.svg"
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
                 <label
                   htmlFor="make"
                   className="text-sm font-medium text-white/90"
                 >
                   Make
                 </label>
                 <div className="relative">
                   <select
                     id="make"
                     name="make"
                     className="block w-full appearance-none rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                     value={selectedMake}
                     onChange={(e) => handleMakeChange(e.target.value)}
                     disabled={isMakesLoading}
                   >
                     <option value="">
                       {isMakesLoading
                         ? "Loading makes..."
                         : makesError
                         ? "Failed to load makes"
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
                   <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/50">
                     <span className="text-xs">▼</span>
                   </div>
                 </div>
               </div>

               {/* Model */}
               <div className="space-y-1.5">
                 <label
                   htmlFor="model"
                   className="text-sm font-medium text-white/90"
                 >
                   Model
                 </label>
                 <div className="relative">
                   <select
                     id="model"
                     name="model"
                     className="block w-full appearance-none rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                     value={selectedModel}
                     onChange={(e) => handleModelChange(e.target.value)}
                     disabled={!selectedMake || isModelsLoading}
                   >
                     <option value="">
                       {!selectedMake
                         ? "Select a make first"
                         : isModelsLoading
                         ? "Loading models..."
                         : modelsError
                         ? "Failed to load models"
                         : "Select a model"}
                     </option>
                     {selectedMake &&
                       !isModelsLoading &&
                       !modelsError &&
                       models.map((model) => (
                         <option key={model.value} value={model.value}>
                           {model.label}
                         </option>
                       ))}
                   </select>
                   <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/50">
                     <span className="text-xs">▼</span>
                   </div>
                 </div>
               </div>

               {/* Year */}
               <div className="space-y-1.5">
                 <label
                   htmlFor="year"
                   className="text-sm font-medium text-white/90"
                 >
                   Year
                 </label>
                 <div className="relative">
                   <select
                     id="year"
                     name="year"
                     className="block w-full appearance-none rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white shadow-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                     value={selectedYear}
                     onChange={(e) => handleYearChange(e.target.value)}
                     disabled={!selectedModel || isYearsLoading}
                   >
                     <option value="">
                       {!selectedModel
                         ? "Select a model first"
                         : isYearsLoading
                         ? "Loading years..."
                         : yearsError
                         ? "Failed to load years"
                         : "Select a year"}
                     </option>
                     {selectedModel &&
                       !isYearsLoading &&
                       !yearsError &&
                       years.map((year) => (
                         <option key={year.value} value={year.value}>
                           {year.label}
                         </option>
                       ))}
                   </select>
                   <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/50">
                     <span className="text-xs">▼</span>
                   </div>
                 </div>
               </div>

              {/* CTA */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-white/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-black/60"
                  disabled={!canSubmit}
                >
                  {isSubmitting ? "Loading results..." : "Get Buyability Report"}
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

