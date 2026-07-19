"use client";

import Image from "next/image";
import { Minus, Plus, ReceiptText, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

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

type PickupPeriod = "AM" | "PM";

type PickupTime = {
  hour: string;
  minute: string;
  period: PickupPeriod;
};

type OrderForm = {
  name: string;
  email: string;
  phone: string;
  pickupTime: PickupTime;
  notes: string;
  whatsappConsent: boolean;
};

type TextOrderFormField = Exclude<keyof OrderForm, "pickupTime" | "whatsappConsent">;
type SendWhatsAppResponse =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

type PhoneStatus =
  | {
      status: "empty";
      value: "";
      error: "";
    }
  | {
      status: "valid";
      value: string;
      error: "";
    }
  | {
      status: "invalid";
      value: "";
      error: string;
    };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const quantityMinimum = 1;
const quantityMaximum = 24;
const pickupHours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
const pickupMinutes = ["00", "15", "30", "45"] as const;
const pickupPeriods = ["AM", "PM"] as const;

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

  const phoneStatus = useMemo(() => normalizeWhatsAppNumber(orderForm.phone), [orderForm.phone]);
  const pickupTimeLabel = formatPickupTime(orderForm.pickupTime);
  const totalAmount = selectedOrder ? formatOrderTotal(selectedOrder.price, selectedOrder.quantity) : "$0.00";

  const contactStatus = useMemo(
    () => ({
      name: orderForm.name.trim().length >= 2,
      email: !orderForm.email.trim() || emailPattern.test(orderForm.email.trim()),
      whatsapp: phoneStatus.status === "valid",
      pickupTime: Boolean(pickupTimeLabel),
    }),
    [orderForm.email, orderForm.name, phoneStatus.status, pickupTimeLabel],
  );
  const canReviewOrder = Boolean(
    selectedOrder &&
      selectedOrder.flavor &&
      selectedOrder.quantity >= quantityMinimum &&
      contactStatus.name &&
      contactStatus.email &&
      contactStatus.whatsapp &&
      contactStatus.pickupTime,
  );
  const canFinishOrder = canReviewOrder && orderForm.whatsappConsent;

  useEffect(() => {
    if (!isOrderOpen || orderStep !== 1) {
      return;
    }

    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 120);

    return () => window.clearTimeout(focusTimer);
  }, [isOrderOpen, orderStep]);

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

  function updateWhatsAppConsent(event: ChangeEvent<HTMLInputElement>) {
    setOrderErrorMessage("");
    setOrderForm((currentForm) => ({
      ...currentForm,
      whatsappConsent: event.target.checked,
    }));
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
    if (!selectedOrder || !canFinishOrder || isCompletingOrderRef.current || phoneStatus.status !== "valid") {
      return false;
    }

    isCompletingOrderRef.current = true;
    setIsSendingConfirmation(true);
    setOrderErrorMessage("");

    const completedOrder = selectedOrder;
    const completedOrderReference = orderReference;
    const completedWhatsAppNumber = phoneStatus.value;
    const completedPickupTime = formatPickupTime(orderForm.pickupTime);
    const completedCollectionMethod = `Pickup at ${completedPickupTime}`;

    try {
      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: completedWhatsAppNumber,
          customerName: orderForm.name.trim(),
          orderReference: completedOrderReference,
          cupcakeName: completedOrder.cupcakeName,
          flavour: completedOrder.flavor,
          quantity: completedOrder.quantity,
          collectionMethod: completedCollectionMethod,
        }),
      });
      const responseBody = await readSendWhatsAppResponse(response);

      if (!response.ok || !responseBody?.success) {
        setOrderErrorMessage(
          responseBody && !responseBody.success
            ? responseBody.error
            : "Unable to send the WhatsApp confirmation. Please try again.",
        );

        return false;
      }

      setOrderMessage(
        `Receipt ${completedOrderReference} created for ${completedOrder.quantity} x ${completedOrder.cupcakeName}. WhatsApp confirmation sent to ${completedWhatsAppNumber}.`,
      );

      setIsOrderOpen(false);
      setOrderForm(createEmptyOrderForm());
      setQuantityByCupcakeId({});
      setSelectedOrder(null);
      setOrderReference("");
      setOrderStep(1);

      return true;
    } catch {
      setOrderErrorMessage("Unable to send the WhatsApp confirmation. Please check your connection and try again.");

      return false;
    } finally {
      isCompletingOrderRef.current = false;
      setIsSendingConfirmation(false);
    }
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
      {isOrderOpen && selectedOrder && (
        <section className="border-t border-border/70 bg-background/45 px-4 py-5 sm:px-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-heading text-2xl leading-tight">Order this week&apos;s special</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your details, then check the receipt before finishing.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cancel order"
              disabled={isSendingConfirmation}
              onClick={cancelOrder}
            >
              <X className="size-4" />
            </Button>
          </div>

          <Stepper
              key={orderReference || "order-stepper"}
              initialStep={1}
              onStepChange={(step?: number) => setOrderStep(step ?? 1)}
              onFinalStepCompleted={completeOrder}
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
                      Email (optional)
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
                    <label className="grid gap-1.5 text-sm font-medium sm:col-span-2" htmlFor="order-phone">
                      WhatsApp number
                      <Input
                        id="order-phone"
                        type="tel"
                        inputMode="tel"
                        value={orderForm.phone}
                        onChange={updateOrderForm("phone")}
                        placeholder="0225150330"
                        autoComplete="tel"
                        aria-describedby="order-whatsapp-preview order-whatsapp-error"
                        aria-invalid={orderForm.phone.length > 0 && phoneStatus.status === "invalid"}
                      />
                      <span
                        id="order-whatsapp-preview"
                        className={cn(
                          "text-xs",
                          phoneStatus.status === "valid" ? "font-medium text-primary" : "text-muted-foreground",
                        )}
                      >
                        {phoneStatus.status === "valid"
                          ? `WhatsApp confirmation will be sent to ${phoneStatus.value}`
                          : "Enter a New Zealand mobile number or an international number starting with +."}
                      </span>
                      {phoneStatus.status === "invalid" && (
                        <span id="order-whatsapp-error" className="text-xs font-medium text-destructive" role="alert">
                          {phoneStatus.error}
                        </span>
                      )}
                    </label>
                  </div>

                  <PickupTimePicker value={orderForm.pickupTime} onChange={updatePickupTime} />

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
                    {orderForm.email.trim() && <ReceiptRow label="Email" value={orderForm.email} />}
                    <ReceiptRow label="WhatsApp number" value={phoneStatus.status === "valid" ? phoneStatus.value : ""} />
                    <ReceiptRow label="Pickup time" value={`Pickup at ${pickupTimeLabel}`} />
                    {orderForm.notes.trim() && <ReceiptRow label="Notes" value={orderForm.notes} multiline />}
                  </dl>
                  <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-4 text-sm font-medium">
                    <input
                      id="order-whatsapp-consent"
                      type="checkbox"
                      checked={orderForm.whatsappConsent}
                      onChange={updateWhatsAppConsent}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>
                      I agree to receive order confirmations and updates from Cupcakes through WhatsApp.
                    </span>
                  </label>
                  {!orderForm.whatsappConsent && (
                    <p className="text-xs text-muted-foreground">
                      WhatsApp consent is required before finishing the order.
                    </p>
                  )}
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
        </section>
      )}
    </Card>
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

function PickupTimePicker({
  value,
  onChange,
}: {
  value: PickupTime;
  onChange: (value: PickupTime) => void;
}) {
  const readableTime = formatPickupTime(value);

  return (
    <fieldset className="grid gap-3" aria-describedby="pickup-time-preview">
      <legend className="text-sm font-medium">Choose pickup time</legend>
      <div className="relative grid grid-cols-3 gap-2 rounded-lg border border-border/70 bg-background/60 p-2">
        <div
          className="pointer-events-none absolute left-2 right-2 top-1/2 h-10 -translate-y-1/2 rounded-md border border-primary/25 bg-primary/10"
          aria-hidden="true"
        />
        <TimeWheelColumn
          label="Pickup hour"
          options={pickupHours}
          value={value.hour}
          onChange={(hour) => onChange({ ...value, hour })}
        />
        <TimeWheelColumn
          label="Pickup minute"
          options={pickupMinutes}
          value={value.minute}
          onChange={(minute) => onChange({ ...value, minute })}
        />
        <TimeWheelColumn
          label="Pickup period"
          options={pickupPeriods}
          value={value.period}
          onChange={(period) => onChange({ ...value, period })}
        />
      </div>
      <p id="pickup-time-preview" className="text-xs font-medium text-primary">
        Pickup at {readableTime}
      </p>
    </fieldset>
  );
}

function TimeWheelColumn<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollFrameRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const selectedIndex = Math.max(options.indexOf(value), 0);

  useEffect(() => {
    const selectedButton = optionRefs.current[selectedIndex];

    if (!selectedButton) {
      return;
    }

    programmaticScrollRef.current = true;
    selectedButton.scrollIntoView({ block: "center" });

    const resetTimer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 120);

    return () => window.clearTimeout(resetTimer);
  }, [selectedIndex]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  function handleScroll() {
    if (programmaticScrollRef.current) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestIndex = selectedIndex;
      let closestDistance = Number.POSITIVE_INFINITY;

      optionRefs.current.forEach((button, index) => {
        if (!button) {
          return;
        }

        const buttonRect = button.getBoundingClientRect();
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        const distance = Math.abs(buttonCenterY - centerY);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      const closestOption = options[closestIndex];

      if (closestOption && closestOption !== value) {
        onChange(closestOption);
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, option: T) {
    const optionIndex = options.indexOf(option);
    let nextIndex = optionIndex;

    if (event.key === "ArrowDown") {
      nextIndex = Math.min(optionIndex + 1, options.length - 1);
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(optionIndex - 1, 0);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    onChange(options[nextIndex]);
  }

  return (
    <div className="relative z-10">
      <span className="sr-only">{label}</span>
      <div
        ref={containerRef}
        className="h-36 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md py-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={label}
        onScroll={handleScroll}
      >
        {options.map((option, optionIndex) => {
          const distance = Math.abs(optionIndex - selectedIndex);
          const isSelected = option === value;

          return (
            <button
              key={option}
              ref={(node) => {
                optionRefs.current[optionIndex] = node;
              }}
              type="button"
              className={cn(
                "my-1 flex h-9 w-full snap-center items-center justify-center rounded-md text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected
                  ? "bg-background text-foreground shadow-sm ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                distance === 1 && !isSelected && "opacity-75",
                distance > 1 && "opacity-45",
              )}
              aria-pressed={isSelected}
              aria-label={`${label}: ${option}`}
              onClick={() => onChange(option)}
              onKeyDown={(event) => handleKeyDown(event, option)}
            >
              {option}
            </button>
          );
        })}
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
    whatsappConsent: false,
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

function isPickupTimeValid(value: PickupTime) {
  return (
    pickupHours.some((hour) => hour === value.hour) &&
    pickupMinutes.some((minute) => minute === value.minute) &&
    pickupPeriods.some((period) => period === value.period)
  );
}

function formatPickupTime(value: PickupTime) {
  if (!isPickupTimeValid(value)) {
    return "";
  }

  return `${Number(value.hour)}:${value.minute} ${value.period}`;
}

function clampQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) {
    return quantityMinimum;
  }

  return Math.min(Math.max(Math.trunc(quantity), quantityMinimum), quantityMaximum);
}

function normalizeWhatsAppNumber(value: string): PhoneStatus {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      status: "empty",
      value: "",
      error: "",
    };
  }

  const compactValue = trimmedValue.replace(/[\s().-]/g, "");

  if (compactValue.startsWith("+")) {
    if (!/^\+\d+$/.test(compactValue)) {
      return invalidPhoneNumber();
    }

    return toPhoneStatus(compactValue);
  }

  if (/[A-Za-z]/.test(trimmedValue)) {
    return invalidPhoneNumber();
  }

  const digits = trimmedValue.replace(/\D/g, "");

  if (!digits) {
    return invalidPhoneNumber();
  }

  if (digits.startsWith("0")) {
    return toPhoneStatus(`+64${digits.replace(/^0+/, "")}`);
  }

  if (digits.startsWith("64")) {
    return toPhoneStatus(`+${digits}`);
  }

  if (digits.startsWith("2")) {
    return toPhoneStatus(`+64${digits}`);
  }

  return invalidPhoneNumber();
}

function toPhoneStatus(phoneNumber: string): PhoneStatus {
  if (!isInternationalMobile(phoneNumber)) {
    return invalidPhoneNumber();
  }

  return {
    status: "valid",
    value: phoneNumber,
    error: "",
  };
}

function invalidPhoneNumber(): PhoneStatus {
  return {
    status: "invalid",
    value: "",
    error: "Enter a valid New Zealand mobile number or an international number starting with +.",
  };
}

function isInternationalMobile(mobileNumber: string) {
  return /^\+[1-9]\d{7,14}$/.test(mobileNumber);
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

async function readSendWhatsAppResponse(response: Response): Promise<SendWhatsAppResponse | null> {
  try {
    const body = (await response.json()) as unknown;

    if (isSendWhatsAppResponse(body)) {
      return body;
    }

    return null;
  } catch {
    return null;
  }
}

function isSendWhatsAppResponse(value: unknown): value is SendWhatsAppResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }

  if (value.success) {
    return typeof value.message === "string";
  }

  return typeof value.error === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
