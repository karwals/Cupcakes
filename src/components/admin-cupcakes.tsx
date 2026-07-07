"use client";

import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCupcakeId,
  defaultWeeklyCupcakes,
  getStoredCupcakes,
  saveStoredCupcakes,
  type WeeklyCupcake,
} from "@/lib/cupcakes";
import { cn } from "@/lib/utils";

type CupcakeForm = {
  name: string;
  blurb: string;
  price: string;
  flavorOptions: string;
};

const emptyForm: CupcakeForm = {
  name: "",
  blurb: "",
  price: "",
  flavorOptions: "",
};

export function AdminCupcakes() {
  const [cupcakes, setCupcakes] = useState<WeeklyCupcake[]>(() => getStoredCupcakes());
  const [form, setForm] = useState<CupcakeForm>({
    name: "Salted Caramel Cloud",
    blurb: "Brown sugar sponge, salted caramel center, and silky vanilla frosting.",
    price: "$8.00",
    flavorOptions: "Extra caramel\nClassic swirl\nNo caramel drizzle",
  });

  const flavorPreview = useMemo(() => getFlavorOptions(form.flavorOptions), [form.flavorOptions]);

  function updateCupcakes(nextCupcakes: WeeklyCupcake[]) {
    setCupcakes(nextCupcakes);
    saveStoredCupcakes(nextCupcakes);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const blurb = form.blurb.trim();
    const price = normalizeCupcakePrice(form.price);
    const flavorOptions = getFlavorOptions(form.flavorOptions);

    if (!name || !blurb || price === null || flavorOptions.length === 0) {
      return;
    }

    updateCupcakes([
      ...cupcakes,
      {
        id: createCupcakeId(name),
        name,
        blurb,
        price,
        flavorOptions,
      },
    ]);
    setForm(emptyForm);
  }

  function removeCupcake(id: string) {
    const nextCupcakes = cupcakes.filter((cupcake) => cupcake.id !== id);
    updateCupcakes(nextCupcakes.length > 0 ? nextCupcakes : defaultWeeklyCupcakes);
  }

  function resetCupcakes() {
    updateCupcakes(defaultWeeklyCupcakes);
  }

  const canSave =
    form.name.trim() &&
    form.blurb.trim() &&
    normalizeCupcakePrice(form.price) !== null &&
    flavorPreview.length > 0;

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-muted/30 to-background">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-14">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to site
            </Link>
            <div className="space-y-3">
              <Badge className="bg-primary/10 text-primary">Cupcake of the Week Admin</Badge>
              <h1 className="font-heading text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
                Weekly cupcake control
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Add the cupcakes you want featured on the main page. Your changes save in this browser for now.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
            <Metric label="Active cupcakes" value={cupcakes.length.toString()} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="rounded-2xl border-border/70 bg-card/90">
            <CardHeader className="pb-4">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <CardTitle>Add a new cupcake</CardTitle>
              <p className="text-sm text-muted-foreground">
                Each flavor option should go on its own line.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="grid gap-2 text-sm font-medium">
                  Name
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Salted Caramel Cloud"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Blurb
                  <Textarea
                    value={form.blurb}
                    onChange={(event) => setForm({ ...form, blurb: event.target.value })}
                    placeholder="Brown sugar sponge with salted caramel buttercream."
                    className="min-h-24"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Price
                  <Input
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                    onBlur={() => {
                      const normalizedPrice = normalizeCupcakePrice(form.price);

                      if (normalizedPrice) {
                        setForm({ ...form, price: normalizedPrice });
                      }
                    }}
                    placeholder="$8.00"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Flavor options
                  <Textarea
                    value={form.flavorOptions}
                    onChange={(event) => setForm({ ...form, flavorOptions: event.target.value })}
                    placeholder={"Classic swirl\nExtra filling\nNo sprinkles"}
                    className="min-h-28"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  {flavorPreview.map((option) => (
                    <Badge key={option} variant="secondary">
                      {option}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" size="lg" disabled={!canSave}>
                    <Save className="h-4 w-4" />
                    Save cupcake
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => setForm(emptyForm)}
                  >
                    Clear form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-heading text-3xl leading-tight">Current cupcakes</h2>
                <p className="text-sm text-muted-foreground">
                  These are the cupcakes currently shown on the landing page.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={resetCupcakes}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="grid gap-4">
              {cupcakes.map((cupcake) => (
                <article
                  key={cupcake.id}
                  className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-amber-100 text-amber-900">
                          <Sparkles className="h-3.5 w-3.5" />
                          This Week
                        </Badge>
                        <Badge variant="outline">
                          <BadgeDollarSign className="h-3.5 w-3.5" />
                          {cupcake.price}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{cupcake.name}</h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                          {cupcake.blurb}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cupcake.flavorOptions.map((option) => (
                          <Badge key={option} variant="secondary">
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      aria-label={`Remove ${cupcake.name}`}
                      onClick={() => removeCupcake(cupcake.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-36 rounded-xl bg-background/80 p-4">
      <p className="text-2xl font-semibold text-primary">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function getFlavorOptions(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function normalizeCupcakePrice(value: string) {
  const cleanedValue = value.trim().replace(/^\$/, "");

  if (!cleanedValue || !/^\d+(\.\d{0,2})?$/.test(cleanedValue)) {
    return null;
  }

  return `$${Number(cleanedValue).toFixed(2)}`;
}
