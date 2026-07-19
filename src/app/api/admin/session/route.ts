import type { NextRequest } from "next/server";

import { hasValidAdminSession } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return Response.json(
    {
      authenticated: hasValidAdminSession(request),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
