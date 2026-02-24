import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type YearRow = {
  year: number;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make");
  const model = searchParams.get("model");

  if (!make || !model) {
    return NextResponse.json(
      { ok: false, error: "Missing make or model" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Join vehicle_years -> models -> makes
  const { data, error } = await supabase
    .from("vehicle_years")
    .select(`year, models!inner(name, makes!inner(name))`)
    .ilike("models.name", model)
    .ilike("models.makes.name", make)
    .order("year", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as YearRow[];

  // De-dupe years
  const uniqueYears = Array.from(new Set(rows.map((row) => row.year)))
    .sort((a, b) => b - a)
    .map((year) => ({ year }));

  return NextResponse.json({ ok: true, data: uniqueYears });
}