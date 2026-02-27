import CarResults from "../(components)/CarResults";
import { redirect } from "next/navigation";

type CarSearchParams = {
  make?: string;
  model?: string;
  year?: string;
};

type CarPageProps = {
  searchParams: Promise<CarSearchParams>;
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
