"use client";

import { useEffect, useState } from "react";

import {
  defaultWeeklyCupcakes,
  loadPublishedCupcakes,
  type WeeklyCupcake,
} from "@/lib/cupcakes";

export function useWeeklyCupcakes() {
  const [cupcakes, setCupcakes] = useState<WeeklyCupcake[]>(defaultWeeklyCupcakes);

  useEffect(() => {
    const syncPublishedCupcakes = async () => {
      setCupcakes(await loadPublishedCupcakes());
    };

    void syncPublishedCupcakes();
    const syncInterval = window.setInterval(() => void syncPublishedCupcakes(), 60_000);

    return () => {
      window.clearInterval(syncInterval);
    };
  }, []);

  return cupcakes;
}
