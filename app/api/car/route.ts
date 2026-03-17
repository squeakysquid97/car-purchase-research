import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Severity = "low" | "medium" | "high" | "catastrophic";

type VehicleScoreRow = {
  scoring_category_id: number | null;
  raw_score: number | null;
  notes: string | null;
  scoring_categories: {
    name: string | null;
    // Supabase decimal may come back as string; we normalize to number later
    weight_decimal: number | string | null;
  } | null;
};

type RepairIssueRow = {
  id: number;
  issue_name: string;
  source_name: string;
  severity: Severity | null;
  typical_mileage: number | null;
  cost_min: number | null;
  cost_max: number | null;
  failure_rate_estimate: number | string | null;
  is_systemic: boolean;
  description: string | null;
};

type CategoryBreakdownItem = {
  scoring_category_id: number | null;
  category: string | null;
  weight_decimal: number | null;
  raw_score: number | null;
  weighted_points: number | null;
  notes: string | null;
};

type RepairItem = {
  id: number;
  issue_name: string;
  severity: Severity | null;
  typical_mileage: number | null;
  cost_min: number | null;
  cost_max: number | null;
  failure_rate_estimate: number | null;
  is_systemic: boolean;
  description: string | null;
};

const MAX_DISPLAY_REPAIRS_FROM_NHTSA = 4;

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
        source_name,
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

  // Depending on relationship cardinality/config, Supabase can return
  // nested relations as either objects or arrays.
  const modelRow = Array.isArray(data.models) ? data.models[0] : data.models;
  const makeRow = modelRow?.makes
    ? Array.isArray(modelRow.makes)
      ? modelRow.makes[0]
      : modelRow.makes
    : null;
  const final = Array.isArray(data.vehicle_final_scores)
    ? data.vehicle_final_scores[0]
    : data.vehicle_final_scores;

  const vehicleScores = (data.vehicle_scores ?? []) as unknown as VehicleScoreRow[];

  const categoryBreakdown: CategoryBreakdownItem[] = vehicleScores
    .map((vs) => {
      const cat = vs.scoring_categories;
      const weight = cat?.weight_decimal ? Number(cat.weight_decimal) : null;
      const raw = vs.raw_score != null ? Number(vs.raw_score) : null;
      const weightedPoints =
        weight != null && raw != null
          ? Math.round(raw * weight * 10 * 100) / 100
          : null;

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
    .sort(
      (a, b) => (a.scoring_category_id ?? 0) - (b.scoring_category_id ?? 0)
    );

  const repairIssues = (data.repair_issues ?? []) as RepairIssueRow[];
  const repairIssuesFromSource = repairIssues.filter(
    (ri) => ri.source_name === "nhtsa"
  );
  const repairsSourceName = "nhtsa";
  const totalRepairsFromSource = repairIssuesFromSource.length;

  const repairs: RepairItem[] = repairIssuesFromSource
    .map((ri) => ({
      id: ri.id,
      issue_name: ri.issue_name,
      severity: ri.severity,
      typical_mileage: ri.typical_mileage,
      cost_min: ri.cost_min,
      cost_max: ri.cost_max,
      failure_rate_estimate:
        ri.failure_rate_estimate != null
          ? Number(ri.failure_rate_estimate)
          : null,
      is_systemic: ri.is_systemic,
      description: ri.description,
    }))
    // sort: worst severity first, then highest cost_max
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity);
      if (sev !== 0) return sev;
      return (b.cost_max ?? 0) - (a.cost_max ?? 0);
    })
    .slice(0, MAX_DISPLAY_REPAIRS_FROM_NHTSA);
  const repairsMoreCount = Math.max(totalRepairsFromSource - repairs.length, 0);

  // Optional: quick “why” summary (based on top positives/negatives)
  const why = {
    strongest: categoryBreakdown
      .filter((c) => c.weighted_points != null)
      .sort((a, b) => (b.weighted_points ?? 0) - (a.weighted_points ?? 0))
      .slice(0, 2),
    weakest: categoryBreakdown
      .filter((c) => c.weighted_points != null)
      .sort((a, b) => (a.weighted_points ?? 0) - (b.weighted_points ?? 0))
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
      repairs_more_count: repairsMoreCount,
      repairs_source_name: repairsSourceName,
      why,
    },
  });
}
