import CarResults from "../(components)/CarResults";

type CarSearchParams = {
  make?: string;
  model?: string;
  year?: string;
};

type CarPageProps = {
  searchParams: Promise<CarSearchParams>;
};

export default async function CarPage({ searchParams }: CarPageProps) {
  const { make = "", model = "", year = "" } = await searchParams;

  return <CarResults make={make} model={model} year={year} />;
}
