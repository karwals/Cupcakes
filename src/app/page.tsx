import { Check, CircleDot, Clock3, Star } from "lucide-react";

import SplitText from "@/components/SplitText";
import { WeeklyCupcakes } from "@/components/weekly-cupcakes";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const steps = [
  {
    title: "Made Weekly",
    description: "Baked once each week and sold fresh until the box is gone.",
    icon: Clock3,
  },
  {
    title: "Hand-Frosted",
    description: "Each cupcake is piped by hand with simple ingredients and no preservatives.",
    icon: Star,
  },
  {
    title: "Sold Fresh",
    description: "Available once a week in a small run while supplies last.",
    icon: Check,
  },
];

export default function Home() {
  
  return (
    <main className="relative overflow-hidden bg-linear-to-b from-background via-background to-muted/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-primary/10 blur-3xl" />

      <section className="flex w-full flex-col gap-12 px-6 pb-20 pt-12 sm:px-10 lg:px-14 lg:pb-24 lg:pt-16">
          <header className="reveal-up flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <CircleDot className="h-5 w-5" />
              </div>
              <p className="font-heading text-2xl leading-none tracking-tight">Salted Caramel Cloud</p>
            </div>
            
          </header>

          <div className="grid items-stretch gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="reveal-up reveal-delay-1 space-y-8">
            <Badge className="bg-accent text-accent-foreground">Baked Weekly in Small Batches</Badge>
            <div className="space-y-5">
              <SplitText
                tag="h1"
                text="Cupcakes That Look Like Art and Taste Like Home."
                className="font-heading text-5xl leading-[0.98] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
                delay={35}
                duration={0.75}
                ease="power3.out"
                splitType="words"
                from={{ opacity: 0, y: 24 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.2}
                rootMargin="-80px"
                textAlign="left"
              />
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Fresh cupcakes made weekly with quality ingredients, simple flavors, and no preservatives.
                Perfect for birthdays, events, or just a sweet treat.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <p className="inline-flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Fresh weekly favourites from our kitchen
              </p>
            </div>
          </div>

          <div className="reveal-up reveal-delay-2 relative">
            <WeeklyCupcakes />
          </div>
        </div>
      </section>

      <section className="w-full px-6 pb-20 sm:px-10 lg:px-14">
        <div className="reveal-up reveal-delay-2 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
