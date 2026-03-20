export const SITE_NAME = "Car Purchase Research";

export function getBaseUrl(): string {
  const configuredBase =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";

  if (configuredBase) {
    return configuredBase.startsWith("http")
      ? configuredBase.replace(/\/$/, "")
      : `https://${configuredBase.replace(/\/$/, "")}`;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function buildAbsoluteUrl(path: string): string {
  const baseUrl = getBaseUrl();
  return path === "/" ? baseUrl : `${baseUrl}${path}`;
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: getBaseUrl(),
  };
}
