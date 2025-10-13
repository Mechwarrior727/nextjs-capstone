import "server-only";

import { NextRequest } from "next/server";
import {
  PrivyClient,
  type AuthTokenClaims,
  type User as PrivyUser,
} from "@privy-io/server-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  throw new Error(
    "Privy environment variables are not configured. Ensure NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are set."
  );
}

const privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

export interface PrivySession {
  claims: AuthTokenClaims;
  user: PrivyUser;
  token: string;
}

function normaliseToken(raw?: string | null): string | null {
  if (!raw) return null;

  let value = raw.trim();
  if (!value || value === "undefined" || value === "null") return null;

  try {
    value = decodeURIComponent(value);
  } catch {
    // ignore decode errors; fall back to raw value
  }

  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value);
      const candidate =
        parsed?.identity_token ??
        parsed?.identityToken ??
        parsed?.token ??
        parsed?.idToken ??
        parsed?.id_token ??
        null;

      return typeof candidate === "string" ? candidate : null;
    } catch {
      return null;
    }
  }

  return value;
}

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    return normaliseToken(token);
  }

  const cookieToken = normaliseToken(req.cookies.get("privy-token")?.value);
  return cookieToken;
}

async function verifyAuthToken(token: string): Promise<AuthTokenClaims> {
  try {
    return await privyClient.verifyAuthToken(token);
  } catch (error) {
    throw new Error("Unauthorized: invalid Privy token");
  }
}

export async function requirePrivySession(
  req: NextRequest
): Promise<PrivySession> {
  const token = extractToken(req);
  if (!token) {
    throw new Error("Unauthorized: missing Privy token");
  }

  const claims = await verifyAuthToken(token);
  const user = await privyClient.getUser(claims.userId);
  if (!user) {
    throw new Error("Unauthorized: Privy user not found");
  }

  return { claims, user, token };
}

export async function requirePrivyUser(
  req: NextRequest
): Promise<PrivyUser> {
  const { user } = await requirePrivySession(req);
  return user;
}

export function getPrimaryEmail(user: PrivyUser): string | null {
  if (user.email?.address) {
    return user.email.address;
  }

  const linkedEmail = user.linkedAccounts?.find(
    (account) => account.type === "email"
  ) as { address?: string } | undefined;

  return linkedEmail?.address ?? null;
}
