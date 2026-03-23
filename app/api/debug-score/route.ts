import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    // Use SERVICE ROLE for server-side verification (bypasses RLS)
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const vehicleYearId = 9; // <-- set to your test id

  const { data, error } = await supabase
    .from("vehicle_final_scores")
    .select("*")
    .eq("vehicle_year_id", vehicleYearId)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}