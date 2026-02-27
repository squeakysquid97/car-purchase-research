import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 21600;

type VehicleYearRow = {
  year: number | null;
  updated_at?: string | null;
  models:
    | {
        name: string | null;
        makes:
          | {
              name: string | null;
            }
          | {
              name: string | null;
            }[]
          | null;
      }
    | {
        name: string | null;
        makes:
          | {
              name: string | null;
            }
          | {
              name: string | null;
            }[]
          | null;
      }[]
    | null;
  vehicle_final_scores?:
    | {
        calculated_at: string | null;
      }
    | {
        calculated_at: string | null;
      }[]
    | null;
};

const MAX_VEHICLE_ROWS = 5000;

function getBaseUrl(): string {
  const configuredBase = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configuredBase) {
    const normalized = configuredBase.replace(/\/$/, "");
    return normalized.startsWith("http") ? normalized : `https://${normalized}`;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function slugify(value: string): string {
  return encodeURIComponent(
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
  );
}

function getFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return entries;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("vehicle_years")
    .select(
      `
      year,
      updated_at,
      models!inner (
        name,
        makes!inner ( name )
      ),
      vehicle_final_scores (
        calculated_at
      )
    `
    )
    .order("year", { ascending: false })
    .range(0, MAX_VEHICLE_ROWS - 1);

  if (error || !data) {
    return entries;
  }

  const vehicleEntries: MetadataRoute.Sitemap = [];
  for (const row of data as VehicleYearRow[]) {
    const model = getFirst(row.models);
    const make = getFirst(model?.makes);

    if (!row.year || !model?.name || !make?.name) {
      continue;
    }

    const scoreMeta = getFirst(row.vehicle_final_scores);
    const lastModified =
      scoreMeta?.calculated_at ?? row.updated_at ?? now.toISOString();

    vehicleEntries.push({
      url: `${baseUrl}/cars/${slugify(make.name)}/${slugify(model.name)}/${encodeURIComponent(String(row.year))}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return [...entries, ...vehicleEntries];
}
