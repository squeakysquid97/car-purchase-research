import CarResults from "../(components)/CarResults";

type SearchParams = {
  make?: string;
  model?: string;
  year?: string;
};

export default function CarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const make = searchParams.make ?? "";
  const model = searchParams.model ?? "";
  const year = searchParams.year ?? "";

  return <CarResults make={make} model={model} year={year} />;
}

