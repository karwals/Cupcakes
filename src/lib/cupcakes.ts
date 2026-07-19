export type WeeklyCupcake = {
  id: string;
  name: string;
  blurb: string;
  price: string;
  flavorOptions: string[];
};

export type CupcakeValidationResult =
  | {
      success: true;
      cupcakes: WeeklyCupcake[];
    }
  | {
      success: false;
      error: string;
    };

const CUPCAKES_PUBLIC_PATH = "/data/weekly-cupcakes.json";

const MAX_CUPCAKES = 24;
const MAX_ID_LENGTH = 80;
const MAX_NAME_LENGTH = 80;
const MAX_BLURB_LENGTH = 240;
const MAX_PRICE_LENGTH = 20;
const MAX_FLAVOR_OPTIONS = 24;
const MAX_FLAVOR_OPTION_LENGTH = 80;
const CUPCAKE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const defaultWeeklyCupcakes: WeeklyCupcake[] = [
  {
    id: "banana-bliss",
    name: "Banana Bliss",
    blurb: "Soft banana sponge, vanilla filling, and fluffy buttercream.",
    price: "$7.50",
    flavorOptions: ["Chocolate chips", "No chocolate chips"],
  },
];

export function validateWeeklyCupcakes(value: unknown): CupcakeValidationResult {
  if (!Array.isArray(value)) {
    return {
      success: false,
      error: "Cupcake data must be an array.",
    };
  }

  if (value.length === 0) {
    return {
      success: false,
      error: "Add at least one cupcake before publishing.",
    };
  }

  if (value.length > MAX_CUPCAKES) {
    return {
      success: false,
      error: `Please publish ${MAX_CUPCAKES} cupcakes or fewer.`,
    };
  }

  const ids = new Set<string>();
  const cupcakes: WeeklyCupcake[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const cupcakeResult = normalizeWeeklyCupcake(value[index], index, ids);

    if (!cupcakeResult.success) {
      return cupcakeResult;
    }

    cupcakes.push(cupcakeResult.cupcake);
    ids.add(cupcakeResult.cupcake.id);
  }

  return {
    success: true,
    cupcakes,
  };
}

export async function loadPublishedCupcakes() {
  try {
    const response = await fetch(getCupcakesDataUrl(), {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      return defaultWeeklyCupcakes;
    }

    const validation = validateWeeklyCupcakes(await response.json());

    return validation.success ? validation.cupcakes : defaultWeeklyCupcakes;
  } catch {
    return defaultWeeklyCupcakes;
  }
}

export async function loadPublishedCupcakesStrict() {
  const response = await fetch(getCupcakesDataUrl(), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error("Could not load the published cupcake list.");
  }

  const validation = validateWeeklyCupcakes(await response.json());

  if (!validation.success) {
    throw new Error(validation.error);
  }

  return validation.cupcakes;
}

export function createCupcakeId(name: string, existingIds: Iterable<string> = []) {
  const baseSlug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48)
      .replace(/-$/g, "") || "cupcake";
  const ids = new Set(existingIds);
  let suffix = Date.now().toString(36);
  let candidate = `${baseSlug}-${suffix}`;

  while (ids.has(candidate)) {
    suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

export function normalizeCupcakePrice(value: string) {
  const trimmedValue = value.trim();
  const cleanedValue = trimmedValue.replace(/^\$/, "");

  if (
    !cleanedValue ||
    cleanedValue.length > MAX_PRICE_LENGTH ||
    !/^\d+(\.\d{0,2})?$/.test(cleanedValue)
  ) {
    return null;
  }

  const price = Number(cleanedValue);

  if (!Number.isFinite(price) || price <= 0 || price > 9999.99) {
    return null;
  }

  return `$${price.toFixed(2)}`;
}

export function normalizeFlavorOptions(value: string[] | string) {
  const rawOptions = Array.isArray(value) ? value : value.split(/\r?\n/);
  const seenOptions = new Set<string>();
  const options: string[] = [];

  for (const rawOption of rawOptions) {
    const option = String(rawOption).trim();
    const optionKey = option.toLowerCase();

    if (!option || seenOptions.has(optionKey)) {
      continue;
    }

    seenOptions.add(optionKey);
    options.push(option);
  }

  return options;
}

function normalizeWeeklyCupcake(
  value: unknown,
  index: number,
  existingIds: Set<string>,
):
  | {
      success: true;
      cupcake: WeeklyCupcake;
    }
  | {
      success: false;
      error: string;
    } {
  const label = `Cupcake ${index + 1}`;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      error: `${label} must be an object.`,
    };
  }

  const cupcake = value as Partial<Record<keyof WeeklyCupcake, unknown>>;
  const id = normalizeRequiredString(cupcake.id, `${label} ID`, MAX_ID_LENGTH);
  const name = normalizeRequiredString(cupcake.name, `${label} name`, MAX_NAME_LENGTH);
  const blurb = normalizeRequiredString(cupcake.blurb, `${label} blurb`, MAX_BLURB_LENGTH);

  if (!id.success) {
    return id;
  }

  if (!CUPCAKE_ID_PATTERN.test(id.value)) {
    return {
      success: false,
      error: `${label} ID may only contain lowercase letters, numbers, and hyphens.`,
    };
  }

  if (existingIds.has(id.value)) {
    return {
      success: false,
      error: `Duplicate cupcake ID "${id.value}" found.`,
    };
  }

  if (!name.success) {
    return name;
  }

  if (!blurb.success) {
    return blurb;
  }

  if (typeof cupcake.price !== "string") {
    return {
      success: false,
      error: `${label} price is required.`,
    };
  }

  const price = normalizeCupcakePrice(cupcake.price);

  if (!price) {
    return {
      success: false,
      error: `${label} price must be a positive dollar amount.`,
    };
  }

  if (!Array.isArray(cupcake.flavorOptions)) {
    return {
      success: false,
      error: `${label} flavor options must be an array.`,
    };
  }

  const flavorOptions = normalizeFlavorOptions(cupcake.flavorOptions);

  if (flavorOptions.length === 0) {
    return {
      success: false,
      error: `${label} needs at least one flavor option.`,
    };
  }

  if (flavorOptions.length > MAX_FLAVOR_OPTIONS) {
    return {
      success: false,
      error: `${label} can have ${MAX_FLAVOR_OPTIONS} flavor options or fewer.`,
    };
  }

  const longFlavorOption = flavorOptions.find((option) => option.length > MAX_FLAVOR_OPTION_LENGTH);

  if (longFlavorOption) {
    return {
      success: false,
      error: `${label} has a flavor option that is too long.`,
    };
  }

  return {
    success: true,
    cupcake: {
      id: id.value,
      name: name.value,
      blurb: blurb.value,
      price,
      flavorOptions,
    },
  };
}

function normalizeRequiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    return {
      success: false as const,
      error: `${label} is required.`,
    };
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return {
      success: false as const,
      error: `${label} is required.`,
    };
  }

  if (normalizedValue.length > maxLength) {
    return {
      success: false as const,
      error: `${label} must be ${maxLength} characters or fewer.`,
    };
  }

  return {
    success: true as const,
    value: normalizedValue,
  };
}

function getCupcakesDataUrl() {
  return `${CUPCAKES_PUBLIC_PATH}?v=${Date.now()}`;
}
