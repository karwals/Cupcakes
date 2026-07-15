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
import { Textarea } from "@/components/ui/textarea";
import { useWeeklyCupcakes } from "@/hooks/use-weekly-cupcakes";
import { type WeeklyCupcake } from "@/lib/cupcakes";
import { cn } from "@/lib/utils";

type OrderSelection = {
  cupcakeId: string;
  cupcakeName: string;
  flavor: string;
  price: string;
};

type CountryCode = "+64" | "+61" | "+91";
type FulfillmentType = "delivery" | "pickup";

type OrderForm = {
  name: string;
  email: string;
  countryCode: CountryCode;
  phone: string;
  quantity: string;
  fulfillmentType: FulfillmentType;
  fulfillmentDetails: string;
  notes: string;
  whatsappConsent: boolean;
};

type TextOrderFormField = Exclude<keyof OrderForm, "whatsappConsent">;
type SendWhatsAppResponse =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

const emptyOrderForm: OrderForm = {
  name: "",
  email: "",
  countryCode: "+64",
  phone: "",
  quantity: "1",
  fulfillmentType: "pickup",
  fulfillmentDetails: "",
  notes: "",
  whatsappConsent: false,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const countryCodeOptions: { value: CountryCode; label: string }[] = [
  { value: "+64", label: "+64 New Zealand" },
  { value: "+61", label: "+61 Australia" },
  { value: "+91", label: "+91 India" },
];
const fulfillmentOptions: { value: FulfillmentType; label: string }[] = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
];

export function WeeklyCupcakes() {
  const cupcakes = useWeeklyCupcakes();
  const [selectedOrder, setSelectedOrder] = useState<OrderSelection | null>(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrderForm);
  const [orderStep, setOrderStep] = useState(1);
  const [orderReference, setOrderReference] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [orderErrorMessage, setOrderErrorMessage] = useState("");
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isCompletingOrderRef = useRef(false);

  const whatsappNumber = useMemo(
    () => formatInternationalMobile(orderForm.countryCode, orderForm.phone),
    [orderForm.countryCode, orderForm.phone],
  );
  const orderQuantity = getOrderQuantity(orderForm.quantity);
  const totalAmount = selectedOrder ? formatOrderTotal(selectedOrder.price, orderQuantity) : "$0.00";

  const contactStatus = useMemo(
    () => ({
      name: orderForm.name.trim().length >= 2,
      email: !orderForm.email.trim() || emailPattern.test(orderForm.email.trim()),
      whatsapp: isInternationalMobile(whatsappNumber),
      quantity: orderQuantity > 0,
      fulfillmentDetails: orderForm.fulfillmentDetails.trim().length >= 3,
    }),
    [orderForm.email, orderForm.fulfillmentDetails, orderForm.name, orderQuantity, whatsappNumber],
  );
  const canReviewOrder =
    contactStatus.name &&
    contactStatus.email &&
    contactStatus.whatsapp &&
    contactStatus.quantity &&
    contactStatus.fulfillmentDetails;
  const canFinishOrder = canReviewOrder && orderForm.whatsappConsent;

  useEffect(() => {
    if (!isOrderOpen || orderStep !== 1) {
      return;
    }

    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 120);

    return () => window.clearTimeout(focusTimer);
  }, [isOrderOpen, orderStep]);

  function updateOrderForm<K extends TextOrderFormField>(field: K) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      };
    });
  }

  function openOrderPopup() {
    if (!selectedOrder) {
      return;
    }

    setOrderReference(createOrderReference());
    setOrderErrorMessage("");
    setOrderStep(1);
    setIsOrderOpen(true);
  }

  function handleOrderOpenChange(open: boolean) {
    if (isSendingConfirmation && !open) {
      return;
    }

    setIsOrderOpen(open);
  }

  async function completeOrder() {
    if (!selectedOrder || !canFinishOrder || isCompletingOrderRef.current) {
      return false;
    }

    isCompletingOrderRef.current = true;
    setIsSendingConfirmation(true);
    setOrderErrorMessage("");

    const completedCupcakeName = selectedOrder.cupcakeName;
    const completedOrderQuantity = orderQuantity;
    const completedOrderReference = orderReference;
    const completedWhatsAppNumber = whatsappNumber;

    try {
      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: completedWhatsAppNumber,
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
        `Receipt ${completedOrderReference} created for ${completedOrderQuantity} x ${completedCupcakeName}. WhatsApp confirmation sent to ${completedWhatsAppNumber}.`,
      );

      setIsOrderOpen(false);
      setOrderForm(emptyOrderForm);
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
      <Dialog.Root open={isOrderOpen} onOpenChange={handleOrderOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm" />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
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
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close order popup"
                disabled={isSendingConfirmation}
              >
                <X className="size-4" />
              </Dialog.Close>
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
                      </div>
                      <p className="font-semibold text-primary">{totalAmount}</p>
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
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-quantity">
                      Quantity
                      <Input
                        id="order-quantity"
                        type="number"
                        min="1"
                        max="99"
                        step="1"
                        value={orderForm.quantity}
                        onChange={updateOrderForm("quantity")}
                        placeholder="1"
                        aria-invalid={orderForm.quantity.length > 0 && !contactStatus.quantity}
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
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-country-code">
                      Country code
                      <select
                        id="order-country-code"
                        value={orderForm.countryCode}
                        onChange={updateOrderForm("countryCode")}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {countryCodeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium sm:col-span-2" htmlFor="order-phone">
                      WhatsApp number
                      <Input
                        id="order-phone"
                        type="tel"
                        value={orderForm.phone}
                        onChange={updateOrderForm("phone")}
                        placeholder="+64225150330"
                        autoComplete="tel"
                        aria-describedby="order-whatsapp-help order-whatsapp-number"
                        aria-invalid={orderForm.phone.length > 0 && !contactStatus.whatsapp}
                      />
                      <span id="order-whatsapp-help" className="text-xs text-muted-foreground">
                        Enter your WhatsApp number with country code, for example +64225150330.
                      </span>
                      <span id="order-whatsapp-number" className="text-xs text-muted-foreground">
                        Stored as {whatsappNumber || `${orderForm.countryCode}...`}
                      </span>
                    </label>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <span className="text-sm font-medium">Delivery or pickup</span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {fulfillmentOptions.map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              "flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition",
                              orderForm.fulfillmentType === option.value && "border-primary/50 bg-primary/5",
                            )}
                          >
                            <input
                              type="radio"
                              name="order-fulfillment"
                              value={option.value}
                              checked={orderForm.fulfillmentType === option.value}
                              onChange={updateOrderForm("fulfillmentType")}
                              className="size-4 accent-primary"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="order-fulfillment-details">
                      {orderForm.fulfillmentType === "delivery" ? "Delivery address" : "Pickup details"}
                      <Textarea
                        id="order-fulfillment-details"
                        value={orderForm.fulfillmentDetails}
                        onChange={updateOrderForm("fulfillmentDetails")}
                        placeholder={
                          orderForm.fulfillmentType === "delivery"
                            ? "Street address and suburb"
                            : "Preferred pickup date and time"
                        }
                        aria-invalid={orderForm.fulfillmentDetails.length > 0 && !contactStatus.fulfillmentDetails}
                      />
                    </label>
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
                      <dt className="text-muted-foreground">Items</dt>
                      <dd className="text-right font-medium">
                        {orderQuantity} x {selectedOrder?.cupcakeName}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Flavor</dt>
                      <dd className="text-right font-medium">{selectedOrder?.flavor}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Unit price</dt>
                      <dd className="text-right font-medium">{selectedOrder?.price}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Total</dt>
                      <dd className="text-right font-semibold text-primary">{totalAmount}</dd>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="text-right font-medium">{orderForm.name}</dd>
                    </div>
                    {orderForm.email.trim() && (
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Email</dt>
                        <dd className="text-right font-medium">{orderForm.email}</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Country code</dt>
                      <dd className="text-right font-medium">{orderForm.countryCode}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">WhatsApp</dt>
                      <dd className="text-right font-medium">{whatsappNumber}</dd>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {orderForm.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                      </dt>
                      <dd className="max-w-[70%] text-right font-medium">{orderForm.fulfillmentDetails}</dd>
                    </div>
                    {orderForm.notes.trim() && (
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-muted-foreground">Notes</dt>
                        <dd className="max-w-[70%] text-right font-medium">{orderForm.notes}</dd>
                      </div>
                    )}
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

function getOrderQuantity(quantity: string) {
  const parsedQuantity = Number.parseInt(quantity, 10);

  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    return 0;
  }

  return Math.min(parsedQuantity, 99);
}

function formatInternationalMobile(countryCode: CountryCode, mobileNumber: string) {
  const trimmedMobileNumber = mobileNumber.trim();
  const mobileDigits = trimmedMobileNumber.replace(/\D/g, "");
  const countryDigits = countryCode.replace(/\D/g, "");

  if (!mobileDigits) {
    return "";
  }

  if (trimmedMobileNumber.startsWith("+")) {
    return `+${mobileDigits.replace(/^0+/, "")}`;
  }

  if (mobileDigits.startsWith("00")) {
    return `+${mobileDigits.replace(/^00+/, "")}`;
  }

  if (mobileDigits.startsWith(countryDigits)) {
    return `+${mobileDigits}`;
  }

  return `${countryCode}${mobileDigits.replace(/^0+/, "")}`;
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
