"use client";

import { useSearchParams } from "next/navigation";
import CarResults from "../(components)/CarResults";

export default function CarPage() {
  const searchParams = useSearchParams();

  const make = searchParams.get("make") ?? "";
  const model = searchParams.get("model") ?? "";
  const year = searchParams.get("year") ?? "";

  return <CarResults make={make} model={model} year={year} />;
}
