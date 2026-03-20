import type { Metadata } from "next";
import CarResults from "../(components)/CarResults";
import { redirect } from "next/navigation";

import { SITE_NAME } from "../seo";

type CarSearchParams = {
  make?: string;
  model?: string;
  year?: string;
};

type CarPageProps = {
  searchParams: Promise<CarSearchParams>;
};

export const metadata: Metadata = {
  title: "Vehicle Report Redirect",
  description:
    "Lookup route for vehicle reports. Matching make, model, and year searches resolve to canonical vehicle detail pages.",
  alternates: {
    canonical: "/car",
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: `Vehicle Report Redirect | ${SITE_NAME}`,
    description:
      "Lookup route for vehicle reports. Matching make, model, and year searches resolve to canonical vehicle detail pages.",
    url: "/car",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: `Vehicle Report Redirect | ${SITE_NAME}`,
    description:
      "Lookup route for vehicle reports. Matching make, model, and year searches resolve to canonical vehicle detail pages.",
  },
};

function toSlug(value: string) {
  return encodeURIComponent(
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
  );
}

export default async function CarPage({ searchParams }: CarPageProps) {
  const { make = "", model = "", year = "" } = await searchParams;

  if (make && model && year) {
    redirect(`/cars/${toSlug(make)}/${toSlug(model)}/${encodeURIComponent(year.trim())}`);
  }

  return <CarResults make={make} model={model} year={year} />;
}
