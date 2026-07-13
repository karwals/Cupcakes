"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import { ReceiptText, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import Stepper, { Step } from "@/components/Stepper";
import { CupcakeOrderCombobox } from "@/components/cupcake-order-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CUPCAKES_UPDATED_EVENT,
  defaultWeeklyCupcakes,
  getStoredCupcakes,
  loadPublishedCupcakes,
  type WeeklyCupcake,
} from "@/lib/cupcakes";
import { cn } from "@/lib/utils";

type OrderSelection = {
  cupcakeId: string;
  cupcakeName: string;
  flavor: string;
  price: string;
};

type OrderForm = {
  name: string;
  email: string;
  phone: string;
};

const emptyOrderForm: OrderForm = {
  name: "",
  email: "",
  phone: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WeeklyCupcakes() {
  const [cupcakes, setCupcakes] = useState<WeeklyCupcake[]>(defaultWeeklyCupcakes);
  const [selectedOrder, setSelectedOrder] = useState<OrderSelection | null>(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrderForm);
  const [orderStep, setOrderStep] = useState(1);
  const [orderReference, setOrderReference] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const contactStatus = useMemo(
    () => ({
      name: orderForm.name.trim().length >= 2,
      email: emailPattern.test(orderForm.email.trim()),
      phone: orderForm.phone.replace(/\D/g, "").length >= 7,
    }),
    [orderForm],
  );
  const canReviewOrder = contactStatus.name && contactStatus.email && contactStatus.phone;

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

  useEffect(() => {
    if (!isOrderOpen || orderStep !== 1) {
      return;
    }

    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 120);

    return () => window.clearTimeout(focusTimer);
  }, [isOrderOpen, orderStep]);

  function updateOrderForm(field: keyof OrderForm) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setOrderForm((currentForm) => ({
        ...currentForm,
        [field]: event.target.value,
      }));
    };
  }

  function selectCupcakeFlavor(cupcake: WeeklyCupcake, flavor: string) {
    setOrderMessage("");
    setSelectedOrder((currentOrder) => {
      if (!flavor) {
        return currentOrder?.cupcakeId === cupcake.id ? null : currentOrder;
      }

      return {
        cupcakeId: cupcake.id,
        cupcakeName: cupcake.name,
        flavor,
        price: cupcake.price,
      };
    });
  }

  function openOrderPopup() {
    if (!selectedOrder) {
      return;
    }

    setOrderReference(createOrderReference());
    setOrderStep(1);
    setIsOrderOpen(true);
  }

  function completeOrder() {
    if (selectedOrder) {
      setOrderMessage(`Receipt created for ${selectedOrder.cupcakeName} with ${selectedOrder.flavor}.`);
    }

    setIsOrderOpen(false);
    setOrderForm(emptyOrderForm);
    setSelectedOrder(null);
    setOrderReference("");
    setOrderStep(1);
  }

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
          <CupcakeCard
            key={cupcake.id}
            cupcake={cupcake}
            selectedFlavor={selectedOrder?.cupcakeId === cupcake.id ? selectedOrder.flavor : ""}
            onFlavorChange={(flavor) => selectCupcakeFlavor(cupcake, flavor)}
          />
        ))}
        <div className="mt-auto border-t border-border/70 pt-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!selectedOrder}
            aria-describedby="order-button-help"
            onClick={openOrderPopup}
          >
            <ShoppingBag />
            Order Now
          </Button>
          <p id="order-button-help" className="mt-2 text-center text-xs text-muted-foreground">
            {selectedOrder
              ? `${selectedOrder.flavor} selected. You're ready to order.`
              : "Select a flavor above to unlock ordering."}
          </p>
          {orderMessage && (
            <p className="mt-2 rounded-md bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
              {orderMessage}
            </p>
          )}
        </div>
      </CardContent>
      <Dialog.Root open={isOrderOpen} onOpenChange={setIsOrderOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm" />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
            initialFocus={nameInputRef}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <Dialog.Title className="font-heading text-2xl leading-tight">
                  Order this week&apos;s special
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Add your details, then check the receipt before finishing.
                </Dialog.Description>
              </div>
              <Dialog.Close
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Close order popup"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <Stepper
              key={orderReference || "order-stepper"}
              initialStep={1}
              onStepChange={(step?: number) => setOrderStep(step ?? 1)}
              onFinalStepCompleted={completeOrder}
              backButtonText="Back"
              nextButtonText="Review order"
              completeButtonText="Finish order"
              disableStepIndicators
              nextButtonProps={{
                disabled: orderStep === 1 && !canReviewOrder,
                "aria-disabled": orderStep === 1 && !canReviewOrder,
              }}
            >
              <Step>
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <p className="font-medium">{selectedOrder?.cupcakeName}</p>
                    <p className="text-muted-foreground">{selectedOrder?.flavor}</p>
                  </div>
                  <div className="grid gap-3">
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-name">
                      Name
                      <Input
                        ref={nameInputRef}
                        id="order-name"
                        value={orderForm.name}
                        onChange={updateOrderForm("name")}
                        placeholder="Your name"
                        autoComplete="name"
                        aria-invalid={orderForm.name.length > 0 && !contactStatus.name}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-email">
                      Email
                      <Input
                        id="order-email"
                        type="email"
                        value={orderForm.email}
                        onChange={updateOrderForm("email")}
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={orderForm.email.length > 0 && !contactStatus.email}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-phone">
                      Phone
                      <Input
                        id="order-phone"
                        type="tel"
                        value={orderForm.phone}
                        onChange={updateOrderForm("phone")}
                        placeholder="Your phone number"
                        autoComplete="tel"
                        aria-invalid={orderForm.phone.length > 0 && !contactStatus.phone}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All three fields are needed so we can confirm pickup and availability.
                  </p>
                </div>
              </Step>

              <Step>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                      <ReceiptText className="size-4" />
                    </div>
                    <div>
                      <h3 className="font-heading text-xl leading-tight">Order receipt</h3>
                      <p className="text-xs text-muted-foreground">{orderReference}</p>
                    </div>
                  </div>
                  <dl className="grid gap-3 rounded-lg border border-border/70 bg-background/60 p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Cupcake</dt>
                      <dd className="text-right font-medium">{selectedOrder?.cupcakeName}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Flavor</dt>
                      <dd className="text-right font-medium">{selectedOrder?.flavor}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="text-right font-medium">{selectedOrder?.price}</dd>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="text-right font-medium">{orderForm.name}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="text-right font-medium">{orderForm.email}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="text-right font-medium">{orderForm.phone}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll use these details to confirm your order and availability.
                  </p>
                </div>
              </Step>
            </Stepper>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}

function CupcakeCard({
  cupcake,
  selectedFlavor,
  onFlavorChange,
}: {
  cupcake: WeeklyCupcake;
  selectedFlavor: string;
  onFlavorChange: (flavor: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-background/60 p-4 transition",
        selectedFlavor && "border-primary/50 ring-2 ring-primary/15",
      )}
    >
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
          value={selectedFlavor}
          onValueChange={onFlavorChange}
        />
      </div>
    </div>
  );
}

function createOrderReference() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `VC-${Date.now().toString().slice(-5)}-${suffix}`;
}
