"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { CupcakeOrderCombobox } from "@/components/cupcake-order-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CUPCAKES_UPDATED_EVENT,
  defaultWeeklyCupcakes,
  getStoredCupcakes,
  loadPublishedCupcakes,
  type WeeklyCupcake,
} from "@/lib/cupcakes";

export function WeeklyCupcakes() {
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

  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-border/70 bg-card/90 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-3xl">This Week&apos;s Special</CardTitle>
        <p className="text-sm text-muted-foreground">
          Freshly featured flavors from this week&apos;s bake.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {cupcakes.map((cupcake) => (
          <CupcakeCard key={cupcake.id} cupcake={cupcake} />
        ))}
        <div className="mt-auto border-t border-border/70 pt-4">
          <Button type="button" size="lg" className="w-full">
            <ShoppingBag />
            Order Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CupcakeCard({ cupcake }: { cupcake: WeeklyCupcake }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg bg-linear-to-br from-rose-200 to-amber-100">
          <Image
            src="/Cupcake.jpg"
            alt={`${cupcake.name} cupcake`}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-semibold">{cupcake.name}</p>
              <Badge variant="secondary">This Week</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{cupcake.blurb}</p>
          </div>
          <p className="mt-3 text-sm font-semibold text-primary">{cupcake.price}</p>
        </div>
      </div>
      <div className="mt-4 w-full">
        <CupcakeOrderCombobox
          options={cupcake.flavorOptions}
          placeholder="Select a flavor"
        />
      </div>
    </div>
  );
}
