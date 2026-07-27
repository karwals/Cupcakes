"use client";

import Image from "next/image";
import emailjs from "@emailjs/browser";
import { Minus, Plus, ReceiptText, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

import Stepper, { Step } from "@/components/Stepper";
import { CupcakeOrderCombobox } from "@/components/cupcake-order-combobox";
import {
  PickupTimeWheel,
  formatPickupTime,
  isPickupTimeValid,
  type PickupTime,
} from "@/components/pickup-time-wheel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWeeklyCupcakes } from "@/hooks/use-weekly-cupcakes";
import { type WeeklyCupcake } from "@/lib/cupcakes";
import { cn } from "@/lib/utils";

type OrderSelection = {
  cupcakeId: string;
  cupcakeName: string;
  flavor: string;
  price: string;
  quantity: number;
};

type OrderForm = {
  name: string;
  email: string;
  phone: string;
  pickupTime: PickupTime;
  notes: string;
};

type TextOrderFormField = Exclude<keyof OrderForm, "pickupTime">;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const quantityMinimum = 1;
const quantityMaximum = 24;
const emailJsServiceId = "service_tfeama3";
const emailJsTemplateId = "template_u4tzrun";
const emailJsPublicKey = "EZA6lstTCXvAx1ogF";
export function WeeklyCupcakes() {
  const cupcakes = useWeeklyCupcakes();
  const [selectedOrder, setSelectedOrder] = useState<OrderSelection | null>(null);
  const [quantityByCupcakeId, setQuantityByCupcakeId] = useState<Record<string, number>>({});
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(() => createEmptyOrderForm());
  const [orderStep, setOrderStep] = useState(1);
  const [orderReference, setOrderReference] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [orderErrorMessage, setOrderErrorMessage] = useState("");
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isCompletingOrderRef = useRef(false);

  const pickupTimeLabel = formatPickupTime(orderForm.pickupTime);
  const totalAmount = selectedOrder ? formatOrderTotal(selectedOrder.price, selectedOrder.quantity) : "$0.00";

  const contactStatus = useMemo(
    () => ({
      name: orderForm.name.trim().length >= 2,
      email: emailPattern.test(orderForm.email.trim()),
      pickupTime: Boolean(pickupTimeLabel),
    }),
    [orderForm.email, orderForm.name, pickupTimeLabel],
  );
  const canReviewOrder = Boolean(
    selectedOrder &&
      selectedOrder.flavor &&
      selectedOrder.quantity >= quantityMinimum &&
      contactStatus.name &&
      contactStatus.email &&
      contactStatus.pickupTime,
  );
  const canFinishOrder = canReviewOrder;

  useEffect(() => {
    if (!isOrderOpen || orderStep !== 1) {
      return;
    }

    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 120);

    return () => window.clearTimeout(focusTimer);
  }, [isOrderOpen, orderStep]);

  useEffect(() => {
    if (!isOrderOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOrderOpen]);

  useEffect(() => {
    if (!isOrderOpen) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || isSendingConfirmation) {
        return;
      }

      setIsOrderOpen(false);
      setOrderStep(1);
      setOrderErrorMessage("");
    }

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOrderOpen, isSendingConfirmation]);

  function getCupcakeQuantity(cupcakeId: string) {
    return quantityByCupcakeId[cupcakeId] ?? quantityMinimum;
  }

  function updateOrderForm<K extends TextOrderFormField>(field: K) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value as OrderForm[K];

      setOrderErrorMessage("");
      setOrderForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }));
    };
  }

  function updatePickupTime(pickupTime: PickupTime) {
    setOrderErrorMessage("");
    setOrderForm((currentForm) => ({
      ...currentForm,
      pickupTime,
    }));
  }

  function selectCupcakeFlavor(cupcake: WeeklyCupcake, flavor: string) {
    setOrderMessage("");
    setOrderErrorMessage("");
    setSelectedOrder((currentOrder) => {
      if (!flavor) {
        return currentOrder?.cupcakeId === cupcake.id ? null : currentOrder;
      }

      return {
        cupcakeId: cupcake.id,
        cupcakeName: cupcake.name,
        flavor,
        price: cupcake.price,
        quantity: getCupcakeQuantity(cupcake.id),
      };
    });
  }

  function updateCupcakeQuantity(cupcake: WeeklyCupcake, quantity: number) {
    const nextQuantity = clampQuantity(quantity);

    setQuantityByCupcakeId((currentQuantities) => ({
      ...currentQuantities,
      [cupcake.id]: nextQuantity,
    }));
    setSelectedOrder((currentOrder) =>
      currentOrder?.cupcakeId === cupcake.id
        ? {
            ...currentOrder,
            quantity: nextQuantity,
          }
        : currentOrder,
    );
  }

  function startOrder() {
    if (!selectedOrder) {
      return;
    }

    setOrderForm((currentForm) => ({
      ...currentForm,
      pickupTime: isPickupTimeValid(currentForm.pickupTime) ? currentForm.pickupTime : getDefaultPickupTime(),
    }));
    setOrderReference(createOrderReference());
    setOrderErrorMessage("");
    setOrderStep(1);
    setIsOrderOpen(true);
  }

  function cancelOrder() {
    if (isSendingConfirmation) {
      return;
    }

    setIsOrderOpen(false);
    setOrderStep(1);
    setOrderErrorMessage("");
  }

  async function completeOrder() {
    if (!selectedOrder || !canFinishOrder || isCompletingOrderRef.current) {
      return false;
    }

    isCompletingOrderRef.current = true;
    setIsSendingConfirmation(true);
    setOrderErrorMessage("");

    const completedOrder = selectedOrder;
    const completedOrderReference = orderReference;
    const completedEmail = orderForm.email.trim();
    const completedPickupTime = formatPickupTime(orderForm.pickupTime);
    const completedCollectionMethod = `Pickup at ${completedPickupTime}`;

    try {
      console.log({
        completedEmail,
        customer_email: completedEmail,
        to_email: completedEmail,
      });

      await emailjs.send(
        emailJsServiceId,
        emailJsTemplateId,
        {
          to_email: completedEmail,
          customer_email: completedEmail,
          customer_name: orderForm.name.trim(),
          order_reference: completedOrderReference,
          cupcake_name: completedOrder.cupcakeName,
          flavour: completedOrder.flavor,
          quantity: completedOrder.quantity,
          price_per_cupcake: completedOrder.price,
          total_price: formatOrderTotal(completedOrder.price, completedOrder.quantity),
          pickup_time: completedPickupTime,
          collection_method: completedCollectionMethod,
          phone: orderForm.phone.trim(),
          notes: orderForm.notes.trim(),
        },
        { publicKey: emailJsPublicKey },
      );

      setOrderMessage(
        `Receipt ${completedOrderReference} created for ${completedOrder.quantity} x ${completedOrder.cupcakeName}. A confirmation email has been sent to ${completedEmail}.`,
      );

      setIsOrderOpen(false);
      setOrderForm(createEmptyOrderForm());
      setQuantityByCupcakeId({});
      setSelectedOrder(null);
      setOrderReference("");
      setOrderStep(1);

      return true;
    } catch {
      setOrderErrorMessage("We couldn't send your confirmation email. Please check your connection and try again.");

      return false;
    } finally {
      isCompletingOrderRef.current = false;
      setIsSendingConfirmation(false);
    }
  }

  return (
    <>
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
              quantity={getCupcakeQuantity(cupcake.id)}
              onFlavorChange={(flavor) => selectCupcakeFlavor(cupcake, flavor)}
              onQuantityChange={(quantity) => updateCupcakeQuantity(cupcake, quantity)}
            />
          ))}
          <div className="mt-auto border-t border-border/70 pt-4">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!selectedOrder}
              aria-describedby="order-button-help"
              onClick={startOrder}
            >
              <ShoppingBag />
              Order Now
            </Button>
            <p id="order-button-help" className="mt-2 text-center text-xs text-muted-foreground">
              {selectedOrder
                ? `${selectedOrder.quantity} x ${selectedOrder.flavor} selected. You're ready to order.`
                : "Select a flavor above to unlock ordering."}
            </p>
            {orderMessage && (
              <p className="mt-2 rounded-md bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
                {orderMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {isOrderOpen &&
        selectedOrder &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px] sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                cancelOrder();
              }
            }}
          >
            <Stepper
              key={orderReference || "order-stepper"}
              className="order-dialog-stepper"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-dialog-title"
              initialStep={1}
              onStepChange={(step?: number) => setOrderStep(step ?? 1)}
              onFinalStepCompleted={completeOrder}
              header={
                <div className="flex items-start justify-between gap-4 px-5 pt-5">
                  <div>
                    <h2 id="order-dialog-title" className="font-heading text-2xl leading-tight">
                      Order this week&apos;s special
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your details, then check the receipt before finishing.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Cancel order"
                    disabled={isSendingConfirmation}
                    onClick={cancelOrder}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              }
              stepCircleContainerClassName="order-stepper-popup"
              backButtonProps={{
                disabled: isSendingConfirmation,
              }}
              backButtonText="Back"
              nextButtonText="Review order"
              completeButtonText={isSendingConfirmation ? "Sending confirmation..." : "Finish order"}
              disableStepIndicators
              nextButtonProps={{
                disabled:
                  (orderStep === 1 && !canReviewOrder) ||
                  (orderStep === 2 && (!canFinishOrder || isSendingConfirmation)),
                "aria-disabled":
                  (orderStep === 1 && !canReviewOrder) ||
                  (orderStep === 2 && (!canFinishOrder || isSendingConfirmation)),
              }}
            >
              <Step>
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{selectedOrder?.cupcakeName}</p>
                        <p className="text-muted-foreground">{selectedOrder?.flavor}</p>
                        <p className="text-xs text-muted-foreground">Pickup at {pickupTimeLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{totalAmount}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedOrder?.quantity ?? quantityMinimum} cupcake
                          {(selectedOrder?.quantity ?? quantityMinimum) === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                        required
                        aria-invalid={orderForm.email.length > 0 && !contactStatus.email}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium sm:col-span-2" htmlFor="order-phone">
                      Phone (optional)
                      <Input
                        id="order-phone"
                        type="tel"
                        inputMode="tel"
                        value={orderForm.phone}
                        onChange={updateOrderForm("phone")}
                        placeholder="Your phone number"
                        autoComplete="tel"
                      />
                    </label>
                  </div>

                  <PickupTimeWheel value={orderForm.pickupTime} onChange={updatePickupTime} />

                  <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-notes">
                    Notes (optional)
                    <Textarea
                      id="order-notes"
                      value={orderForm.notes}
                      onChange={updateOrderForm("notes")}
                      placeholder="Allergies, timing, or gift message"
                    />
                  </label>
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
                    <ReceiptRow label="Cupcake" value={selectedOrder?.cupcakeName ?? ""} />
                    <ReceiptRow label="Flavour" value={selectedOrder?.flavor ?? ""} />
                    <ReceiptRow label="Quantity" value={(selectedOrder?.quantity ?? quantityMinimum).toString()} />
                    <ReceiptRow label="Price per cupcake" value={selectedOrder?.price ?? ""} />
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Total price</dt>
                      <dd className="text-right font-semibold text-primary">{totalAmount}</dd>
                    </div>
                    <div className="h-px bg-border" />
                    <ReceiptRow label="Name" value={orderForm.name} />
                    <ReceiptRow label="Email" value={orderForm.email} />
                    {orderForm.phone.trim() && <ReceiptRow label="Phone" value={orderForm.phone} />}
                    <ReceiptRow label="Pickup time" value={`Pickup at ${pickupTimeLabel}`} />
                    {orderForm.notes.trim() && <ReceiptRow label="Notes" value={orderForm.notes} multiline />}
                  </dl>
                  {orderErrorMessage && (
                    <p
                      className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                      role="alert"
                    >
                      {orderErrorMessage}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll use these details to confirm your pickup and availability.
                  </p>
                </div>
              </Step>
            </Stepper>
          </div>,
          document.body,
        )}
    </>
  );
}

function CupcakeCard({
  cupcake,
  selectedFlavor,
  quantity,
  onFlavorChange,
  onQuantityChange,
}: {
  cupcake: WeeklyCupcake;
  selectedFlavor: string;
  quantity: number;
  onFlavorChange: (flavor: string) => void;
  onQuantityChange: (quantity: number) => void;
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
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Flavour</span>
          <CupcakeOrderCombobox
            options={cupcake.flavorOptions}
            placeholder="Select a flavour"
            value={selectedFlavor}
            onValueChange={onFlavorChange}
          />
        </div>
        <QuantitySelector cupcakeName={cupcake.name} quantity={quantity} onQuantityChange={onQuantityChange} />
      </div>
    </div>
  );
}

function QuantitySelector({
  cupcakeName,
  quantity,
  onQuantityChange,
}: {
  cupcakeName: string;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">Quantity</span>
      <div className="inline-grid h-10 grid-cols-[2.25rem_2.5rem_2.25rem] items-center rounded-md border border-border/70 bg-card shadow-xs">
        <button
          type="button"
          className="grid size-9 place-items-center rounded-l-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Decrease quantity for ${cupcakeName}`}
          disabled={quantity <= quantityMinimum}
          onClick={() => onQuantityChange(quantity - 1)}
        >
          <Minus className="size-4" />
        </button>
        <span className="text-center text-sm font-semibold" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-r-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Increase quantity for ${cupcakeName}`}
          disabled={quantity >= quantityMaximum}
          onClick={() => onQuantityChange(quantity + 1)}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-4", multiline ? "items-start" : "items-center")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", multiline && "max-w-[70%]")}>{value}</dd>
    </div>
  );
}

function createEmptyOrderForm(): OrderForm {
  return {
    name: "",
    email: "",
    phone: "",
    pickupTime: getDefaultPickupTime(),
    notes: "",
  };
}

function getDefaultPickupTime(): PickupTime {
  const date = new Date();
  const roundedMinutes = Math.ceil(date.getMinutes() / 15) * 15;

  date.setSeconds(0, 0);

  if (roundedMinutes === 60) {
    date.setHours(date.getHours() + 1, 0);
  } else {
    date.setMinutes(roundedMinutes);
  }

  return getPickupTimeFromDate(date);
}

function getPickupTimeFromDate(date: Date): PickupTime {
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;

  return {
    hour: hour12.toString(),
    minute: date.getMinutes().toString().padStart(2, "0"),
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function clampQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) {
    return quantityMinimum;
  }

  return Math.min(Math.max(Math.trunc(quantity), quantityMinimum), quantityMaximum);
}

function formatOrderTotal(price: string, quantity: number) {
  const unitPrice = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
  const currencyPrefix = price.trim().match(/^[^\d.-]+/)?.[0] ?? "$";

  if (!Number.isFinite(unitPrice) || quantity < 1) {
    return `${currencyPrefix}0.00`;
  }

  return `${currencyPrefix}${(unitPrice * quantity).toFixed(2)}`;
}

function createOrderReference() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `VC-${Date.now().toString().slice(-5)}-${suffix}`;
}
