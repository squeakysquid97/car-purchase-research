import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ModelRow = {
  name: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make");

  if (!make) {
    return NextResponse.json({ ok: false, error: "Missing make" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Join models -> makes and filter on make name
  const { data, error } = await supabase
    .from("models")
    .select(`name, makes!inner(name)`)
    .ilike("makes.name", make)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ModelRow[];

  // De-dupe model names (just in case)
  const unique = Array.from(new Set(rows.map((row) => row.name))).map((name) => ({
    name,
  }));

  return NextResponse.json({ ok: true, data: unique });
}