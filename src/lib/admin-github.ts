import { validateWeeklyCupcakes, type WeeklyCupcake } from "@/lib/cupcakes";

const CUPCAKES_REPO_OWNER = "karwals";
const CUPCAKES_REPO_NAME = "Cupcakes";
const CUPCAKES_REPO_BRANCH = "master";
const CUPCAKES_REPO_PATH = "public/data/weekly-cupcakes.json";
const GITHUB_CONTENTS_API_URL = `https://api.github.com/repos/${CUPCAKES_REPO_OWNER}/${CUPCAKES_REPO_NAME}/contents/${CUPCAKES_REPO_PATH}`;
const GITHUB_COMMIT_MESSAGE = "Update weekly cupcakes from admin";

type GitHubContentResponse = {
  content?: unknown;
  encoding?: unknown;
  sha?: unknown;
};

export class AdminGitHubError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "AdminGitHubError";
    this.status = status;
  }
}

export async function readCupcakesFromGitHub() {
  const file = await readGitHubCupcakeFile();
  const validation = validateWeeklyCupcakes(parseCupcakeFileContent(file.content));

  if (!validation.success) {
    throw new AdminGitHubError(validation.error, 502);
  }

  return validation.cupcakes;
}

export async function updateCupcakesOnGitHub(cupcakes: WeeklyCupcake[]) {
  const validation = validateWeeklyCupcakes(cupcakes);

  if (!validation.success) {
    throw new AdminGitHubError(validation.error, 400);
  }

  const content = Buffer.from(JSON.stringify(validation.cupcakes, null, 2) + "\n").toString("base64");
  let lastConflict: AdminGitHubError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await readGitHubCupcakeFile();
    const response = await fetch(GITHUB_CONTENTS_API_URL, {
      method: "PUT",
      cache: "no-store",
      headers: getGitHubHeaders(),
      body: JSON.stringify({
        branch: CUPCAKES_REPO_BRANCH,
        content,
        message: GITHUB_COMMIT_MESSAGE,
        sha: file.sha,
      }),
    });

    if (response.ok) {
      return validation.cupcakes;
    }

    const error = await getGitHubError(response, "Could not publish the cupcake update to GitHub.");

    if (response.status === 409) {
      lastConflict = error;
      continue;
    }

    throw error;
  }

  throw (
    lastConflict ??
    new AdminGitHubError("GitHub reported a file version conflict. Reload and try publishing again.", 409)
  );
}

async function readGitHubCupcakeFile() {
  const response = await fetch(`${GITHUB_CONTENTS_API_URL}?ref=${CUPCAKES_REPO_BRANCH}`, {
    cache: "no-store",
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    throw await getGitHubError(response, "Could not read the cupcake file from GitHub.");
  }

  const data = (await response.json()) as GitHubContentResponse;

  if (typeof data.sha !== "string" || typeof data.content !== "string") {
    throw new AdminGitHubError("GitHub did not return a usable cupcake file.", 502);
  }

  return {
    content: data.content,
    sha: data.sha,
  };
}

function parseCupcakeFileContent(content: string) {
  try {
    const json = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");

    return JSON.parse(json) as unknown;
  } catch {
    throw new AdminGitHubError("The cupcake file in GitHub contains invalid JSON.", 502);
  }
}

function getGitHubHeaders() {
  const token = process.env.GITHUB_CUPCAKES_TOKEN;

  if (!token) {
    throw new AdminGitHubError("GitHub publishing is not configured.", 500);
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getGitHubError(response: Response, fallback: string) {
  const detail = await readGitHubErrorMessage(response);

  if (response.status === 401) {
    return new AdminGitHubError("GitHub rejected the server token. Check GITHUB_CUPCAKES_TOKEN.", 502);
  }

  if (response.status === 403) {
    return new AdminGitHubError(
      "GitHub denied access to the cupcake file. Check token permissions and rate limits.",
      502,
    );
  }

  if (response.status === 404) {
    return new AdminGitHubError(
      `Could not find ${CUPCAKES_REPO_PATH} in ${CUPCAKES_REPO_OWNER}/${CUPCAKES_REPO_NAME} on ${CUPCAKES_REPO_BRANCH}.`,
      502,
    );
  }

  if (response.status === 409) {
    return new AdminGitHubError("GitHub reported a file version conflict. Reload and try publishing again.", 409);
  }

  return new AdminGitHubError(detail ? `${fallback} GitHub said: ${detail}` : fallback, 502);
}

async function readGitHubErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: unknown };

    return typeof data.message === "string" ? data.message : "";
  } catch {
    return "";
  }
}
