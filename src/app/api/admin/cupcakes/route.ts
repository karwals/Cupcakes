import type { NextRequest } from "next/server";

import { AdminGitHubError, readCupcakesFromGitHub, updateCupcakesOnGitHub } from "@/lib/admin-github";
import { hasValidAdminSession } from "@/lib/admin-session";
import { validateWeeklyCupcakes } from "@/lib/cupcakes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorizedResponse = requireAdminSession(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    return jsonResponse({
      cupcakes: await readCupcakesFromGitHub(),
    });
  } catch (error) {
    return jsonError(error, "Could not load cupcakes from GitHub.");
  }
}

export async function PUT(request: NextRequest) {
  const unauthorizedResponse = requireAdminSession(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = await readJsonBody(request);

  if (!body.success) {
    return jsonResponse({ error: body.error }, 400);
  }

  const validation = validateWeeklyCupcakes(body.value);

  if (!validation.success) {
    return jsonResponse({ error: validation.error }, 400);
  }

  try {
    return jsonResponse({
      cupcakes: await updateCupcakesOnGitHub(validation.cupcakes),
      message: "Cupcake update accepted by GitHub. Netlify may take a short time to redeploy.",
    });
  } catch (error) {
    return jsonError(error, "Could not publish cupcakes to GitHub.");
  }
}

function requireAdminSession(request: NextRequest) {
  if (hasValidAdminSession(request)) {
    return null;
  }

  return jsonResponse({ error: "Admin login required." }, 401);
}

async function readJsonBody(
  request: Request,
): Promise<
  | {
      success: true;
      value: unknown;
    }
  | {
      success: false;
      error: string;
    }
> {
  try {
    return {
      success: true,
      value: await request.json(),
    };
  } catch {
    return {
      success: false,
      error: "Please send valid cupcake JSON.",
    };
  }
}

function jsonError(error: unknown, fallback: string) {
  if (error instanceof AdminGitHubError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  return jsonResponse({ error: fallback }, 500);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
