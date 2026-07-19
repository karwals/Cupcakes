import { NextResponse } from "next/server";

import { clearAdminSessionCookie } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json(
    { authenticated: false },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  clearAdminSessionCookie(response);

  return response;
}
