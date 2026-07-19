import { createHash, createHmac, timingSafeEqual } from "crypto";

import type { NextRequest, NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "cupcakes_admin_session";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_VERSION = 1;

type AdminSessionPayload = {
  version: number;
  issuedAt: number;
  expiresAt: number;
};

export function verifyAdminPassword(password: unknown) {
  const configuredPassword = process.env.CUPCAKES_ADMIN_PASSWORD;

  if (!configuredPassword || !process.env.CUPCAKES_ADMIN_SESSION_SECRET) {
    return {
      success: false as const,
      status: 500,
      error: "Admin login is not configured.",
    };
  }

  if (typeof password !== "string" || !password) {
    return {
      success: false as const,
      status: 401,
      error: "Incorrect admin password.",
    };
  }

  if (!timingSafeStringEqual(password, configuredPassword)) {
    return {
      success: false as const,
      status: 401,
      error: "Incorrect admin password.",
    };
  }

  return {
    success: true as const,
  };
}

export function createAdminSessionCookieValue() {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    version: SESSION_VERSION,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signaturePart = signSessionPayload(payloadPart);

  return `${payloadPart}.${signaturePart}`;
}

export function hasValidAdminSession(request: NextRequest) {
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  return verifyAdminSessionCookie(sessionCookie);
}

export function setAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function verifyAdminSessionCookie(value: string | undefined) {
  if (!value) {
    return false;
  }

  const [payloadPart, signaturePart, extraPart] = value.split(".");

  if (!payloadPart || !signaturePart || extraPart) {
    return false;
  }

  let expectedSignature: string;

  try {
    expectedSignature = signSessionPayload(payloadPart);
  } catch {
    return false;
  }

  if (!timingSafeStringEqual(signaturePart, expectedSignature)) {
    return false;
  }

  const payload = parseSessionPayload(payloadPart);

  if (!payload) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  return (
    payload.version === SESSION_VERSION &&
    payload.issuedAt <= now + 60 &&
    payload.expiresAt > now &&
    payload.expiresAt - payload.issuedAt <= SESSION_TTL_SECONDS
  );
}

function parseSessionPayload(payloadPart: string): AdminSessionPayload | null {
  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as Partial<AdminSessionPayload>;

    if (
      typeof payload.version !== "number" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    return {
      version: payload.version,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

function signSessionPayload(payloadPart: string) {
  const sessionSecret = process.env.CUPCAKES_ADMIN_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error("Admin session signing is not configured.");
  }

  return base64UrlEncode(createHmac("sha256", sessionSecret).update(payloadPart).digest());
}

function timingSafeStringEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftHash, rightHash);
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url value.");
  }

  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");

  return Buffer.from(base64, "base64").toString("utf8");
}
