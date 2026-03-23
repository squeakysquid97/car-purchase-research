import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Severity = "low" | "medium" | "high" | "catastrophic";

type MakeRow = {
  name: string | null;
};

type ModelRow = {
  name: string | null;
  makes: MakeRow | MakeRow[] | null;
};

type VehicleLookupRow = {
  id: number;
  models: ModelRow | ModelRow[] | null;
};

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

function getFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeSlugSegment(value: string) {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function toVehicleSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

async function resolveVehicleYearIdFromSlug(
  supabase: SupabaseClient,
  year: number,
  makeSlug: string,
  modelSlug: string
) {
  const normalizedMakeSlug = normalizeSlugSegment(makeSlug);
  const normalizedModelSlug = normalizeSlugSegment(modelSlug);

  const { data, error } = await supabase
    .from("vehicle_years")
    .select(
      `
      id,
      models!inner (
        name,
        makes!inner ( name )
      )
    `
    )
    .eq("year", year);

  if (error || !data) {
    return { vehicleYearId: null, error };
  }

  const matchingRow = (data as VehicleLookupRow[]).find((row) => {
    const modelRow = getFirst(row.models);
    const makeRow = getFirst(modelRow?.makes);

    if (!modelRow?.name || !makeRow?.name) {
      return false;
    }

    return (
      toVehicleSlug(makeRow.name) === normalizedMakeSlug &&
      toVehicleSlug(modelRow.name) === normalizedModelSlug
    );
  });

  return {
    vehicleYearId: matchingRow?.id ?? null,
    error: null,
  };
}

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
  const makeSlug = searchParams.get("makeSlug");
  const modelSlug = searchParams.get("modelSlug");
  const year = searchParams.get("year");
  const hasNameLookup = Boolean(make && model);
  const hasSlugLookup = Boolean(makeSlug && modelSlug);

  if (!year || (!hasNameLookup && !hasSlugLookup)) {
    return NextResponse.json(
      { ok: false, error: "Missing vehicle lookup fields" },
      { status: 400 }
    );
  }

  const numericYear = Number(year);
  if (Number.isNaN(numericYear)) {
    return NextResponse.json(
      { ok: false, error: "Invalid year" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let resolvedVehicleYearId: number | null = null;
  if (hasSlugLookup && makeSlug && modelSlug) {
    const { vehicleYearId, error: lookupError } =
      await resolveVehicleYearIdFromSlug(
        supabase,
        numericYear,
        makeSlug,
        modelSlug
      );

    if (lookupError) {
      return NextResponse.json(
        { ok: false, error: "Vehicle lookup failed" },
        { status: 500 }
      );
    }

    if (vehicleYearId == null) {
      return NextResponse.json(
        { ok: false, error: "Vehicle not found" },
        { status: 404 }
      );
    }

    resolvedVehicleYearId = vehicleYearId;
  }

  let vehicleQuery = supabase
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
    );

  if (resolvedVehicleYearId != null) {
    vehicleQuery = vehicleQuery.eq("id", resolvedVehicleYearId);
  } else {
    vehicleQuery = vehicleQuery
      .eq("year", numericYear)
      .ilike("models.name", model!)
      .ilike("models.makes.name", make!);
  }

  const { data, error } = await vehicleQuery.single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Vehicle not found" },
      { status: 404 }
    );
  }

  // Depending on relationship cardinality/config, Supabase can return
  // nested relations as either objects or arrays.
  const modelRow = getFirst(data.models);
  const makeRow = getFirst(modelRow?.makes);
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
