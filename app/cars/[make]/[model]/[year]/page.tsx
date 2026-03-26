import type { Metadata } from "next";

import CarResults from "../../../../(components)/CarResults";
import { SITE_NAME, buildAbsoluteUrl, getBaseUrl } from "../../../../seo";

type CarSlugParams = {
  make: string;
  model: string;
  year: string;
};

type CarSlugPageProps = {
  params: Promise<CarSlugParams>;
};

type CarApiMetadataData = {
  make: string | null;
  model: string | null;
  year: number;
  final_score: number | null;
  score_label: string | null;
};

type CarApiMetadataResponse =
  | { ok: true; data: CarApiMetadataData }
  | { ok: false; error: string };

type ScoreSummary = {
  make: string | null;
  model: string | null;
  year: number | null;
  finalScore: number | null;
  scoreLabel: string | null;
};

function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).trim();
  } catch {
    return segment.trim();
  }
}

function humanizeSegment(segment: string): string {
  return decodeRouteSegment(segment).replace(/-/g, " ").trim();
}

function getCanonicalPath(params: CarSlugParams): string {
  return `/cars/${encodeURIComponent(params.make)}/${encodeURIComponent(params.model)}/${encodeURIComponent(params.year)}`;
}

async function getScoreSummary(
  makeSlug: string,
  modelSlug: string,
  year: string,
  baseUrl: string
): Promise<ScoreSummary> {
  try {
    const qs = new URLSearchParams({
      makeSlug,
      modelSlug,
      year,
    }).toString();
    const res = await fetch(`${baseUrl}/api/car?${qs}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return {
        make: null,
        model: null,
        year: null,
        finalScore: null,
        scoreLabel: null,
      };
    }

    const json = (await res.json()) as CarApiMetadataResponse;
    if (!json.ok) {
      return {
        make: null,
        model: null,
        year: null,
        finalScore: null,
        scoreLabel: null,
      };
    }

    return {
      make: json.data.make,
      model: json.data.model,
      year: json.data.year,
      finalScore:
        json.data.final_score != null
          ? Math.max(0, Math.min(100, Number(json.data.final_score)))
          : null,
      scoreLabel: json.data.score_label,
    };
  } catch {
    return {
      make: null,
      model: null,
      year: null,
      finalScore: null,
      scoreLabel: null,
    };
  }
}

function buildDescription(
  vehicleName: string,
  finalScore: number | null,
  scoreLabel: string | null
) {
  return finalScore != null && scoreLabel
    ? `${vehicleName} buyability score: ${finalScore.toFixed(1)}/100 (${scoreLabel}). Review risk categories and notable repair issues.`
    : `Buyability report for ${vehicleName}. Review score, risk categories, and notable repair issues.`;
}

export async function generateMetadata({
  params,
}: CarSlugPageProps): Promise<Metadata> {
  const routeParams = await params;

  const makeSlug = decodeRouteSegment(routeParams.make);
  const modelSlug = decodeRouteSegment(routeParams.model);
  const fallbackMake = humanizeSegment(routeParams.make);
  const fallbackModel = humanizeSegment(routeParams.model);
  const fallbackYear = decodeRouteSegment(routeParams.year);

  const baseUrl = getBaseUrl();
  const canonicalPath = getCanonicalPath(routeParams);
  const canonicalUrl = buildAbsoluteUrl(canonicalPath);

  const { make, model, year, finalScore, scoreLabel } = await getScoreSummary(
    makeSlug,
    modelSlug,
    fallbackYear,
    baseUrl
  );
  const vehicleMake = make ?? fallbackMake;
  const vehicleModel = model ?? fallbackModel;
  const vehicleYear = year != null ? String(year) : fallbackYear;
  const vehicleName = `${vehicleYear} ${vehicleMake} ${vehicleModel}`.trim();

  const title = `${vehicleName} Buyability Score`;
  const description = buildDescription(vehicleName, finalScore, scoreLabel);

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
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CarSlugPage({ params }: CarSlugPageProps) {
  const routeParams = await params;
  const makeSlug = decodeRouteSegment(routeParams.make);
  const modelSlug = decodeRouteSegment(routeParams.model);
  const fallbackMake = humanizeSegment(routeParams.make);
  const fallbackModel = humanizeSegment(routeParams.model);
  const fallbackYear = decodeRouteSegment(routeParams.year);
  const baseUrl = getBaseUrl();
  const canonicalPath = getCanonicalPath(routeParams);
  const canonicalUrl = buildAbsoluteUrl(canonicalPath);
  const { make, model, year, finalScore, scoreLabel } = await getScoreSummary(
    makeSlug,
    modelSlug,
    fallbackYear,
    baseUrl
  );
  const vehicleMake = make ?? fallbackMake;
  const vehicleModel = model ?? fallbackModel;
  const vehicleYear = year != null ? String(year) : fallbackYear;
  const vehicleName = `${vehicleYear} ${vehicleMake} ${vehicleModel}`.trim();
  const description = buildDescription(vehicleName, finalScore, scoreLabel);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${vehicleName} Buyability Score`,
        description,
        url: canonicalUrl,
      },
    ],
  };
  const safeJsonLd = JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd }}
      />
      <CarResults
        make={fallbackMake}
        model={fallbackModel}
        year={fallbackYear}
        makeSlug={makeSlug}
        modelSlug={modelSlug}
      />
    </>
  );
}
