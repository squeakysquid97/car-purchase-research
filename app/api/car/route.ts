import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Severity = "low" | "medium" | "high" | "catastrophic";

function severityRank(s?: Severity | null) {
  switch (s) {
    case "catastrophic":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const year = searchParams.get("year");

  if (!make || !model || !year) {
    return NextResponse.json(
      { ok: false, error: "Missing make, model, or year" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("vehicle_years")
    .select(
      `
      id,
      year,
      generation,
      summary_text,
      ownership_cost_category,

      models!inner (
        name,
        makes!inner ( name )
      ),

      vehicle_final_scores (
        base_score,
        catastrophic_penalty,
        final_score,
        score_label,
        calculated_at
      ),

      vehicle_scores (
        scoring_category_id,
        raw_score,
        notes,
        scoring_categories ( name, weight_decimal )
      ),

      repair_issues (
        id,
        issue_name,
        severity,
        typical_mileage,
        cost_min,
        cost_max,
        failure_rate_estimate,
        is_systemic,
        description
      )
    `
    )
    .eq("year", Number(year))
    .ilike("models.name", model)
    .ilike("models.makes.name", make)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Vehicle not found" },
      { status: 404 }
    );
  }

  // Supabase returns relations as arrays
  const modelRow = data.models?.[0];
  const makeRow = modelRow?.makes?.[0];
  const final = data.vehicle_final_scores?.[0];

  const categoryBreakdown =
    (data.vehicle_scores ?? [])
      .map((vs: any) => {
        const cat = vs.scoring_categories;
        const weight = cat?.weight_decimal ? Number(cat.weight_decimal) : null;
        const raw = vs.raw_score != null ? Number(vs.raw_score) : null;
        const weightedPoints =
          weight != null && raw != null ? Math.round(raw * weight * 10 * 100) / 100 : null;

        return {
          scoring_category_id: vs.scoring_category_id,
          category: cat?.name ?? null,
          weight_decimal: weight,
          raw_score: raw,
          weighted_points: weightedPoints,
          notes: vs.notes ?? null,
        };
      })
      // sort by category id for consistent output
      .sort((a: any, b: any) => (a.scoring_category_id ?? 0) - (b.scoring_category_id ?? 0));

  const repairs =
    (data.repair_issues ?? [])
      .map((ri: any) => ({
        id: ri.id,
        issue_name: ri.issue_name,
        severity: ri.severity,
        typical_mileage: ri.typical_mileage,
        cost_min: ri.cost_min,
        cost_max: ri.cost_max,
        failure_rate_estimate:
          ri.failure_rate_estimate != null ? Number(ri.failure_rate_estimate) : null,
        is_systemic: ri.is_systemic,
        description: ri.description,
      }))
      // sort: worst severity first, then highest cost_max
      .sort((a: any, b: any) => {
        const sev = severityRank(b.severity) - severityRank(a.severity);
        if (sev !== 0) return sev;
        return (b.cost_max ?? 0) - (a.cost_max ?? 0);
      });

  // Optional: quick “why” summary (based on top positives/negatives)
  const why = {
    strongest:
      categoryBreakdown
        .filter((c: any) => c.weighted_points != null)
        .sort((a: any, b: any) => (b.weighted_points ?? 0) - (a.weighted_points ?? 0))
        .slice(0, 2),
    weakest:
      categoryBreakdown
        .filter((c: any) => c.weighted_points != null)
        .sort((a: any, b: any) => (a.weighted_points ?? 0) - (b.weighted_points ?? 0))
        .slice(0, 2),
  };

  return NextResponse.json({
    ok: true,
    data: {
      vehicle_year_id: data.id,
      make: makeRow?.name ?? null,
      model: modelRow?.name ?? null,
      year: data.year,
      generation: data.generation ?? null,
      ownership_cost_category: data.ownership_cost_category ?? null,
      summary_text: data.summary_text ?? null,

      base_score: final?.base_score != null ? Number(final.base_score) : null,
      catastrophic_penalty: final?.catastrophic_penalty ?? null,
      final_score: final?.final_score != null ? Number(final.final_score) : null,
      score_label: final?.score_label ?? null,
      calculated_at: final?.calculated_at ?? null,

      category_breakdown: categoryBreakdown,
      repairs,
      why,
    },
  });
}