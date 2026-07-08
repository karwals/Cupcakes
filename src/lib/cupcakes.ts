export type WeeklyCupcake = {
  id: string;
  name: string;
  blurb: string;
  price: string;
  flavorOptions: string[];
};

export const CUPCAKES_STORAGE_KEY = "velvet-crumb-weekly-cupcakes";
export const CUPCAKES_UPDATED_EVENT = "velvet-crumb-cupcakes-updated";
export const GITHUB_TOKEN_STORAGE_KEY = "velvet-crumb-github-token";

const SITE_BASE_PATH = "/Cupcakes";
const CUPCAKES_PUBLIC_PATH = "/data/weekly-cupcakes.json";
const CUPCAKES_REPO_PATH = "public/data/weekly-cupcakes.json";
const GITHUB_REPO_OWNER = "karwals";
const GITHUB_REPO_NAME = "Cupcakes";
const GITHUB_REPO_BRANCH = "master";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${CUPCAKES_REPO_PATH}`;

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

function parseWeeklyCupcakes(value: unknown) {
  if (Array.isArray(value) && value.every(isWeeklyCupcake)) {
    return value.length > 0 ? value : defaultWeeklyCupcakes;
  }

  return null;
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
    const cupcakes = parseWeeklyCupcakes(parsedCupcakes);

    if (cupcakes) {
      return cupcakes;
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

export function getStoredGitHubToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) ?? "";
}

export function saveStoredGitHubToken(token: string) {
  window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, token);
}

export function clearStoredGitHubToken() {
  window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
}

export async function loadPublishedCupcakes() {
  const response = await fetch(getCupcakesDataUrl(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Could not load the published cupcake list.");
  }

  const cupcakes = parseWeeklyCupcakes(await response.json());

  if (!cupcakes) {
    throw new Error("The published cupcake list has invalid data.");
  }

  saveStoredCupcakes(cupcakes);
  return cupcakes;
}

export async function publishCupcakesToGitHub(cupcakes: WeeklyCupcake[], token: string) {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    throw new Error("Add a GitHub token before publishing.");
  }

  const content = toBase64(JSON.stringify(cupcakes, null, 2) + "\n");
  let lastError = "Could not publish the cupcake update to GitHub.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const sha = await getGitHubCupcakeFileSha(trimmedToken);
    const updateResponse = await fetch(GITHUB_API_URL, {
      method: "PUT",
      cache: "no-store",
      headers: getGitHubHeaders(trimmedToken),
      body: JSON.stringify({
        branch: GITHUB_REPO_BRANCH,
        content,
        message: "Update weekly cupcakes",
        sha,
      }),
    });

    if (updateResponse.ok) {
      return;
    }

    lastError = await getGitHubErrorMessage(updateResponse, "Could not publish the cupcake update to GitHub.");

    if (updateResponse.status !== 409) {
      break;
    }
  }

  throw new Error(lastError);
}

async function getGitHubCupcakeFileSha(token: string) {
  const fileResponse = await fetch(`${GITHUB_API_URL}?ref=${GITHUB_REPO_BRANCH}`, {
    cache: "no-store",
    headers: getGitHubHeaders(token),
  });

  if (!fileResponse.ok) {
    throw new Error(await getGitHubErrorMessage(fileResponse, "Could not read the cupcake file from GitHub."));
  }

  const fileData = (await fileResponse.json()) as { sha?: unknown };

  if (typeof fileData.sha !== "string") {
    throw new Error("GitHub did not return a file version for the cupcake file.");
  }

  return fileData.sha;
}

export function createCupcakeId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "cupcake"}-${Date.now()}`;
}

function getCupcakesDataUrl() {
  return `${SITE_BASE_PATH}${CUPCAKES_PUBLIC_PATH}?v=${Date.now()}`;
}

function getGitHubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binaryValue = "";

  bytes.forEach((byte) => {
    binaryValue += String.fromCharCode(byte);
  });

  return btoa(binaryValue);
}

async function getGitHubErrorMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: unknown };

    if (typeof data.message === "string") {
      return `${fallback} GitHub said: ${data.message}`;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
