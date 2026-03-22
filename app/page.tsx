import type { Metadata } from "next";

import CarSearchForm from "./(components)/CarSearchForm";
import { SITE_NAME, buildAbsoluteUrl, buildOrganizationJsonLd } from "./seo";

export const metadata: Metadata = {
  title: "Used Car Buyability Search",
  description:
    "Search used cars by make, model, and year to review buyability scores, repair-risk categories, recall patterns, and complaint signals.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: `Used Car Buyability Search | ${SITE_NAME}`,
    description:
      "Search used cars by make, model, and year to review buyability scores, repair-risk categories, recall patterns, and complaint signals.",
    url: "/",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `Used Car Buyability Search | ${SITE_NAME}`,
    description:
      "Search used cars by make, model, and year to review buyability scores, repair-risk categories, recall patterns, and complaint signals.",
  },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: buildAbsoluteUrl("/"),
        description:
          "Search used cars by make, model, and year to review buyability scores, repair-risk categories, recall patterns, and complaint signals.",
      },
      {
        "@type": "WebPage",
        name: `Used Car Buyability Search | ${SITE_NAME}`,
        description:
          "Search used cars by make, model, and year to review buyability scores, repair-risk categories, recall patterns, and complaint signals.",
        url: buildAbsoluteUrl("/"),
      },
      buildOrganizationJsonLd(),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CarSearchForm />
    </>
  );
}
