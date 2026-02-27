import type { Metadata } from "next";

import CarResults from "../../../../(components)/CarResults";

type CarSlugParams = {
  make: string;
  model: string;
  year: string;
};

type CarSlugPageProps = {
  params: Promise<CarSlugParams>;
};

type CarApiMetadataData = {
  final_score: number | null;
  score_label: string | null;
};

type CarApiMetadataResponse =
  | { ok: true; data: CarApiMetadataData }
  | { ok: false; error: string };

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).replace(/-/g, " ").trim();
  } catch {
    return segment.replace(/-/g, " ").trim();
  }
}

function getBaseUrl(): string {
  const configuredBase =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";

  if (configuredBase) {
    return configuredBase.startsWith("http")
      ? configuredBase.replace(/\/$/, "")
      : `https://${configuredBase.replace(/\/$/, "")}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function getCanonicalPath(params: CarSlugParams): string {
  return `/cars/${encodeURIComponent(params.make)}/${encodeURIComponent(params.model)}/${encodeURIComponent(params.year)}`;
}

async function getScoreSummary(
  make: string,
  model: string,
  year: string,
  baseUrl: string
): Promise<{ finalScore: number | null; scoreLabel: string | null }> {
  try {
    const qs = new URLSearchParams({ make, model, year }).toString();
    const res = await fetch(`${baseUrl}/api/car?${qs}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { finalScore: null, scoreLabel: null };
    }

    const json = (await res.json()) as CarApiMetadataResponse;
    if (!json.ok) {
      return { finalScore: null, scoreLabel: null };
    }

    return {
      finalScore:
        json.data.final_score != null
          ? Math.max(0, Math.min(100, Number(json.data.final_score)))
          : null,
      scoreLabel: json.data.score_label,
    };
  } catch {
    return { finalScore: null, scoreLabel: null };
  }
}

export async function generateMetadata({
  params,
}: CarSlugPageProps): Promise<Metadata> {
  const routeParams = await params;

  const decodedMake = decodeSegment(routeParams.make);
  const decodedModel = decodeSegment(routeParams.model);
  const decodedYear = decodeSegment(routeParams.year);
  const vehicleName = `${decodedYear} ${decodedMake} ${decodedModel}`.trim();

  const baseUrl = getBaseUrl();
  const canonicalPath = getCanonicalPath(routeParams);
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  const { finalScore, scoreLabel } = await getScoreSummary(
    decodedMake,
    decodedModel,
    decodedYear,
    baseUrl
  );

  const title = `${vehicleName} Buyability Score`;
  const description =
    finalScore != null && scoreLabel
      ? `${vehicleName} buyability score: ${finalScore.toFixed(1)}/100 (${scoreLabel}). Review risk categories and notable repair issues.`
      : `Buyability report for ${vehicleName}. Review score, risk categories, and notable repair issues.`;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      siteName: "Car Purchase Research",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CarSlugPage({ params }: CarSlugPageProps) {
  const { make, model, year } = await params;

  return (
    <CarResults
      make={decodeSegment(make)}
      model={decodeSegment(model)}
      year={decodeSegment(year)}
    />
  );
}
