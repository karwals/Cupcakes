export type WeeklyCupcake = {
  id: string;
  name: string;
  blurb: string;
  price: string;
  flavorOptions: string[];
};

export const CUPCAKES_STORAGE_KEY = "velvet-crumb-weekly-cupcakes";
export const CUPCAKES_UPDATED_EVENT = "velvet-crumb-cupcakes-updated";

export const defaultWeeklyCupcakes: WeeklyCupcake[] = [
  {
    id: "banana-bliss",
    name: "Banana Bliss",
    blurb: "Soft banana sponge, vanilla filling, and fluffy buttercream.",
    price: "$7.50",
    flavorOptions: ["Chocolate chips", "No chocolate chips"],
  },
];

function isWeeklyCupcake(value: unknown): value is WeeklyCupcake {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cupcake = value as WeeklyCupcake;

  return (
    typeof cupcake.id === "string" &&
    typeof cupcake.name === "string" &&
    typeof cupcake.blurb === "string" &&
    typeof cupcake.price === "string" &&
    Array.isArray(cupcake.flavorOptions) &&
    cupcake.flavorOptions.every((option) => typeof option === "string")
  );
}

export function getStoredCupcakes() {
  if (typeof window === "undefined") {
    return defaultWeeklyCupcakes;
  }

  const savedCupcakes = window.localStorage.getItem(CUPCAKES_STORAGE_KEY);

  if (!savedCupcakes) {
    return defaultWeeklyCupcakes;
  }

  try {
    const parsedCupcakes = JSON.parse(savedCupcakes);

    if (Array.isArray(parsedCupcakes) && parsedCupcakes.every(isWeeklyCupcake)) {
      return parsedCupcakes.length > 0 ? parsedCupcakes : defaultWeeklyCupcakes;
    }
  } catch {
    return defaultWeeklyCupcakes;
  }

  return defaultWeeklyCupcakes;
}

export function saveStoredCupcakes(cupcakes: WeeklyCupcake[]) {
  window.localStorage.setItem(CUPCAKES_STORAGE_KEY, JSON.stringify(cupcakes));
  window.dispatchEvent(new Event(CUPCAKES_UPDATED_EVENT));
}

export function createCupcakeId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "cupcake"}-${Date.now()}`;
}
