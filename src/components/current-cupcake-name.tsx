"use client";

import { useWeeklyCupcakes } from "@/hooks/use-weekly-cupcakes";

export function CurrentCupcakeName() {
  const cupcakes = useWeeklyCupcakes();
  const cupcakeName = cupcakes[0]?.name ?? "Weekly Cupcakes";

  return <>{cupcakeName}</>;
}
