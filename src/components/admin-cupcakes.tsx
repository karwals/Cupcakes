"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  normalizeCupcakePrice,
  normalizeFlavorOptions,
  validateWeeklyCupcakes,
  type WeeklyCupcake,
} from "@/lib/cupcakes";
import { cn } from "@/lib/utils";

type CupcakeForm = {
  name: string;
  blurb: string;
  price: string;
  flavorOptions: string;
};

type AuthStatus = "checking" | "authenticated" | "unauthenticated";
type SyncStatus = "idle" | "loading" | "publishing" | "success" | "error";

type AdminCupcakesResponse = {
  cupcakes?: unknown;
  message?: unknown;
  error?: unknown;
  authenticated?: unknown;
};

const emptyForm: CupcakeForm = {
  name: "",
  blurb: "",
  price: "",
  flavorOptions: "",
};

export function AdminCupcakes() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [cupcakes, setCupcakes] = useState<WeeklyCupcake[]>(defaultWeeklyCupcakes);
  const [lastPublishedSnapshot, setLastPublishedSnapshot] = useState(() =>
    getCupcakeSnapshot(defaultWeeklyCupcakes),
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("Log in to load the shared cupcake list.");
  const [form, setForm] = useState<CupcakeForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingCupcakeId, setEditingCupcakeId] = useState<string | null>(null);

  const flavorPreview = useMemo(() => normalizeFlavorOptions(form.flavorOptions), [form.flavorOptions]);
  const publishValidation = useMemo(() => validateWeeklyCupcakes(cupcakes), [cupcakes]);
  const hasLocalChanges = getCupcakeSnapshot(cupcakes) !== lastPublishedSnapshot;
  const isLoading = syncStatus === "loading";
  const isPublishing = syncStatus === "publishing";
  const isBusy = isLoading || isPublishing;
  const canSaveForm = Boolean(
    form.name.trim() &&
      form.blurb.trim() &&
      normalizeCupcakePrice(form.price) &&
      flavorPreview.length > 0 &&
      !isPublishing,
  );
  const canPublish = hasLocalChanges && publishValidation.success && !isBusy;

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const body = await readAdminResponse(response);

        if (!isMounted) {
          return;
        }

        if (body.authenticated === true) {
          setAuthStatus("authenticated");
          setSyncStatus("loading");
          setSyncMessage("Loading the shared cupcake list...");

          const result = await loadAdminCupcakesFromApi();

          if (!isMounted) {
            return;
          }

          if (result.status === "unauthenticated") {
            setAuthStatus("unauthenticated");
            setSyncStatus("error");
            setSyncMessage("Your admin session expired. Please log in again.");
            return;
          }

          setCupcakes(result.cupcakes);
          setLastPublishedSnapshot(getCupcakeSnapshot(result.cupcakes));
          setSyncStatus("success");
          setSyncMessage("Loaded the published cupcake list.");
          return;
        }

        setAuthStatus("unauthenticated");
        setSyncMessage("Log in to load the shared cupcake list.");
      } catch {
        if (isMounted) {
          setAuthStatus("unauthenticated");
          setSyncMessage("Could not check the admin session.");
        }
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoggingIn) {
      return;
    }

    setIsLoggingIn(true);
    setLoginMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: loginPassword,
        }),
      });
      const body = await readAdminResponse(response);

      if (!response.ok || body.authenticated !== true) {
        setLoginMessage(getAdminError(body, "Unable to log in."));
        return;
      }

      setLoginPassword("");
      setAuthStatus("authenticated");
      setSyncMessage("Login successful. Loading the shared cupcake list...");
      setSyncStatus("loading");

      const result = await loadAdminCupcakesFromApi();

      if (result.status === "unauthenticated") {
        handleExpiredSession();
        return;
      }

      setCupcakes(result.cupcakes);
      setLastPublishedSnapshot(getCupcakeSnapshot(result.cupcakes));
      setSyncStatus("success");
      setSyncMessage("Loaded the published cupcake list.");
    } catch {
      setLoginMessage("Unable to log in right now.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    if (isBusy) {
      return;
    }

    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });
    } finally {
      setAuthStatus("unauthenticated");
      setSyncStatus("idle");
      setSyncMessage("Logged out.");
      setLoginMessage("");
    }
  }

  async function refreshCupcakes() {
    if (isPublishing) {
      return;
    }

    if (hasLocalChanges && !window.confirm("Reload the published list and discard local changes?")) {
      return;
    }

    setSyncStatus("loading");
    setSyncMessage("Loading the published cupcake list...");

    try {
      const result = await loadAdminCupcakesFromApi();

      if (result.status === "unauthenticated") {
        handleExpiredSession();
        return;
      }

      setCupcakes(result.cupcakes);
      setLastPublishedSnapshot(getCupcakeSnapshot(result.cupcakes));
      setEditingCupcakeId(null);
      setForm(emptyForm);
      setFormError("");
      setSyncStatus("success");
      setSyncMessage("Loaded the published cupcake list.");
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(getErrorMessage(error, "Could not load the cupcake list."));
    }
  }

  async function publishCupcakes() {
    if (isBusy || !hasLocalChanges) {
      return;
    }

    const validation = validateWeeklyCupcakes(cupcakes);

    if (!validation.success) {
      setSyncStatus("error");
      setSyncMessage(validation.error);
      return;
    }

    setSyncStatus("publishing");
    setSyncMessage("Publishing changes to GitHub...");

    try {
      const response = await fetch("/api/admin/cupcakes", {
        method: "PUT",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.cupcakes),
      });
      const body = await readAdminResponse(response);

      if (response.status === 401) {
        handleExpiredSession();
        return;
      }

      if (!response.ok) {
        throw new Error(getAdminError(body, "Could not publish cupcakes."));
      }

      const responseValidation = validateWeeklyCupcakes(body.cupcakes);

      if (!responseValidation.success) {
        throw new Error(responseValidation.error);
      }

      setCupcakes(responseValidation.cupcakes);
      setLastPublishedSnapshot(getCupcakeSnapshot(responseValidation.cupcakes));
      setSyncStatus("success");
      setSyncMessage(
        typeof body.message === "string"
          ? body.message
          : "Published to GitHub. Netlify may take a short time to redeploy.",
      );
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(getErrorMessage(error, "Could not publish cupcakes."));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPublishing) {
      return;
    }

    const cupcake = buildCupcakeFromForm(
      form,
      editingCupcakeId ?? createCupcakeId(form.name, cupcakes.map((currentCupcake) => currentCupcake.id)),
    );

    if (!cupcake.success) {
      setFormError(cupcake.error);
      return;
    }

    const nextCupcakes = editingCupcakeId
      ? cupcakes.map((currentCupcake) =>
          currentCupcake.id === editingCupcakeId ? cupcake.cupcake : currentCupcake,
        )
      : [...cupcakes, cupcake.cupcake];
    const validation = validateWeeklyCupcakes(nextCupcakes);

    if (!validation.success) {
      setFormError(validation.error);
      return;
    }

    setCupcakes(validation.cupcakes);
    setEditingCupcakeId(null);
    setForm(emptyForm);
    setFormError("");
    setSyncStatus("idle");
    setSyncMessage("Saved locally. Publish changes when you are ready.");
  }

  function startEditing(cupcake: WeeklyCupcake) {
    if (isPublishing) {
      return;
    }

    setEditingCupcakeId(cupcake.id);
    setForm({
      name: cupcake.name,
      blurb: cupcake.blurb,
      price: cupcake.price,
      flavorOptions: cupcake.flavorOptions.join("\n"),
    });
    setFormError("");
    setSyncStatus("idle");
    setSyncMessage(`Editing ${cupcake.name}. Save the edit locally before publishing.`);
  }

  function cancelEdit() {
    setEditingCupcakeId(null);
    setForm(emptyForm);
    setFormError("");
    setSyncMessage("Edit cancelled.");
  }

  function deleteCupcake(cupcake: WeeklyCupcake) {
    if (isPublishing) {
      return;
    }

    if (!window.confirm(`Delete ${cupcake.name}?`)) {
      return;
    }

    const nextCupcakes = cupcakes.filter((currentCupcake) => currentCupcake.id !== cupcake.id);

    setCupcakes(nextCupcakes);
    setEditingCupcakeId((currentId) => (currentId === cupcake.id ? null : currentId));
    setSyncStatus("idle");
    setSyncMessage(
      nextCupcakes.length > 0
        ? "Deleted locally. Publish changes when you are ready."
        : "Deleted locally. Add or reset to at least one cupcake before publishing.",
    );
  }

  function resetCupcakes() {
    if (isPublishing) {
      return;
    }

    if (!window.confirm("Reset the local draft to the default cupcake list?")) {
      return;
    }

    setCupcakes(defaultWeeklyCupcakes);
    setEditingCupcakeId(null);
    setForm(emptyForm);
    setFormError("");
    setSyncStatus("idle");
    setSyncMessage("Default list restored locally. Publish changes when you are ready.");
  }

  function normalizePriceField() {
    const normalizedPrice = normalizeCupcakePrice(form.price);

    if (normalizedPrice) {
      setForm({ ...form, price: normalizedPrice });
    }
  }

  function handleExpiredSession() {
    setAuthStatus("unauthenticated");
    setSyncStatus("error");
    setSyncMessage("Your admin session expired. Please log in again.");
  }

  if (authStatus !== "authenticated") {
    return (
      <main className="min-h-screen bg-linear-to-b from-background via-muted/30 to-background">
        <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-6 py-8">
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
          <Card className="rounded-2xl border-border/70 bg-card/90">
            <CardHeader className="pb-4">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle>Admin login</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter the admin password to manage the weekly cupcake list.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleLogin}>
                <label className="grid gap-2 text-sm font-medium">
                  Password
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="Admin password"
                    autoComplete="current-password"
                    disabled={authStatus === "checking" || isLoggingIn}
                  />
                </label>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={authStatus === "checking" || isLoggingIn || !loginPassword}
                >
                  <KeyRound className="h-4 w-4" />
                  {authStatus === "checking" || isLoggingIn ? "Checking..." : "Log in"}
                </Button>
                {(loginMessage || syncMessage) && (
                  <p
                    className={cn(
                      "text-sm font-medium",
                      loginMessage ? "text-destructive" : "text-muted-foreground",
                    )}
                    role={loginMessage ? "alert" : undefined}
                  >
                    {loginMessage || syncMessage}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

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
                Edit the featured cupcakes locally, then publish the draft when it is ready for everyone.
              </p>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm sm:grid-cols-2">
            <Metric label="Active cupcakes" value={cupcakes.length.toString()} />
            <Metric label="Draft status" value={hasLocalChanges ? "Local" : "Published"} />
          </div>
        </header>

        <Card className="rounded-2xl border-border/70 bg-card/90">
          <CardHeader className="pb-4">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle>Publishing</CardTitle>
            <p className="text-sm text-muted-foreground">
              GitHub accepts the update first. Netlify may take a short time to redeploy the new JSON file.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={cn(
                    hasLocalChanges ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900",
                  )}
                >
                  {hasLocalChanges ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {hasLocalChanges ? "Local changes" : "Published"}
                </Badge>
                {!publishValidation.success && (
                  <Badge variant="outline" className="text-destructive">
                    {publishValidation.error}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => void refreshCupcakes()} disabled={isBusy}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Reload published
                </Button>
                <Button type="button" onClick={() => void publishCupcakes()} disabled={!canPublish}>
                  <UploadCloud className={cn("h-4 w-4", isPublishing && "animate-pulse")} />
                  {isPublishing ? "Publishing..." : "Publish changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void logout()} disabled={isBusy}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
            <p className={cn("text-sm font-medium", getSyncStatusClassName(syncStatus))}>
              {syncMessage}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="rounded-2xl border-border/70 bg-card/90">
            <CardHeader className="pb-4">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <CardTitle>{editingCupcakeId ? "Edit cupcake" : "Add a new cupcake"}</CardTitle>
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
                    disabled={isPublishing}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Blurb
                  <Textarea
                    value={form.blurb}
                    onChange={(event) => setForm({ ...form, blurb: event.target.value })}
                    placeholder="Brown sugar sponge with salted caramel buttercream."
                    className="min-h-24"
                    disabled={isPublishing}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Price
                  <Input
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                    onBlur={normalizePriceField}
                    placeholder="$8.00"
                    disabled={isPublishing}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Flavor options
                  <Textarea
                    value={form.flavorOptions}
                    onChange={(event) => setForm({ ...form, flavorOptions: event.target.value })}
                    placeholder={"Classic swirl\nExtra filling\nNo sprinkles"}
                    className="min-h-28"
                    disabled={isPublishing}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  {flavorPreview.map((option) => (
                    <Badge key={option} variant="secondary">
                      {option}
                    </Badge>
                  ))}
                </div>

                {formError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
                    {formError}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" size="lg" disabled={!canSaveForm}>
                    <Save className="h-4 w-4" />
                    {editingCupcakeId ? "Save edit" : "Add cupcake"}
                  </Button>
                  {editingCupcakeId ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={isPublishing}
                    >
                      Cancel edit
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        setForm(emptyForm);
                        setFormError("");
                      }}
                      disabled={isPublishing}
                    >
                      Clear form
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-heading text-3xl leading-tight">Current cupcakes</h2>
                <p className="text-sm text-muted-foreground">
                  These are the cupcakes in the current admin draft.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={resetCupcakes} disabled={isPublishing}>
                <RotateCcw className="h-4 w-4" />
                Reset default
              </Button>
            </div>

            <div className="grid gap-4">
              {cupcakes.length === 0 && (
                <div className="rounded-2xl border border-border/70 bg-card/90 p-5 text-sm text-muted-foreground shadow-sm">
                  Add or reset to at least one cupcake before publishing.
                </div>
              )}
              {cupcakes.map((cupcake) => (
                <article
                  key={cupcake.id}
                  className={cn(
                    "rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm",
                    editingCupcakeId === cupcake.id && "border-primary/50 ring-2 ring-primary/15",
                  )}
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
                        <Badge variant="outline">{cupcake.id}</Badge>
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
                    <div className="flex gap-2 sm:flex-col">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Edit ${cupcake.name}`}
                        disabled={isPublishing}
                        onClick={() => startEditing(cupcake)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label={`Delete ${cupcake.name}`}
                        disabled={isPublishing}
                        onClick={() => deleteCupcake(cupcake)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

function buildCupcakeFromForm(form: CupcakeForm, id: string) {
  const cupcake = {
    id,
    name: form.name,
    blurb: form.blurb,
    price: form.price,
    flavorOptions: normalizeFlavorOptions(form.flavorOptions),
  };
  const validation = validateWeeklyCupcakes([cupcake]);

  if (!validation.success) {
    return {
      success: false as const,
      error: validation.error.replace("Cupcake 1 ", ""),
    };
  }

  return {
    success: true as const,
    cupcake: validation.cupcakes[0],
  };
}

function getCupcakeSnapshot(cupcakes: WeeklyCupcake[]) {
  return JSON.stringify(cupcakes);
}

async function loadAdminCupcakesFromApi() {
  const response = await fetch("/api/admin/cupcakes", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await readAdminResponse(response);

  if (response.status === 401) {
    return {
      status: "unauthenticated" as const,
    };
  }

  if (!response.ok) {
    throw new Error(getAdminError(body, "Could not load the cupcake list."));
  }

  const validation = validateWeeklyCupcakes(body.cupcakes);

  if (!validation.success) {
    throw new Error(validation.error);
  }

  return {
    status: "success" as const,
    cupcakes: validation.cupcakes,
  };
}

async function readAdminResponse(response: Response): Promise<AdminCupcakesResponse> {
  try {
    const body = (await response.json()) as unknown;

    if (body && typeof body === "object") {
      return body as AdminCupcakesResponse;
    }
  } catch {
    return {};
  }

  return {};
}

function getAdminError(body: AdminCupcakesResponse, fallback: string) {
  return typeof body.error === "string" ? body.error : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSyncStatusClassName(status: SyncStatus) {
  if (status === "success") {
    return "text-emerald-700";
  }

  if (status === "error") {
    return "text-destructive";
  }

  return "text-muted-foreground";
}
