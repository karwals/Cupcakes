import { NextResponse } from "next/server";

import { setAdminSessionCookie, verifyAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonResponse({ error: "Please send a valid JSON request." }, 400);
  }

  const verification = verifyAdminPassword(body.password);

  if (!verification.success) {
    return jsonResponse({ error: verification.error }, verification.status);
  }

  try {
    const response = jsonResponse({ authenticated: true });

    setAdminSessionCookie(response);

    return response;
  } catch {
    return jsonResponse({ error: "Admin login is not configured." }, 500);
  }
}

async function readJsonObject(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
