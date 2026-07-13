"use client";

import { useEffect, useState } from "react";

import {
  CUPCAKES_UPDATED_EVENT,
  defaultWeeklyCupcakes,
  getStoredCupcakes,
  loadPublishedCupcakes,
  type WeeklyCupcake,
} from "@/lib/cupcakes";

export function useWeeklyCupcakes() {
  const [cupcakes, setCupcakes] = useState<WeeklyCupcake[]>(defaultWeeklyCupcakes);

  useEffect(() => {
    const syncCupcakes = () => setCupcakes(getStoredCupcakes());
    const syncPublishedCupcakes = async () => {
      try {
        setCupcakes(await loadPublishedCupcakes());
      } catch {
        syncCupcakes();
      }
    };

    void syncPublishedCupcakes();
    const syncInterval = window.setInterval(() => void syncPublishedCupcakes(), 60_000);
    window.addEventListener("storage", syncCupcakes);
    window.addEventListener(CUPCAKES_UPDATED_EVENT, syncCupcakes);

    return () => {
      window.clearInterval(syncInterval);
      window.removeEventListener("storage", syncCupcakes);
      window.removeEventListener(CUPCAKES_UPDATED_EVENT, syncCupcakes);
    };
  }, []);

  return cupcakes;
}
