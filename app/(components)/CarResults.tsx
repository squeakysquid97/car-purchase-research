 "use client";

 import { useEffect, useState } from "react";
 import Link from "next/link";

 type Severity = "low" | "medium" | "high" | "catastrophic";

 type CategoryBreakdownItem = {
   category: string | null;
   weight_decimal: number | null;
   raw_score: number | null;
   weighted_points: number | null;
   notes: string | null;
 };

 type RepairItem = {
   id: number | string;
   issue_name: string;
   severity: Severity | null;
   typical_mileage: number | null;
   cost_min: number | null;
   cost_max: number | null;
   failure_rate_estimate: number | null;
   is_systemic: boolean;
   description: string | null;
 };

 type WhyEntry = {
   category: string | null;
   weighted_points: number | null;
   notes: string | null;
 };

 type CarData = {
   vehicle_year_id: number;
   make: string | null;
   model: string | null;
   year: number;
   generation: string | null;
   ownership_cost_category: string | null;
   summary_text: string | null;
   base_score: number | null;
   catastrophic_penalty: number | null;
   final_score: number | null;
   score_label: string | null;
   calculated_at: string | null;
   category_breakdown: CategoryBreakdownItem[];
   repairs: RepairItem[];
   why: {
     strongest: WhyEntry[];
     weakest: WhyEntry[];
   };
 };

 type ApiResponse =
   | { ok: false; error: string }
   | { ok: true; data: CarData };

 interface CarResultsProps {
   make: string;
   model: string;
   year: string;
 }

 function formatSeverity(severity: Severity | null) {
   if (!severity) return "Unknown";
   return severity.charAt(0).toUpperCase() + severity.slice(1);
 }

 function formatMoney(value: number | null) {
   if (value == null) return "n/a";
   return `$${value.toLocaleString()}`;
 }

 function formatPercent(value: number | null) {
   if (value == null) return "n/a";
   return `${(value * 100).toFixed(1)}%`;
 }

 function getBuyabilityTheme(scoreLabel: string | null) {
   switch (scoreLabel?.toLowerCase()) {
     case "avoid":
       return {
         panel:
           "border-red-500/40 from-red-500/20 via-red-500/10 to-transparent",
         badge: "bg-red-500/20 text-red-100",
       };
     case "long-term keeper":
       return {
         panel:
           "border-emerald-500/40 from-emerald-500/20 via-emerald-500/10 to-transparent",
         badge: "bg-emerald-500/20 text-emerald-100",
       };
     case "reliable buy":
       return {
         panel:
           "border-sky-500/40 from-sky-500/20 via-sky-500/10 to-transparent",
         badge: "bg-sky-500/20 text-sky-100",
       };
     case "high risk":
       return {
         panel:
           "border-yellow-500/40 from-yellow-500/20 via-yellow-500/10 to-transparent",
         badge: "bg-yellow-500/20 text-yellow-100",
       };
     case "caution":
       return {
         panel:
           "border-orange-500/40 from-orange-500/20 via-orange-500/10 to-transparent",
         badge: "bg-orange-500/20 text-orange-100",
       };
     default:
       return {
         panel: "border-white/10 from-white/10 via-white/5 to-transparent",
         badge: "bg-white/10 text-white/90",
       };
   }
 }

 export default function CarResults({ make, model, year }: CarResultsProps) {
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [data, setData] = useState<CarData | null>(null);

   useEffect(() => {
     if (!make || !model || !year) {
       setError("Missing make, model, or year.");
       setData(null);
       return;
     }

     setLoading(true);
     setError(null);
     setData(null);

     const controller = new AbortController();

     const load = async () => {
       try {
         const params = new URLSearchParams({ make, model, year });
         const res = await fetch(`/api/car?${params.toString()}`, {
           signal: controller.signal,
         });
        const json = (await res.json()) as ApiResponse;

         if (!res.ok || !json.ok) {
           const message =
             (!json.ok && json.error) ||
             "Sorry, we could not load this vehicle.";
           setError(message);
           setData(null);
           return;
         }

        setData(json.data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Network error while loading this vehicle.");
        setData(null);
      } finally {
         setLoading(false);
       }
     };

     void load();

     return () => controller.abort();
   }, [make, model, year]);

   const titleMake = make || data?.make || "Vehicle";
   const titleModel = model || data?.model || "";
   const titleYear = year || (data?.year ? String(data.year) : "");
   const buyabilityTheme = getBuyabilityTheme(data?.score_label ?? null);

   return (
     <div className="min-h-screen bg-black text-white flex flex-col">
       <header className="border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
         <div className="flex flex-col gap-1">
           <p className="text-xs uppercase tracking-[0.2em] text-white/50">
             Car Purchase Research
           </p>
           <p className="text-sm text-white/80">
             Buyability report for{" "}
             <span className="font-semibold">
               {titleYear} {titleMake} {titleModel}
             </span>
           </p>
         </div>
         <Link
           href="/"
           className="text-xs font-medium text-white/70 hover:text-white underline underline-offset-4"
         >
           New search
         </Link>
       </header>

       <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
         <div className="mx-auto max-w-5xl space-y-8">
           {/* Loading / error */}
           {loading && (
             <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
               Loading buyability report…
             </div>
           )}
           {!loading && error && (
             <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
               {error}
             </div>
           )}

           {/* Nothing yet */}
           {!loading && !error && !data && (
             <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
               Enter a vehicle on the home page to generate a report.
             </div>
           )}

           {data && (
             <>
               {/* Score + label hero */}
               <section
                 className={`rounded-2xl border bg-gradient-to-br p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 ${buyabilityTheme.panel}`}
               >
                 <div>
                   <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                     Overall buyability
                   </p>
                   <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight flex items-baseline gap-3">
                     {data.final_score != null ? (
                       <>
                         <span>{data.final_score.toFixed(1)}</span>
                         <span className="text-base font-normal text-white/60">
                           / 10
                         </span>
                       </>
                     ) : (
                       <span className="text-2xl">No score available</span>
                     )}
                   </h1>
                   {data.score_label && (
                     <p
                       className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${buyabilityTheme.badge}`}
                     >
                       {data.score_label}
                     </p>
                   )}
                   {data.summary_text && (
                     <p className="mt-4 text-sm text-white/80 max-w-xl">
                       {data.summary_text}
                     </p>
                   )}
                 </div>
                 <div className="flex flex-col items-start sm:items-end gap-2 text-xs text-white/70">
                   {data.ownership_cost_category && (
                     <p>
                       Ownership cost:{" "}
                       <span className="font-medium">
                         {data.ownership_cost_category}
                       </span>
                     </p>
                   )}
                   {data.catastrophic_penalty != null && (
                     <p>
                       Catastrophic risk adjustment:{" "}
                       <span className="font-medium">
                         {data.catastrophic_penalty.toFixed(1)}
                       </span>
                     </p>
                   )}
                   {data.calculated_at && (
                     <p className="text-[11px] text-white/50">
                       Last updated:{" "}
                       {new Date(data.calculated_at).toLocaleDateString()}
                     </p>
                   )}
                 </div>
               </section>

               <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                 {/* Breakdown + Why */}
                 <div className="space-y-6">
                   {/* Breakdown (category list) */}
                   <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                     <div className="flex items-baseline justify-between gap-2">
                       <h2 className="text-sm font-semibold text-white/90">
                         Category breakdown
                       </h2>
                       <p className="text-[11px] text-white/50">
                         Higher weighted points contribute more to the final score.
                       </p>
                     </div>
                     <div className="mt-4 space-y-2">
                       {data.category_breakdown.length === 0 && (
                         <p className="text-xs text-white/60">
                           No category-level data available for this vehicle.
                         </p>
                       )}
                       {data.category_breakdown.map((item, idx) => {
                         const weight = item.weight_decimal ?? 0;
                         const score = item.raw_score ?? 0;
                         const weighted = item.weighted_points ?? 0;
                         const displayCategory = item.category ?? "Other";

                         return (
                           <div
                             key={`${displayCategory}-${idx}`}
                             className="rounded-xl bg-black/40 border border-white/5 px-3 py-3 text-xs sm:text-sm flex flex-col gap-2"
                           >
                             <div className="flex items-center justify-between gap-2">
                               <p className="font-medium text-white/90">
                                 {displayCategory}
                               </p>
                               <p className="text-white/80">
                                 {score != null ? score.toFixed(1) : "–"}
                                 <span className="ml-1 text-white/40 text-[11px]">
                                   raw
                                 </span>
                               </p>
                             </div>
                             <div className="flex items-center justify-between gap-4 text-[11px] text-white/60">
                               <p>Weight: {(weight * 100).toFixed(0)}%</p>
                               <p>
                                 Weighted points:{" "}
                                 <span className="text-white/80">
                                   {weighted != null ? weighted.toFixed(1) : "–"}
                                 </span>
                               </p>
                             </div>
                             {item.notes && (
                               <p className="text-[11px] text-white/70">
                                 {item.notes}
                               </p>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   </section>

                   {/* “Why” highlights */}
                   <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                     <h2 className="text-sm font-semibold text-white/90">
                       Why this score?
                     </h2>
                     <p className="mt-1 text-[11px] text-white/60">
                       Strongest categories add the most points; weakest categories
                       hold the score back.
                     </p>
                     <div className="mt-4 grid gap-4 sm:grid-cols-2">
                       <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2">
                         <p className="text-xs font-semibold text-emerald-100 uppercase tracking-[0.15em]">
                           Strongest
                         </p>
                         {data.why.strongest.length === 0 && (
                           <p className="text-xs text-emerald-100/70">
                             No standout strengths identified.
                           </p>
                         )}
                         {data.why.strongest.map((item, idx) => (
                           <div key={`strong-${idx}`} className="text-xs space-y-1">
                             <p className="font-medium">
                               {item.category ?? "Other"}
                             </p>
                             <p className="text-emerald-100/80">
                               Weighted points:{" "}
                               {item.weighted_points != null
                                 ? item.weighted_points.toFixed(1)
                                 : "–"}
                             </p>
                             {item.notes && (
                               <p className="text-[11px] text-emerald-50/80">
                                 {item.notes}
                               </p>
                             )}
                           </div>
                         ))}
                       </div>
                       <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
                         <p className="text-xs font-semibold text-amber-100 uppercase tracking-[0.15em]">
                           Weakest
                         </p>
                         {data.why.weakest.length === 0 && (
                           <p className="text-xs text-amber-100/70">
                             No clear weak spots identified.
                           </p>
                         )}
                         {data.why.weakest.map((item, idx) => (
                           <div key={`weak-${idx}`} className="text-xs space-y-1">
                             <p className="font-medium">
                               {item.category ?? "Other"}
                             </p>
                             <p className="text-amber-100/80">
                               Weighted points:{" "}
                               {item.weighted_points != null
                                 ? item.weighted_points.toFixed(1)
                                 : "–"}
                             </p>
                             {item.notes && (
                               <p className="text-[11px] text-amber-50/80">
                                 {item.notes}
                               </p>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                   </section>
                 </div>

                 {/* Repairs list */}
                 <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                   <div className="flex items-baseline justify-between gap-2">
                     <h2 className="text-sm font-semibold text-white/90">
                       Notable repair risks
                     </h2>
                     <p className="text-[11px] text-white/50">
                       Sorted by severity and cost, highest risk first.
                     </p>
                   </div>
                   <div className="mt-4 space-y-3">
                     {data.repairs.length === 0 && (
                       <p className="text-xs text-white/60">
                         No specific repair issues surfaced for this vehicle in our
                         data.
                       </p>
                     )}
                     {data.repairs.map((repair) => (
                       <article
                         key={repair.id}
                         className="rounded-xl bg-black/40 border border-white/5 px-3 py-3 text-xs sm:text-sm space-y-2"
                       >
                         <div className="flex items-start justify-between gap-3">
                           <div>
                             <p className="font-medium text-white/90">
                               {repair.issue_name}
                             </p>
                             <p className="text-[11px] text-white/60">
                               Severity: {formatSeverity(repair.severity)}
                               {repair.is_systemic ? " • Systemic issue" : null}
                             </p>
                           </div>
                           <div className="text-right text-[11px] text-white/70">
                             <p>
                               Typical mileage:{" "}
                               {repair.typical_mileage != null
                                 ? `${repair.typical_mileage.toLocaleString()} mi`
                                 : "n/a"}
                             </p>
                             <p>
                               Cost range:{" "}
                               {formatMoney(repair.cost_min)}–{formatMoney(repair.cost_max)}
                             </p>
                             <p>
                               Est. failure rate:{" "}
                               {formatPercent(repair.failure_rate_estimate)}
                             </p>
                           </div>
                         </div>
                         {repair.description && (
                           <p className="text-[11px] text-white/70">
                             {repair.description}
                           </p>
                         )}
                       </article>
                     ))}
                   </div>
                 </section>
               </div>
             </>
           )}

           <p className="pt-2 text-[11px] leading-relaxed text-white/50">
             This report is based on aggregated repair records, recalls, and
             historical ownership data. It is not a guarantee of future
             performance. Always combine this with a pre-purchase inspection and
             your own judgment.{" "}
             <a
               href="/disclaimer"
               className="underline underline-offset-2 hover:text-white"
             >
               Read the full disclaimer
             </a>
             .
           </p>
         </div>
       </main>
     </div>
   );
 }

